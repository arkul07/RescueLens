// WebSocket connection management

import { useCallback, useEffect, useRef, useState } from 'react';
import { PatientState, TriageDecision, OverrideRequest } from '../types';

export interface WebSocketState {
  connected: boolean;
  error: string | null;
  triageDecisions: Map<string, TriageDecision>;
}

export const useWS = () => {
  const [wsState, setWsState] = useState<WebSocketState>({
    connected: false,
    error: null,
    triageDecisions: new Map()
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  const shouldReconnectRef = useRef<boolean>(true);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    if (isConnectingRef.current) {
      return;
    }

    if (!shouldReconnectRef.current) {
      return;
    }

    console.log('🔌 Connecting to WebSocket...');
    isConnectingRef.current = true;
    
    try {
      const ws = new WebSocket('ws://localhost:8000/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        isConnectingRef.current = false;
        setWsState(prev => ({ ...prev, connected: true, error: null }));
        
        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'triage_decision') {
            const decision: TriageDecision = data.decision;
            setWsState(prev => ({
              ...prev,
              triageDecisions: new Map(prev.triageDecisions).set(decision.id, decision)
            }));
          } else if (data.type === 'pong') {
            // Heartbeat response
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected', event.code, event.reason);
        isConnectingRef.current = false;
        setWsState(prev => ({ ...prev, connected: false }));
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Reconnect if not manual close
        if (event.code !== 1000 && shouldReconnectRef.current && !reconnectTimeoutRef.current) {
          console.log('🔌 Scheduling reconnection...');
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 3000);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        isConnectingRef.current = false;
        setWsState(prev => ({ ...prev, error: 'WebSocket connection failed' }));
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      isConnectingRef.current = false;
      setWsState(prev => ({ ...prev, error: `Failed to create WebSocket: ${error}` }));
    }
  }, []);

  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting WebSocket...');
    
    shouldReconnectRef.current = false;
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    isConnectingRef.current = false;
    setWsState(prev => ({ ...prev, connected: false }));
  }, []);

  const sendPatientStates = useCallback((patients: PatientState[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'patient_states',
        data: patients
      }));
    }
  }, []);

  const sendOverride = useCallback(async (override: OverrideRequest) => {
    try {
      const response = await fetch('http://localhost:8000/override', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(override)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Override sent:', result);
    } catch (error) {
      console.error('Error sending override:', error);
      setWsState(prev => ({ ...prev, error: `Failed to send override: ${error}` }));
    }
  }, []);

  const exportLogs = useCallback(async (format: 'json' | 'csv' = 'json') => {
    try {
      const response = await fetch(`http://localhost:8000/export?format=${format}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `triage_log_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting logs:', error);
      setWsState(prev => ({ ...prev, error: `Failed to export logs: ${error}` }));
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    console.log('🔌 Auto-connecting WebSocket...');
    shouldReconnectRef.current = true;
    
    const connectTimeout = setTimeout(() => {
      connect();
    }, 1000);
    
    return () => {
      clearTimeout(connectTimeout);
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    ...wsState,
    connect,
    disconnect,
    sendPatientStates,
    sendOverride,
    exportLogs
  };
};

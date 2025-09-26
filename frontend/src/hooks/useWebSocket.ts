import { useState, useEffect, useRef, useCallback } from 'react';
import { PatientState, TriageDecision, OverrideRequest } from '../types';

export interface WebSocketState {
  connected: boolean;
  error: string | null;
  triageDecisions: Map<string, TriageDecision>;
}

export const useWebSocket = () => {
  const [wsState, setWsState] = useState<WebSocketState>({
    connected: false,
    error: null,
    triageDecisions: new Map()
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      const ws = new WebSocket('ws://localhost:8000/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔗 WebSocket connected');
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

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        setWsState(prev => ({ ...prev, connected: false }));
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setWsState(prev => ({ ...prev, error: 'WebSocket connection failed' }));
      };

    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setWsState(prev => ({ ...prev, error: `Failed to create WebSocket: ${error}` }));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    setWsState(prev => ({ ...prev, connected: false }));
  }, []);

  const sendPatientState = useCallback((patientState: PatientState) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'patient_state',
        data: patientState
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
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    ...wsState,
    connect,
    disconnect,
    sendPatientState,
    sendOverride,
    exportLogs
  };
};

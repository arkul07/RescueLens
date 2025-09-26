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
  const isConnectingRef = useRef<boolean>(false);
  const shouldReconnectRef = useRef<boolean>(true);
  const lastConnectTimeRef = useRef<number>(0);
  const isInitializedRef = useRef<boolean>(false);

  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      console.log('🔌 WebSocket already connected or connecting, skipping...');
      return;
    }

    if (isConnectingRef.current) {
      console.log('🔌 WebSocket connection already in progress, skipping...');
      return;
    }

    if (!shouldReconnectRef.current) {
      console.log('🔌 WebSocket reconnection disabled, skipping...');
      return;
    }

    console.log('🔌 Creating new WebSocket connection...');
    isConnectingRef.current = true;
    
    try {
      const ws = new WebSocket('ws://localhost:8002/ws');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('🔗 WebSocket connected');
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
          console.log('📨 WebSocket message received:', data);
          
          if (data.type === 'triage_decision') {
            const decision: TriageDecision = data.decision;
            console.log('🏥 Triage decision received:', decision);
            setWsState(prev => ({
              ...prev,
              triageDecisions: new Map(prev.triageDecisions).set(decision.id, decision)
            }));
          } else if (data.type === 'pong') {
            // Heartbeat response
            console.log('💓 Heartbeat response received');
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

        // Only reconnect if it wasn't a manual close (code 1000) and reconnection is enabled
        if (event.code !== 1000 && shouldReconnectRef.current && !reconnectTimeoutRef.current) {
          console.log('🔌 Scheduling reconnection in 5 seconds...');
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectTimeoutRef.current = null;
            connect();
          }, 5000);
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
    console.log('🔌 useWebSocket: Disconnecting...');
    
    // Disable reconnection
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
      console.log('🔌 useWebSocket: Closing WebSocket...');
      wsRef.current.close(1000, 'Manual disconnect');
      wsRef.current = null;
    }
    
    isConnectingRef.current = false;
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
      const response = await fetch('http://localhost:8002/override', {
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
      const response = await fetch(`http://localhost:8002/export?format=${format}`);
      
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

  // Initialize connection ONCE
  useEffect(() => {
    console.log('🔌 useWebSocket: Auto-connecting...');
    shouldReconnectRef.current = true;
    
    // Add a small delay to prevent rapid connections
    const connectTimeout = setTimeout(() => {
      connect();
    }, 1000);
    
    return () => {
      console.log('🔌 useWebSocket: Disconnecting...');
      clearTimeout(connectTimeout);
      disconnect();
    };
  }, [connect]);

  const manualConnect = useCallback(() => {
    shouldReconnectRef.current = true;
    connect();
  }, [connect]);

  return {
    ...wsState,
    connect: manualConnect,
    disconnect,
    sendPatientState,
    sendOverride,
    exportLogs
  };
};
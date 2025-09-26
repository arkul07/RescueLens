import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useMedia } from './hooks/useMedia';
import { usePerception } from './hooks/usePerception';
import { useWebSocket } from './hooks/useWebSocket';
import { drawAllOverlays, DrawContext } from './utils/draw';
import { PatientState, TriageDecision, OverrideRequest } from './types';
import './App.css';

type AppMode = 'live' | 'upload' | 'synthetic';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>('live');
  const [isDetecting, setIsDetecting] = useState(false);
  const [fps, setFps] = useState(0);
  const [status, setStatus] = useState('Select a mode to begin...');
  const [eventLog, setEventLog] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string | null>(null);
  const [overrideCategory, setOverrideCategory] = useState<string>('UNKNOWN');
  const [overrideReason, setOverrideReason] = useState('');

  // Refs for stable DOM elements - never remount these
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fpsRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef<number>(0);
  const animationIdRef = useRef<number | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  const lastStateUpdateRef = useRef<number>(0);

  // Custom hooks
  const { videoStream, initializeMedia, stopMedia, getAudioData } = useMedia();
  const { patients, isProcessing, error: perceptionError, startDetection, stopDetection } = usePerception(videoRef.current);
  const { connected, triageDecisions, sendPatientState, sendOverride, exportLogs, error: wsError, connect: reconnectWs } = useWebSocket();

  // Don't auto-initialize media - let user control it manually

  // Set video stream ONCE when available
  useEffect(() => {
    if (videoStream && videoRef.current && !videoRef.current.srcObject) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch(console.error);
    }
  }, [videoStream]);

  // Start/stop detection based on media state
  useEffect(() => {
    if (videoStream && !isDetecting) {
      startDetection();
      setIsDetecting(true);
    } else if (!videoStream && isDetecting) {
      stopDetection();
      setIsDetecting(false);
    }
  }, [videoStream, isDetecting, startDetection, stopDetection]);

  // Handle manual start/stop
  const handleToggleDetection = useCallback(() => {
    if (isDetecting) {
      stopDetection();
      setIsDetecting(false);
    } else {
      startDetection();
      setIsDetecting(true);
    }
  }, [isDetecting, startDetection, stopDetection]);

  // Handle camera start
  const handleStartCamera = useCallback(async () => {
    console.log('📹 Starting camera...');
    try {
      await initializeMedia();
    } catch (error) {
      console.error('Failed to start camera:', error);
    }
  }, [initializeMedia]);

  // Handle camera stop
  const handleStopCamera = useCallback(() => {
    console.log('🛑 Stopping camera and detection...');
    stopMedia();
    stopDetection();
    setIsDetecting(false);
  }, [stopMedia, stopDetection]);

  // Throttled state updates - only update React state at 3-4Hz
  const updateThrottledState = useCallback(() => {
    const now = Date.now();
    if (now - lastStateUpdateRef.current < 250) { // 4Hz max
      return;
    }
    lastStateUpdateRef.current = now;

    // Update FPS
    if (lastFrameTimeRef.current > 0) {
      const delta = now - lastFrameTimeRef.current;
      if (delta > 0) {
        const currentFps = 1000 / delta;
        const cappedFps = Math.min(Math.max(currentFps, 0), 120);
        
        fpsRef.current.push(cappedFps);
        if (fpsRef.current.length > 30) {
          fpsRef.current = fpsRef.current.slice(-30);
        }
        
        const avgFps = fpsRef.current.reduce((sum, f) => sum + f, 0) / fpsRef.current.length;
        setFps(Math.round(avgFps * 10) / 10);
      }
    }
    lastFrameTimeRef.current = now;
  }, []);

  // Send patient states to backend - throttled
  useEffect(() => {
    if (patients.length > 0 && connected) {
      patients.forEach(patient => {
        const audioData = getAudioData();
        const patientWithAudio: PatientState = {
          ...patient,
          audio: {
            breathingPresent: audioData.breathingPresent,
            snr: audioData.snr
          }
        };
        sendPatientState(patientWithAudio);
      });
    }
  }, [patients, connected, sendPatientState, getAudioData]);

  // Canvas overlay drawing with requestAnimationFrame - NO React state updates
  useEffect(() => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      if (!isDetecting) {
        animationIdRef.current = requestAnimationFrame(draw);
        return;
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Get latest data from refs (no state)
      const latestPatients = patients;
      const latestDecisions = triageDecisions;
      const latestFps = fpsRef.current.length > 0 ? 
        Math.round(fpsRef.current.reduce((sum, f) => sum + f, 0) / fpsRef.current.length * 10) / 10 : 0;

      // Draw overlays
      const drawContext: DrawContext = {
        canvas,
        ctx,
        videoWidth: canvas.width,
        videoHeight: canvas.height
      };

      drawAllOverlays(drawContext, latestPatients, latestDecisions, latestFps, status);

      // Update throttled state
      updateThrottledState();

      // Continue animation loop
      animationIdRef.current = requestAnimationFrame(draw);
    };

    if (isDetecting) {
      animationIdRef.current = requestAnimationFrame(draw);
    }

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    };
  }, [isDetecting, patients, triageDecisions, status, updateThrottledState]);

  // Update status - throttled
  useEffect(() => {
    const updateStatus = () => {
      if (mode === 'live') {
        if (perceptionError) {
          setStatus(`Error: ${perceptionError}`);
        } else if (wsError) {
          setStatus(`WebSocket Error: ${wsError}`);
        } else if (!connected) {
          setStatus('Connecting to backend...');
        } else if (!videoStream) {
          setStatus('Click "Start Camera" to begin');
        } else if (isProcessing) {
          setStatus(`Detecting patients... (${patients.length} found)`);
        } else {
          setStatus('Camera ready - Click "Start Detection" to begin analysis');
        }
      } else if (mode === 'upload') {
        setStatus('Upload video mode - Select a video file to analyze');
      } else if (mode === 'synthetic') {
        setStatus('Synthetic data mode - Generating test data');
      }
    };

    // Throttle status updates
    const timeoutId = setTimeout(updateStatus, 100);
    return () => clearTimeout(timeoutId);
  }, [mode, perceptionError, wsError, connected, videoStream, isProcessing, patients.length]);

  // Handle override submission
  const handleOverride = useCallback(async () => {
    if (!selectedPatient || !overrideCategory) return;

    const override: OverrideRequest = {
      id: selectedPatient,
      category: overrideCategory as any,
      reason: overrideReason || 'Human override',
      ts: Date.now()
    };

    await sendOverride(override);
    
    setEventLog(prev => [{
      id: `override_${Date.now()}`,
      timestamp: Date.now(),
      ai: false,
      patient_id: selectedPatient,
      category: overrideCategory,
      confidence: 1.0,
      reason: overrideReason || 'Human override',
      override_reason: overrideReason
    }, ...prev.slice(0, 99)]);

    setSelectedPatient(null);
    setOverrideReason('');
  }, [selectedPatient, overrideCategory, overrideReason, sendOverride]);

  // Handle export
  const handleExport = useCallback(async (format: 'json' | 'csv') => {
    await exportLogs(format);
  }, [exportLogs]);

  return (
    <div className="app">
      <header className="app-header">
        <h1>🚑 RescueLens - AI-Assisted Triage</h1>
        
        <div className="mode-selector">
          <button 
            className={`mode-btn ${mode === 'live' ? 'active' : ''}`}
            onClick={() => setMode('live')}
          >
            📹 Live Feed
          </button>
          <button 
            className={`mode-btn ${mode === 'upload' ? 'active' : ''}`}
            onClick={() => setMode('upload')}
          >
            📁 Upload Video
          </button>
          <button 
            className={`mode-btn ${mode === 'synthetic' ? 'active' : ''}`}
            onClick={() => setMode('synthetic')}
          >
            🧪 Synthetic Data
          </button>
        </div>
        
        <div className="status-indicator">
          <span className={`status-dot ${connected ? 'connected' : 'disconnected'}`}></span>
          {connected ? 'Connected' : 'Disconnected'}
          {wsError && <span className="error-text"> - {wsError}</span>}
        </div>
      </header>

      <div className="main-content">
        <div className="video-panel">
          {mode === 'live' && (
            <div className="video-container">
              {!videoStream ? (
                <div className="camera-placeholder">
                  <div className="camera-icon">📹</div>
                  <div className="camera-text">Camera Not Started</div>
                  <div className="camera-subtext">Click "Start Camera" to begin</div>
                </div>
              ) : (
                <>
                  {/* Mount video ONCE - never remount */}
                  <video
                    ref={videoRef}
                    className="video-feed"
                    autoPlay
                    muted
                    playsInline
                  />
                  {/* Mount canvas ONCE - never remount */}
                  <canvas
                    ref={canvasRef}
                    className="overlay-canvas"
                    width={640}
                    height={360}
                    style={{ display: isDetecting ? 'block' : 'none' }}
                  />
                </>
              )}
            </div>
          )}
          
          {mode === 'upload' && (
            <div className="upload-container">
              <div className="upload-area">
                <input
                  type="file"
                  id="video-upload"
                  accept="video/*"
                  style={{ display: 'none' }}
                />
                <label htmlFor="video-upload" className="upload-label">
                  <div className="upload-icon">📁</div>
                  <div className="upload-text">Click to upload video file</div>
                  <div className="upload-subtext">Supports MP4, MOV, AVI formats</div>
                </label>
              </div>
            </div>
          )}
          
          {mode === 'synthetic' && (
            <div className="synthetic-container">
              <div className="synthetic-area">
                <div className="synthetic-icon">🧪</div>
                <div className="synthetic-text">Synthetic Data Mode</div>
                <div className="synthetic-subtext">Generating test patient data for analysis</div>
                <button 
                  className="control-btn start"
                  onClick={() => {
                    setStatus('Generating synthetic patient data...');
                  }}
                >
                  ▶️ Start Synthetic Data
                </button>
              </div>
            </div>
          )}
          
          <div className="controls">
            {mode === 'live' && (
              <>
                {!videoStream ? (
                  <button
                    onClick={handleStartCamera}
                    className="control-btn start"
                  >
                    📹 Start Camera
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleToggleDetection}
                      className={`control-btn ${isDetecting ? 'stop' : 'start'}`}
                    >
                      {isDetecting ? '⏹️ Stop Detection' : '▶️ Start Detection'}
                    </button>
                    
                    <button
                      onClick={handleStopCamera}
                      className="control-btn stop-camera"
                    >
                      📷 Stop Camera
                    </button>
                  </>
                )}
              </>
            )}
            
            {mode === 'upload' && (
              <button
                onClick={() => {
                  setStatus('Processing uploaded video...');
                }}
                className="control-btn start"
                disabled={true}
              >
                ▶️ Process Video
              </button>
            )}
            
            <button
              onClick={() => handleExport('json')}
              className="control-btn export"
              disabled={!connected}
            >
              📄 Export JSON
            </button>
            
            <button
              onClick={() => handleExport('csv')}
              className="control-btn export"
              disabled={!connected}
            >
              📊 Export CSV
            </button>
            
            <button
              onClick={reconnectWs}
              className="control-btn reconnect"
              disabled={connected}
            >
              🔌 Reconnect WebSocket
            </button>
          </div>
        </div>

        <div className="sidebar">
          <div className="patients-panel">
            <h3>Detected Patients</h3>
            {patients.length === 0 ? (
              <p className="no-patients">No patients detected</p>
            ) : (
              <div className="patients-list">
                {patients.map(patient => {
                  const decision = triageDecisions.get(patient.id);
                  return (
                    <div
                      key={patient.id}
                      className={`patient-card ${selectedPatient === patient.id ? 'selected' : ''}`}
                      onClick={() => setSelectedPatient(patient.id)}
                    >
                      <div className="patient-header">
                        <span className="patient-id">{patient.id}</span>
                        <span className={`triage-badge ${decision?.category || 'UNKNOWN'}`}>
                          {decision?.category || 'UNKNOWN'}
                        </span>
                      </div>
                      
                      <div className="patient-details">
                        <div className="detail-row">
                          <span>Breathing:</span>
                          <span>
                            {patient.rr_bpm ? `${patient.rr_bpm} bpm` : 
                             patient.breathing === true ? 'Yes' :
                             patient.breathing === false ? 'No' : 'Unknown'}
                          </span>
                        </div>
                        
                        <div className="detail-row">
                          <span>Movement:</span>
                          <span>{patient.movement}</span>
                        </div>
                        
                        <div className="detail-row">
                          <span>Confidence:</span>
                          <span>{(patient.det_conf * 100).toFixed(0)}%</span>
                        </div>
                        
                        {decision && (
                          <div className="detail-row">
                            <span>Reason:</span>
                            <span className="reason-text">{decision.reason}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedPatient && (
            <div className="override-panel">
              <h3>Human Override</h3>
              <div className="override-form">
                <div className="form-group">
                  <label>Category:</label>
                  <select
                    value={overrideCategory}
                    onChange={(e) => setOverrideCategory(e.target.value)}
                  >
                    <option value="UNKNOWN">Unknown</option>
                    <option value="GREEN">Green</option>
                    <option value="YELLOW">Yellow</option>
                    <option value="RED">Red</option>
                    <option value="BLACK">Black</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Reason:</label>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Enter override reason..."
                  />
                </div>
                
                <div className="form-actions">
                  <button
                    onClick={handleOverride}
                    className="override-btn"
                  >
                    Apply Override
                  </button>
                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="cancel-btn"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="event-log">
            <h3>Event Log</h3>
            <div className="log-entries">
              {eventLog.slice(0, 10).map(entry => (
                <div key={entry.id} className={`log-entry ${entry.ai ? 'ai' : 'override'}`}>
                  <div className="log-header">
                    <span className="log-time">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`log-category ${entry.category}`}>
                      {entry.category}
                    </span>
                  </div>
                  <div className="log-details">
                    <span>{entry.patient_id}</span>
                    <span>{entry.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="debug-panel">
            <h3>Debug Info</h3>
            <div className="debug-info">
              <div>WebSocket: {connected ? '✅ Connected' : '❌ Disconnected'}</div>
              <div>Patients: {patients.length}</div>
              <div>FPS: {fps.toFixed(1)}</div>
              <div>Status: {status}</div>
              {wsError && <div className="error">Error: {wsError}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
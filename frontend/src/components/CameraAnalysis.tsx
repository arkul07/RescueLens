/**
 * CameraAnalysis Component
 * 
 * Real-time people detection and triage analysis using MediaPipe Tasks Vision
 * 
 * Install instructions:
 * npm i
 * npm i @mediapipe/tasks-vision @mediapipe/pose @tensorflow-models/coco-ssd @tensorflow/tfjs
 * npm run dev
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMedia } from '../hooks/useMedia';
import { usePerception } from '../hooks/usePerception';
import { useWebSocket } from '../hooks/useWebSocket';
import { drawAllOverlays, DrawContext } from '../utils/draw';
import { PatientState, TriageDecision } from '../types';

const CameraAnalysis: React.FC = () => {
  const [fps, setFps] = useState(0);
  const [status, setStatus] = useState('Initializing...');
  const [eventLog, setEventLog] = useState<any[]>([]);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  // Refs for DOM elements
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Refs for animation and throttling
  const animationIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const fpsBufferRef = useRef<number[]>([]);
  const lastStateUpdateRef = useRef<number>(0);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Custom hooks
  const { videoStream, videoRef, initializeMedia, stopMedia, getAudioData } = useMedia();
  const { patients, isProcessing, error: perceptionError, startDetection, stopDetection } = usePerception(videoElement);
  
  // Mock WebSocket state for now (commented out real WebSocket)
  const connected = true; // Mock as connected
  const triageDecisions = new Map(); // Empty map
  const wsError = null; // No error
  const sendPatientState = () => {}; // No-op
  const sendOverride = () => {}; // No-op
  const exportLogs = () => {}; // No-op

  // Video stream is handled by useMedia hook
  useEffect(() => {
    console.log('Video stream state:', videoStream);
    console.log('Video ref:', videoRef.current);
    if (videoRef.current && videoStream) {
      console.log('Setting video stream on element...');
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().then(() => {
        console.log('Video play started');
        setVideoElement(videoRef.current);
      }).catch(err => {
        console.error('Video play failed:', err);
      });
    }
  }, [videoStream, videoRef]);

  // Start/stop detection based on media state
  useEffect(() => {
    if (videoStream && videoElement && !isProcessing) {
      // Wait for video to be ready
      const checkVideoReady = () => {
        if (videoElement && videoElement.readyState >= 2) {
          console.log('🎥 Video is ready, starting detection...');
          startDetection();
        } else {
          console.log('🎥 Video not ready yet, waiting...');
          setTimeout(checkVideoReady, 100);
        }
      };
      checkVideoReady();
    } else if (!videoStream && isProcessing) {
      stopDetection();
    }
  }, [videoStream, videoElement, isProcessing, startDetection, stopDetection]);

  // FPS calculation
  const updateFPS = useCallback(() => {
    const now = performance.now();
    if (lastFrameTimeRef.current > 0) {
      const delta = now - lastFrameTimeRef.current;
      if (delta > 0) {
        const currentFps = 1000 / delta;
        fpsBufferRef.current.push(Math.min(Math.max(currentFps, 0), 120));
        if (fpsBufferRef.current.length > 30) {
          fpsBufferRef.current = fpsBufferRef.current.slice(-30);
        }
      }
    }
    lastFrameTimeRef.current = now;

    const currentFps = fpsBufferRef.current.reduce((sum, f) => sum + f, 0) / fpsBufferRef.current.length;
    setFps(Math.round(currentFps * 10) / 10 || 0);
  }, []);

  // Throttled state updates
  const updateThrottledState = useCallback(() => {
    const now = Date.now();
    if (now - lastStateUpdateRef.current < 250) { // 4Hz max
      return;
    }
    lastStateUpdateRef.current = now;

    // Update event log with new triage decisions
    triageDecisions.forEach(decision => {
      const existingEntry = eventLog.find(entry => entry.patient_id === decision.id && entry.ai);
      if (!existingEntry || existingEntry.category !== decision.category || existingEntry.reason !== decision.reason) {
        setEventLog(prev => [{
          id: `ai_${decision.ts}_${decision.id}`,
          timestamp: decision.ts,
          ai: true,
          patient_id: decision.id,
          category: decision.category,
          confidence: decision.confidence,
          reason: decision.reason,
        }, ...prev.slice(0, 99)]);
      }
    });
  }, [eventLog, triageDecisions]);

  // Animation loop for canvas drawing
  useEffect(() => {
    const animate = () => {
      updateFPS();

      if (canvasRef.current && videoRef.current && isProcessing) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Set canvas size to match the video container
          const container = canvas.parentElement;
          if (container) {
            const rect = container.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;
          }
          
          drawAllOverlays({
            canvas,
            ctx,
            videoWidth: canvas.width,
            videoHeight: canvas.height
          }, patients, triageDecisions, fps, status);
        }
      }
      
      updateThrottledState();
      animationIdRef.current = requestAnimationFrame(animate);
    };

    if (isProcessing) {
      animationIdRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    };
  }, [isProcessing, patients, triageDecisions, status, updateFPS, updateThrottledState]);

  // Update status
  useEffect(() => {
    const updateStatus = () => {
      if (perceptionError) {
        setStatus(`Error: ${perceptionError}`);
      } else if (!videoStream) {
        setStatus('Click "Start Camera" to begin');
      } else if (isProcessing) {
        setStatus(`Detecting patients... (${patients.length} found)`);
      } else {
        setStatus('Camera ready - Click "Start Detection" to begin analysis');
      }
    };

    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }
    statusTimeoutRef.current = setTimeout(updateStatus, 100);
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, [perceptionError, videoStream, isProcessing, patients.length]);

  // Send patient states to backend (throttled) - COMMENTED OUT FOR NOW
  // useEffect(() => {
  //   if (patients.length > 0 && connected && isProcessing) {
  //     patients.forEach(patient => {
  //       const audioData = getAudioData();
  //       const patientWithAudio: PatientState = {
  //         ...patient,
  //         audio: {
  //           breathingPresent: audioData.breathingPresent,
  //           snr: audioData.snr
  //         }
  //       };
  //       sendPatientState(patientWithAudio);
  //     });
  //   }
  // }, [patients, connected, isProcessing, sendPatientState, getAudioData]);

  // Handle camera start
  const handleStartCamera = useCallback(async () => {
    console.log('📹 Starting camera...');
    try {
      await initializeMedia();
      console.log('Camera started successfully');
    } catch (error) {
      console.error('Failed to start camera:', error);
    }
  }, [initializeMedia]);

  // Handle camera stop
  const handleStopCamera = useCallback(() => {
    console.log('🛑 Stopping camera and detection...');
    stopMedia();
    stopDetection();
  }, [stopMedia, stopDetection]);

  // Handle export
  const handleExport = useCallback(async (format: 'json' | 'csv') => {
    await exportLogs(format);
  }, [exportLogs]);

  return (
    <div className="camera-analysis">
      <div className="video-container">
        {!videoStream ? (
          <div className="camera-placeholder">
            <div className="camera-icon">📹</div>
            <div className="camera-text">Camera Not Started</div>
            <div className="camera-subtext">Click "Start Camera" to begin</div>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="video-feed"
              autoPlay
              muted
              playsInline
            />
            <canvas
              ref={canvasRef}
              className="overlay-canvas"
              style={{ display: isProcessing ? 'block' : 'none' }}
            />
          </>
        )}
      </div>
      
      <div className="controls">
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
              onClick={isProcessing ? stopDetection : startDetection}
              className={`control-btn ${isProcessing ? 'stop' : 'start'}`}
            >
              {isProcessing ? '⏹️ Stop Detection' : '▶️ Start Detection'}
            </button>
            
            <button
              onClick={handleStopCamera}
              className="control-btn stop-camera"
            >
              📷 Stop Camera
            </button>
          </>
        )}
        
                  {/* <button
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
                  </button> */}
      </div>

      <div className="sidebar">
        <div className="patients-panel">
          <h3>Detected Patients</h3>
          {patients.length === 0 ? (
            <p className="no-patients">No patients detected</p>
          ) : (
            <div className="patients-list">
              {patients.map(patient => {
                // const decision = triageDecisions.get(patient.id); // COMMENTED OUT FOR NOW
                return (
                  <div
                    key={patient.id}
                    className="patient-card"
                  >
                    <div className="patient-header">
                      <span className="patient-id">{patient.id}</span>
                      <span className="triage-badge DETECTED">
                        DETECTED
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
                      
                      {/* {decision && (
                        <div className="detail-row">
                          <span>Reason:</span>
                          <span className="reason-text">{decision.reason}</span>
                        </div>
                      )} */}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
  );
};

export default CameraAnalysis;
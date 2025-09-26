import React, { useCallback, useEffect, useRef, useState } from 'react';
// import { usePerception } from '../hooks/usePerception';
import { drawAllOverlays, DrawContext } from '../utils/draw';
import { PatientState, TriageDecision } from '../types';
import { PoseLandmarker, FilesetResolver, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';

const VideoUploadAnalysis: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fps, setFps] = useState(0);
  const [status, setStatus] = useState('Select a video file to analyze');
  const [eventLog, setEventLog] = useState<any[]>([]);

  // Refs for DOM elements
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Refs for animation and throttling
  const animationIdRef = useRef<number | null>(null);
  const lastFrameTimeRef = useRef<number>(0);
  const fpsBufferRef = useRef<number[]>([]);
  const lastStateUpdateRef = useRef<number>(0);
  const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detection model refs
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const cocoSsdModelRef = useRef<cocoSsd.CocoSsd | null>(null);
  const lastDetectionTimeRef = useRef<number>(0);
  const trackedPersonsRef = useRef<Map<string, PatientState>>(new Map());
  const nextTrackIdRef = useRef<number>(0);

  // Custom hooks - COMMENTED OUT FOR NOW
  // const { patients, isProcessing, error: perceptionError, startDetection, stopDetection } = usePerception(videoRef.current);
  
  // Mock detection state for now
  const [patients, setPatients] = useState<PatientState[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [perceptionError, setPerceptionError] = useState<string | null>(null);
  
  const startDetection = useCallback(() => {
    setIsProcessing(true);
    setPerceptionError(null);
  }, []);
  
  const stopDetection = useCallback(() => {
    setIsProcessing(false);
    setPatients([]);
    trackedPersonsRef.current.clear();
    nextTrackIdRef.current = 0;
  }, []);

  // Initialize MediaPipe Pose Landmarker
  const initializeMediaPipe = useCallback(async () => {
    try {
      console.log('🔍 Initializing MediaPipe Pose Landmarker for video analysis...');
      const filesetResolver = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      
      // Try GPU first, fallback to CPU
      let poseLandmarker;
      try {
        console.log('🎮 Attempting GPU initialization...');
        poseLandmarker = await PoseLandmarker.create(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/blaze_pose_heavy.task`,
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numPoses: 2, // Detect up to 2 people
        });
        console.log('✅ MediaPipe Pose Landmarker initialized with GPU');
      } catch (gpuError) {
        console.log('⚠️ GPU failed, trying CPU...', gpuError);
        poseLandmarker = await PoseLandmarker.create(filesetResolver, {
          baseOptions: {
            modelAssetPath: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/blaze_pose_heavy.task`,
            delegate: "CPU"
          },
          runningMode: "VIDEO",
          numPoses: 2,
        });
        console.log('✅ MediaPipe Pose Landmarker initialized with CPU');
      }
      
      poseLandmarkerRef.current = poseLandmarker;
      setPerceptionError(null);
    } catch (error) {
      console.error('❌ Error initializing MediaPipe Pose Landmarker:', error);
      setPerceptionError(`Failed to init MediaPipe: ${error}`);
      // Try TFJS as fallback
      initializeTFJS();
    }
  }, []);

  // Initialize TFJS COCO-SSD as fallback
  const initializeTFJS = useCallback(async () => {
    try {
      console.log('🔍 Initializing TFJS COCO-SSD model as fallback...');
      await tf.ready();
      
      // Check for WebGL support (GPU acceleration)
      const webglSupported = tf.env().get('WEBGL_VERSION') > 0;
      console.log('🎮 WebGL support:', webglSupported);
      
      const model = await cocoSsd.load();
      cocoSsdModelRef.current = model;
      console.log('✅ TFJS COCO-SSD model initialized successfully');
      setPerceptionError(null);
    } catch (error) {
      console.error('❌ Error initializing TFJS COCO-SSD:', error);
      setPerceptionError(`Failed to init TFJS: ${error}`);
    }
  }, []);

  // Calculate IOU between two bounding boxes
  const calculateIOU = useCallback((bbox1: { x: number; y: number; w: number; h: number }, bbox2: { x: number; y: number; w: number; h: number }): number => {
    const x_overlap = Math.max(0, Math.min(bbox1.x + bbox1.w, bbox2.x + bbox2.w) - Math.max(bbox1.x, bbox2.x));
    const y_overlap = Math.max(0, Math.min(bbox1.y + bbox1.h, bbox2.y + bbox2.h) - Math.max(bbox1.y, bbox2.y));
    const intersection_area = x_overlap * y_overlap;

    const area1 = bbox1.w * bbox1.h;
    const area2 = bbox2.w * bbox2.h;
    const union_area = area1 + area2 - intersection_area;

    if (union_area === 0) return 0;
    return intersection_area / union_area;
  }, []);

  // Process MediaPipe results
  const processMediaPipeResults = useCallback((results: PoseLandmarkerResult, timestamp: number): PatientState[] => {
    const detectedPatients: PatientState[] = [];
    if (!results.landmarks || results.landmarks.length === 0) {
      return detectedPatients;
    }

    results.landmarks.forEach((landmarks, index) => {
      // Calculate bounding box from landmarks
      const xs = landmarks.map(lm => lm.x);
      const ys = landmarks.map(lm => lm.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      const bbox = {
        x: minX,
        y: minY,
        w: maxX - minX,
        h: maxY - minY
      };

      // Calculate signal quality (average visibility of key landmarks)
      const signal_q = landmarks.reduce((sum, lm) => sum + (lm.visibility || 0), 0) / landmarks.length;

      // Detector confidence
      const det_conf = results.scores?.[index] || 0.5;

      detectedPatients.push({
        id: `mp_person_${index}`, // Temporary ID for tracking
        bbox,
        rr_bpm: null,
        breathing: null,
        movement: 'unknown',
        signal_q,
        det_conf,
        ts: timestamp,
      });
    });
    return detectedPatients;
  }, []);

  // Process TFJS COCO-SSD results
  const processTFJSResults = useCallback((predictions: cocoSsd.DetectedObject[], timestamp: number): PatientState[] => {
    const detectedPatients: PatientState[] = [];
    predictions.forEach((prediction, index) => {
      if (prediction.class === 'person') {
        const [x, y, width, height] = prediction.bbox;
        const bbox = {
          x: x / 640, // Normalize to video width
          y: y / 360, // Normalize to video height
          w: width / 640,
          h: height / 360
        };

        detectedPatients.push({
          id: `tf_person_${index}`,
          bbox,
          rr_bpm: null,
          breathing: null,
          movement: 'unknown',
          signal_q: prediction.score,
          det_conf: prediction.score,
          ts: timestamp,
        });
      }
    });
    return detectedPatients;
  }, []);

  // Update tracked persons with new detections
  const updateTrackedPersons = useCallback((currentDetections: PatientState[], timestamp: number) => {
    const newTrackedPersons = new Map<string, PatientState>();
    const unmatchedTracks: PatientState[] = [];
    const unmatchedDetections: PatientState[] = [...currentDetections];

    // Try to match existing tracks with new detections
    trackedPersonsRef.current.forEach(track => {
      let bestMatch: PatientState | null = null;
      let bestIou = 0;
      let bestMatchIndex = -1;

      unmatchedDetections.forEach((detection, index) => {
        const iou = calculateIOU(track.bbox, detection.bbox);
        if (iou > bestIou && iou > 0.3) { // IOU threshold for matching
          bestIou = iou;
          bestMatch = detection;
          bestMatchIndex = index;
        }
      });

      if (bestMatch && bestMatchIndex !== -1) {
        // Update existing track
        const updatedTrack = { ...track, ...bestMatch, ts: timestamp };
        newTrackedPersons.set(track.id, updatedTrack);
        unmatchedDetections.splice(bestMatchIndex, 1);
      } else {
        // Keep track for a few frames if not too old
        if (timestamp - track.ts < 1000) { // Keep track for 1 second
          unmatchedTracks.push(track);
        }
      }
    });

    // Add new detections as new tracks
    unmatchedDetections.forEach(detection => {
      const newTrack: PatientState = {
        ...detection,
        id: `person_${nextTrackIdRef.current++}`,
        ts: timestamp,
      };
      newTrackedPersons.set(newTrack.id, newTrack);
    });

    // Re-add unmatched tracks that are still valid
    unmatchedTracks.forEach(track => {
      newTrackedPersons.set(track.id, track);
    });

    trackedPersonsRef.current = newTrackedPersons;
    setPatients(Array.from(newTrackedPersons.values()));
  }, [calculateIOU]);

  // Main detection function
  const detectFrame = useCallback(async () => {
    if (!videoRef.current || videoRef.current.readyState !== 4) {
      console.log('🎥 Video not ready, waiting...');
      animationIdRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    const now = performance.now();
    if (now - lastDetectionTimeRef.current < 500) { // Run at 2 FPS for better performance
      animationIdRef.current = requestAnimationFrame(detectFrame);
      return;
    }
    lastDetectionTimeRef.current = now;

    let currentDetections: PatientState[] = [];

    try {
      console.log('🔍 Running detection...', {
        poseLandmarker: !!poseLandmarkerRef.current,
        cocoSsd: !!cocoSsdModelRef.current,
        videoReady: videoRef.current.readyState,
        videoWidth: videoRef.current.videoWidth,
        videoHeight: videoRef.current.videoHeight
      });

      if (poseLandmarkerRef.current) {
        // MediaPipe detection
        console.log('🎯 Using MediaPipe detection...');
        const poseLandmarkerResult = poseLandmarkerRef.current.detectForVideo(videoRef.current, now);
        currentDetections = processMediaPipeResults(poseLandmarkerResult, now);
        console.log('📊 MediaPipe results:', currentDetections.length, 'detections');
      } else if (cocoSsdModelRef.current) {
        // TFJS COCO-SSD fallback detection
        console.log('🎯 Using TFJS COCO-SSD detection...');
        const predictions = await cocoSsdModelRef.current.detect(videoRef.current);
        currentDetections = processTFJSResults(predictions, now);
        console.log('📊 TFJS results:', currentDetections.length, 'detections');
      } else {
        // No detector available
        console.log('⚠️ No detection model available');
        currentDetections = [];
      }

    } catch (error) {
      console.error('❌ Detection error:', error);
      // Use mock data on error
      currentDetections = [
        {
          id: 'error_person_1',
          bbox: { x: 0.1, y: 0.1, w: 0.4, h: 0.8 },
          rr_bpm: null,
          breathing: null,
          movement: 'unknown',
          signal_q: 0.7,
          det_conf: 0.8,
          ts: now
        }
      ];
    }

    console.log('📊 Final detections:', currentDetections.length, 'people');
    // Update tracked persons
    updateTrackedPersons(currentDetections, now);
    animationIdRef.current = requestAnimationFrame(detectFrame);
  }, [processMediaPipeResults, processTFJSResults, updateTrackedPersons]);

  // Mock WebSocket state for now
  const connected = true;
  const triageDecisions = new Map<string, TriageDecision>();
  const sendPatientState = () => {};
  const sendOverride = () => {};
  const exportLogs = () => {};

  // Handle file selection
  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      console.log('📁 Video file selected:', file.name);
      setSelectedFile(file);
      
      // Create object URL for video
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setStatus(`Video loaded: ${file.name}`);
    } else {
      setStatus('Please select a valid video file');
    }
  }, []);

  // Handle video load
  const handleVideoLoad = useCallback(() => {
    if (videoRef.current) {
      const video = videoRef.current;
      setDuration(video.duration);
      setCurrentTime(0);
      console.log('📹 Video loaded, duration:', video.duration);
    }
  }, []);

  // Handle video time update
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  }, []);

  // Handle play/pause
  const handlePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
        stopDetection();
      } else {
        videoRef.current.play();
        setIsPlaying(true);
        startDetection();
      }
    }
  }, [isPlaying, startDetection, stopDetection]);

  // Handle seek
  const handleSeek = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const seekTime = parseFloat(event.target.value);
      videoRef.current.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  }, []);

  // Handle video end
  const handleVideoEnd = useCallback(() => {
    setIsPlaying(false);
    stopDetection();
    setStatus('Video playback ended');
  }, [stopDetection]);

  // FPS calculation
  const updateFPS = useCallback(() => {
    const now = performance.now();
    if (lastFrameTimeRef.current > 0) {
      const delta = now - lastFrameTimeRef.current;
      if (delta > 0) {
        const currentFps = 1000 / delta;
        fpsBufferRef.current.push(Math.min(Math.max(currentFps, 0), 60));
        if (fpsBufferRef.current.length > 30) {
          fpsBufferRef.current = fpsBufferRef.current.slice(-30);
        }
        const avgFps = fpsBufferRef.current.reduce((sum, fps) => sum + fps, 0) / fpsBufferRef.current.length;
        setFps(avgFps);
      }
    }
    lastFrameTimeRef.current = now;
  }, []);

  // Throttled state update
  const updateThrottledState = useCallback(() => {
    const now = performance.now();
    if (now - lastStateUpdateRef.current > 100) { // Update every 100ms
      lastStateUpdateRef.current = now;
      // Update any throttled state here
    }
  }, []);

  // Animation loop for canvas drawing
  useEffect(() => {
    const animate = () => {
      updateFPS();

      if (canvasRef.current && videoRef.current && isPlaying) {
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

          console.log('🎨 Drawing overlays for', patients.length, 'patients');
          console.log('📊 Patients data:', patients);
          console.log('📐 Canvas size:', canvas.width, 'x', canvas.height);
          console.log('📐 Video size:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight);
          
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

    if (isPlaying && videoRef.current) {
      console.log('🎬 Starting animation loop...');
      animationIdRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationIdRef.current) {
        console.log('⏹️ Stopping animation loop...');
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    };
  }, [isPlaying, patients, triageDecisions, status, updateFPS, updateThrottledState]);

  // Update status
  useEffect(() => {
    const updateStatus = () => {
      if (perceptionError) {
        setStatus(`Error: ${perceptionError}`);
      } else if (!selectedFile) {
        setStatus('Select a video file to analyze');
      } else if (!isPlaying) {
        setStatus('Click play to start analysis');
      } else if (isProcessing) {
        setStatus(`Analyzing video... (${patients.length} patients detected)`);
      } else {
        setStatus('Video ready - Click play to start analysis');
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
  }, [perceptionError, selectedFile, isPlaying, isProcessing, patients.length]);

  // Format time helper
  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Initialize detection models on mount
  useEffect(() => {
    initializeMediaPipe();
  }, [initializeMediaPipe]);

  // Start/stop detection loop
  useEffect(() => {
    if (isPlaying && videoRef.current) {
      console.log('🎬 Starting detection loop...');
      animationIdRef.current = requestAnimationFrame(detectFrame);
    } else {
      if (animationIdRef.current) {
        console.log('⏹️ Stopping detection loop...');
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    }
    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
    };
  }, [isPlaying, detectFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
    };
  }, [videoUrl]);

  return (
    <div className="video-upload-analysis">
      <div className="upload-section">
        <div className="file-input-container">
          <input
            ref={fileInputRef}
            type="file"
            id="video-upload"
            accept="video/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          <label htmlFor="video-upload" className="upload-label">
            <div className="upload-icon">📁</div>
            <div className="upload-text">
              {selectedFile ? `Selected: ${selectedFile.name}` : 'Click to upload video file'}
            </div>
            <div className="upload-subtext">Supports MP4, MOV, AVI formats</div>
          </label>
        </div>

        {selectedFile && (
          <div className="video-controls">
            <button
              onClick={handlePlayPause}
              className={`control-btn ${isPlaying ? 'stop' : 'start'}`}
            >
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>


            <button
              onClick={() => {
                console.log('🧪 Force test overlays...');
                const testPatients = [
                  {
                    id: 'test_1',
                    bbox: { x: 0.1, y: 0.1, w: 0.3, h: 0.6 },
                    rr_bpm: null,
                    breathing: null,
                    movement: 'unknown' as const,
                    signal_q: 0.8,
                    det_conf: 0.9,
                    ts: Date.now()
                  },
                  {
                    id: 'test_2',
                    bbox: { x: 0.6, y: 0.2, w: 0.25, h: 0.5 },
                    rr_bpm: null,
                    breathing: null,
                    movement: 'unknown' as const,
                    signal_q: 0.7,
                    det_conf: 0.85,
                    ts: Date.now()
                  }
                ];
                setPatients(testPatients);
                console.log('📊 Set test patients:', testPatients);
              }}
              className="control-btn start"
            >
              🧪 Test Overlays
            </button>

            <div className="time-display">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        )}
      </div>

      {videoUrl && (
        <>
          <div className="video-panel">
            <div className="video-container">
              <video
                ref={videoRef}
                src={videoUrl}
                className="video-feed"
                onLoadedMetadata={handleVideoLoad}
                onTimeUpdate={handleTimeUpdate}
                onEnded={handleVideoEnd}
                controls={false}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <canvas
                ref={canvasRef}
                className="overlay-canvas"
                style={{ display: isProcessing ? 'block' : 'none' }}
              />
            </div>

            <div className="timeline-container">
              <input
                type="range"
                min="0"
                max={duration || 0}
                value={currentTime}
                onChange={handleSeek}
                className="timeline-slider"
              />
            </div>
          </div>

          <div className="sidebar">
            <div className="patients-panel">
              <h3>Detected Patients</h3>
              {patients.length === 0 ? (
                <p className="no-patients">No patients detected</p>
              ) : (
                <div className="patients-list">
                  {patients.map(patient => (
                    <div key={patient.id} className="patient-card">
                      <div className="patient-header">
                        <span className="patient-id">{patient.id}</span>
                        <span className="triage-badge DETECTED">DETECTED</span>
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="debug-panel">
              <h3>Analysis Info</h3>
              <div className="debug-info">
                <div>Status: {status}</div>
                <div>Patients: {patients.length}</div>
                <div>FPS: {fps.toFixed(1)}</div>
                <div>Time: {formatTime(currentTime)}</div>
                {perceptionError && <div className="error">Error: {perceptionError}</div>}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default VideoUploadAnalysis;

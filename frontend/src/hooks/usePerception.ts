import { useState, useEffect, useRef, useCallback } from 'react';
import { Pose, POSE_CONNECTIONS, POSE_LANDMARKS } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';
import { PatientState, BreathingBuffer, MovementBuffer, PoseLandmarks } from '../types';

export interface PerceptionState {
  patients: PatientState[];
  isProcessing: boolean;
  error: string | null;
}

export const usePerception = (videoElement: HTMLVideoElement | null) => {
  const [perceptionState, setPerceptionState] = useState<PerceptionState>({
    patients: [],
    isProcessing: false,
    error: null
  });

  const poseRef = useRef<Pose | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const breathingBuffersRef = useRef<Map<string, BreathingBuffer>>(new Map());
  const movementBuffersRef = useRef<Map<string, MovementBuffer>>(new Map());
  const lastPositionsRef = useRef<Map<string, { x: number; y: number; timestamp: number }>>(new Map());
  const frameCountRef = useRef(0);

  // Initialize MediaPipe Pose
  const initializePose = useCallback(async () => {
    try {
      const pose = new Pose({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      pose.onResults((results) => {
        processPoseResults(results);
      });

      poseRef.current = pose;
      setPerceptionState(prev => ({ ...prev, error: null }));
    } catch (error) {
      console.error('Error initializing MediaPipe Pose:', error);
      setPerceptionState(prev => ({ ...prev, error: `Failed to initialize pose detection: ${error}` }));
    }
  }, []);

  // Process pose detection results
  const processPoseResults = useCallback((results: any) => {
    if (!results.poseLandmarks) return;

    const currentTime = Date.now();
    const patients: PatientState[] = [];

    // Process each detected person
    results.poseLandmarks.forEach((landmarks: any, index: number) => {
      const personId = `person_${index}`;
      
      // Calculate bounding box
      const xs = landmarks.map((lm: any) => lm.x);
      const ys = landmarks.map((lm: any) => lm.y);
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

      // Calculate signal quality (ROI stability)
      const signal_q = calculateSignalQuality(landmarks);
      
      // Calculate detector confidence
      const det_conf = landmarks.reduce((sum: number, lm: any) => sum + lm.visibility, 0) / landmarks.length;

      // Get chest landmarks for breathing analysis
      const chestLandmarks = getChestLandmarks(landmarks);
      
      // Update breathing buffer
      updateBreathingBuffer(personId, chestLandmarks, currentTime);
      
      // Update movement buffer
      updateMovementBuffer(personId, landmarks, currentTime);

      // Calculate breathing rate
      const { rr_bpm, breathing } = calculateBreathingRate(personId);

      // Calculate movement classification
      const movement = calculateMovement(personId);

      // Create patient state
      const patientState: PatientState = {
        id: personId,
        bbox,
        rr_bpm,
        breathing,
        movement,
        signal_q,
        det_conf,
        ts: currentTime
      };

      patients.push(patientState);
    });

    setPerceptionState(prev => ({ ...prev, patients }));
  }, []);

  // Calculate signal quality based on landmark stability
  const calculateSignalQuality = (landmarks: any[]): number => {
    const visibility = landmarks.map(lm => lm.visibility);
    const avgVisibility = visibility.reduce((sum, v) => sum + v, 0) / visibility.length;
    return Math.min(avgVisibility, 1.0);
  };

  // Get chest landmarks for breathing analysis
  const getChestLandmarks = (landmarks: any[]) => {
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

    return {
      leftShoulder,
      rightShoulder,
      leftHip,
      rightHip,
      center: {
        x: (leftShoulder.x + rightShoulder.x + leftHip.x + rightHip.x) / 4,
        y: (leftShoulder.y + rightShoulder.y + leftHip.y + rightHip.y) / 4
      }
    };
  };

  // Update breathing buffer with chest motion data
  const updateBreathingBuffer = (personId: string, chestLandmarks: any, timestamp: number) => {
    if (!breathingBuffersRef.current.has(personId)) {
      breathingBuffersRef.current.set(personId, {
        timestamps: [],
        values: [],
        maxSize: 150 // 15 seconds at 10Hz
      });
    }

    const buffer = breathingBuffersRef.current.get(personId)!;
    const chestY = chestLandmarks.center.y;

    buffer.timestamps.push(timestamp);
    buffer.values.push(chestY);

    // Keep only last 15 seconds
    if (buffer.timestamps.length > buffer.maxSize) {
      buffer.timestamps.shift();
      buffer.values.shift();
    }
  };

  // Update movement buffer with pose motion data
  const updateMovementBuffer = (personId: string, landmarks: any[], timestamp: number) => {
    if (!movementBuffersRef.current.has(personId)) {
      movementBuffersRef.current.set(personId, {
        timestamps: [],
        velocities: [],
        maxSize: 50 // 5 seconds at 10Hz
      });
    }

    const buffer = movementBuffersRef.current.get(personId)!;
    const lastPosition = lastPositionsRef.current.get(personId);

    if (lastPosition) {
      const timeDiff = (timestamp - lastPosition.timestamp) / 1000; // seconds
      if (timeDiff > 0) {
        // Calculate velocity based on centroid movement
        const currentCentroid = calculateCentroid(landmarks);
        const distance = Math.sqrt(
          Math.pow(currentCentroid.x - lastPosition.x, 2) + 
          Math.pow(currentCentroid.y - lastPosition.y, 2)
        );
        const velocity = distance / timeDiff;

        buffer.timestamps.push(timestamp);
        buffer.velocities.push(velocity);

        // Keep only last 5 seconds
        if (buffer.timestamps.length > buffer.maxSize) {
          buffer.timestamps.shift();
          buffer.velocities.shift();
        }
      }
    }

    // Update last position
    const currentCentroid = calculateCentroid(landmarks);
    lastPositionsRef.current.set(personId, {
      x: currentCentroid.x,
      y: currentCentroid.y,
      timestamp
    });
  };

  // Calculate centroid of pose landmarks
  const calculateCentroid = (landmarks: any[]) => {
    const sum = landmarks.reduce((acc, lm) => ({
      x: acc.x + lm.x,
      y: acc.y + lm.y
    }), { x: 0, y: 0 });

    return {
      x: sum.x / landmarks.length,
      y: sum.y / landmarks.length
    };
  };

  // Calculate breathing rate using FFT
  const calculateBreathingRate = (personId: string): { rr_bpm: number | null; breathing: boolean | null } => {
    const buffer = breathingBuffersRef.current.get(personId);
    if (!buffer || buffer.values.length < 30) { // Need at least 3 seconds of data
      return { rr_bpm: null, breathing: null };
    }

    // Apply band-pass filter (0.1-0.7 Hz)
    const filteredValues = applyBandPassFilter(buffer.values, 0.1, 0.7, 10); // 10Hz sampling rate

    // Calculate FFT
    const fft = calculateFFT(filteredValues);
    const frequencies = fft.frequencies;
    const magnitudes = fft.magnitudes;

    // Find peak in breathing frequency range (0.1-0.7 Hz)
    const breathingRange = frequencies.filter((f, i) => f >= 0.1 && f <= 0.7);
    const breathingMagnitudes = magnitudes.slice(0, breathingRange.length);

    const maxIndex = breathingMagnitudes.indexOf(Math.max(...breathingMagnitudes));
    const peakFreq = breathingRange[maxIndex];
    const rr_bpm = peakFreq * 60;

    // Calculate confidence
    const peakMagnitude = breathingMagnitudes[maxIndex];
    const avgMagnitude = breathingMagnitudes.reduce((sum, mag) => sum + mag, 0) / breathingMagnitudes.length;
    const confidence = peakMagnitude / Math.max(avgMagnitude, 1);

    if (confidence < 0.3) {
      // Low confidence - return breathing presence only
      const amplitude = Math.max(...filteredValues) - Math.min(...filteredValues);
      return {
        rr_bpm: null,
        breathing: amplitude > 0.01 // Threshold for breathing detection
      };
    }

    return {
      rr_bpm: Math.round(rr_bpm),
      breathing: true
    };
  };

  // Calculate movement classification
  const calculateMovement = (personId: string): "purposeful" | "low" | "none" | "unknown" => {
    const buffer = movementBuffersRef.current.get(personId);
    if (!buffer || buffer.velocities.length < 10) {
      return "unknown";
    }

    const avgVelocity = buffer.velocities.reduce((sum, v) => sum + v, 0) / buffer.velocities.length;
    const maxVelocity = Math.max(...buffer.velocities);

    if (avgVelocity > 0.01 && maxVelocity > 0.02) {
      return "purposeful";
    } else if (avgVelocity > 0.005) {
      return "low";
    } else {
      return "none";
    }
  };

  // Simple band-pass filter implementation
  const applyBandPassFilter = (values: number[], lowFreq: number, highFreq: number, sampleRate: number): number[] => {
    // Simplified band-pass filter - in production, use a proper filter library
    return values; // Placeholder - implement proper filtering
  };

  // Simple FFT implementation
  const calculateFFT = (values: number[]): { frequencies: number[]; magnitudes: number[] } => {
    // Simplified FFT - in production, use a proper FFT library
    const n = values.length;
    const frequencies = Array.from({ length: n }, (_, i) => i / n);
    const magnitudes = values.map(v => Math.abs(v));
    
    return { frequencies, magnitudes };
  };

  // Start camera and pose detection
  const startDetection = useCallback(async () => {
    if (!videoElement || !poseRef.current) return;

    try {
      setPerceptionState(prev => ({ ...prev, isProcessing: true, error: null }));

      const camera = new Camera(videoElement, {
        onFrame: async () => {
          if (poseRef.current) {
            await poseRef.current.send({ image: videoElement });
          }
        },
        width: 640,
        height: 360
      });

      cameraRef.current = camera;
      await camera.start();
    } catch (error) {
      console.error('Error starting detection:', error);
      setPerceptionState(prev => ({ ...prev, error: `Failed to start detection: ${error}`, isProcessing: false }));
    }
  }, [videoElement]);

  // Stop detection
  const stopDetection = useCallback(() => {
    if (cameraRef.current) {
      cameraRef.current.stop();
      cameraRef.current = null;
    }
    setPerceptionState(prev => ({ ...prev, isProcessing: false }));
  }, []);

  // Initialize pose detection
  useEffect(() => {
    initializePose();
  }, [initializePose]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    ...perceptionState,
    startDetection,
    stopDetection
  };
};

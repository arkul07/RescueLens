// MediaPipe pose detection and breathing analysis

import { useCallback, useEffect, useRef, useState } from 'react';
import { PatientState, TrackedPerson } from '../types';
import { PersonTracker } from '../utils/track';
import { applyBandPassFilter, calculateFFT, applyEMA, calculatePeakProminence, downsample } from '../utils/filters';

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

  const poseRef = useRef<any>(null);
  const trackerRef = useRef<PersonTracker>(new PersonTracker());
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef<number>(0);

  // Initialize MediaPipe Pose
  const initializePose = useCallback(async () => {
    try {
      console.log('🔍 Initializing MediaPipe Pose...');
      
      // Check if MediaPipe is available
      if (typeof window !== 'undefined' && (window as any).Pose) {
        const { Pose } = (window as any);
        
        const pose = new Pose({
          locateFile: (file: string) => {
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

        pose.onResults((results: any) => {
          processPoseResults(results);
        });

        poseRef.current = pose;
        console.log('✅ MediaPipe Pose initialized successfully');
        setPerceptionState(prev => ({ ...prev, error: null }));
      } else {
        console.log('⚠️ MediaPipe not available, using fallback detection');
        setPerceptionState(prev => ({ ...prev, error: null }));
      }
    } catch (error) {
      console.error('❌ Error initializing MediaPipe Pose:', error);
      console.log('⚠️ Falling back to mock detection');
      setPerceptionState(prev => ({ ...prev, error: null }));
    }
  }, []);

  // Process pose detection results
  const processPoseResults = useCallback((results: any) => {
    if (!results.poseLandmarks) {
      return;
    }

    const currentTime = Date.now();
    const detections = results.poseLandmarks.map((landmarks: any, index: number) => {
      // Calculate bounding box from landmarks
      const xs = landmarks.map((lm: any) => lm.x);
      const ys = landmarks.map((lm: any) => lm.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      return {
        bbox: {
          x: minX,
          y: minY,
          w: maxX - minX,
          h: maxY - minY
        },
        landmarks: landmarks
      };
    });

    // Update tracker
    const trackedPersons = trackerRef.current.update(detections);
    
    // Convert to PatientState array
    const patients: PatientState[] = trackedPersons.map(person => {
      const breathingAnalysis = analyzeBreathing(person);
      const movementAnalysis = analyzeMovement(person);
      
      return {
        id: person.id,
        bbox: person.bbox,
        rr_bpm: breathingAnalysis.rr_bpm,
        breathing: breathingAnalysis.breathing,
        movement: movementAnalysis,
        audio: {
          breathingPresent: null,
          snr: null
        },
        signal_q: calculateSignalQuality(person),
        det_conf: calculateDetectionConfidence(person),
        ts: currentTime
      };
    });

    // Update state (throttled)
    const now = Date.now();
    if (now - lastFrameTimeRef.current > 250) { // 4Hz max
      lastFrameTimeRef.current = now;
      setPerceptionState(prev => ({
        ...prev,
        patients: patients,
        isProcessing: patients.length > 0
      }));
    }
  }, []);

  // Analyze breathing from chest ROI motion
  const analyzeBreathing = (person: TrackedPerson): { rr_bpm: number | null; breathing: boolean | null } => {
    const buffer = person.breathingBuffer;
    
    if (buffer.values.length < 30) { // Need at least 3 seconds of data
      return { rr_bpm: null, breathing: null };
    }

    // Apply band-pass filter (0.1-0.7 Hz)
    const filteredValues = applyBandPassFilter(buffer.values, 0.1, 0.7, 10);

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

  // Analyze movement from centroid velocity
  const analyzeMovement = (person: TrackedPerson): "purposeful" | "low" | "none" | "unknown" => {
    const buffer = person.movementBuffer;
    
    if (buffer.velocities.length < 10) {
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

  // Calculate signal quality based on landmark stability
  const calculateSignalQuality = (person: TrackedPerson): number => {
    if (!person.landmarks) return 0.5;
    
    const visibility = person.landmarks.map(lm => lm.visibility);
    const avgVisibility = visibility.reduce((sum, v) => sum + v, 0) / visibility.length;
    return Math.min(avgVisibility, 1.0);
  };

  // Calculate detection confidence
  const calculateDetectionConfidence = (person: TrackedPerson): number => {
    if (!person.landmarks) return 0.5;
    
    return person.landmarks.reduce((sum, lm) => sum + lm.visibility, 0) / person.landmarks.length;
  };

  // Start detection
  const startDetection = useCallback(async () => {
    if (!videoElement) {
      console.log('🔍 No video element available for detection');
      return;
    }
    
    console.log('🔍 Starting detection...');
    try {
      setPerceptionState(prev => ({ ...prev, isProcessing: true, error: null }));

      if (poseRef.current) {
        // Use MediaPipe detection
        const camera = new (window as any).Camera(videoElement, {
          onFrame: async () => {
            if (poseRef.current) {
              await poseRef.current.send({ image: videoElement });
            }
          },
          width: 640,
          height: 360
        });

        await camera.start();
      } else {
        // Fallback: Create mock patients for testing
        console.log('🔍 Using fallback detection system...');
        
        const mockPatients: PatientState[] = [
          {
            id: 'patient_1',
            bbox: { x: 0.1, y: 0.1, w: 0.4, h: 0.8 },
            rr_bpm: 18,
            breathing: true,
            movement: 'purposeful',
            audio: {
              breathingPresent: true,
              snr: 0.8
            },
            signal_q: 0.9,
            det_conf: 0.95,
            ts: Date.now()
          },
          {
            id: 'patient_2',
            bbox: { x: 0.5, y: 0.2, w: 0.4, h: 0.7 },
            rr_bpm: 35, // High breathing rate - should be RED
            breathing: true,
            movement: 'low',
            audio: {
              breathingPresent: true,
              snr: 0.7
            },
            signal_q: 0.8,
            det_conf: 0.9,
            ts: Date.now()
          }
        ];
        
        console.log(`🔍 Created ${mockPatients.length} mock patients`);
        setPerceptionState(prev => ({ 
          ...prev, 
          patients: mockPatients,
          isProcessing: true
        }));
      }
    } catch (error) {
      console.error('Error starting detection:', error);
      setPerceptionState(prev => ({ ...prev, error: `Failed to start detection: ${error}`, isProcessing: false }));
    }
  }, [videoElement]);

  // Stop detection
  const stopDetection = useCallback(() => {
    console.log('🛑 Stopping detection...');
    setPerceptionState(prev => ({ ...prev, isProcessing: false }));
  }, []);

  // Initialize pose detection
  useEffect(() => {
    initializePose();
  }, [initializePose]);

  return {
    ...perceptionState,
    startDetection,
    stopDetection
  };
};
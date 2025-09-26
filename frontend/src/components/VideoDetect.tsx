import React, { useRef, useCallback, useEffect, useState } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';

// Install: npm i @tensorflow/tfjs @tensorflow-models/coco-ssd

export interface DetectedPerson {
  id: string;
  bbox: { x: number; y: number; w: number; h: number }; // normalized 0-1
  chestROI: { x: number; y: number; w: number; h: number }; // normalized 0-1
  score: number;
  // Medical analysis
  respiratoryRate?: number; // breaths per minute
  heartRate?: number; // beats per minute
  breathingQuality?: 'regular' | 'irregular' | 'labored' | 'absent';
  triageCategory?: 'RED' | 'YELLOW' | 'GREEN' | 'BLACK';
  lastAnalysis?: number; // timestamp
  // Enhanced medical data
  medicalDescription?: string;
  possibleAilments?: string[];
  confidenceScore?: number;
  doctorOverride?: {
    category: 'RED' | 'YELLOW' | 'GREEN' | 'BLACK';
    reason: string;
    timestamp: number;
    doctorName?: string;
  };
}

export interface VideoDetectProps {
  onPersonsDetected?: (persons: DetectedPerson[], video: HTMLVideoElement) => void;
}

const VideoDetect: React.FC<VideoDetectProps> = ({ onPersonsDetected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<cocoSsd.CocoSsd | null>(null);
  const rafRef = useRef<number | null>(null);
  const boxesRef = useRef<DetectedPerson[]>([]);
  const nextIdRef = useRef<number>(0);
  const detectionCountRef = useRef<number>(0);
  
  // Breathing analysis data
  const breathingDataRef = useRef<Map<string, {
    chestPositions: number[];
    timestamps: number[];
    lastAnalysis: number;
    lastMedicalUpdate: number;
  }>>(new Map());
  
  // Track persons currently in frame
  const personsInFrameRef = useRef<Set<string>>(new Set());

  const [isDetecting, setIsDetecting] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Doctor override state
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null);
  const [overrideCategory, setOverrideCategory] = useState<'RED' | 'YELLOW' | 'GREEN' | 'BLACK'>('GREEN');
  const [overrideReason, setOverrideReason] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [detectedPersons, setDetectedPersons] = useState<DetectedPerson[]>([]);

  // Load TensorFlow.js model
  const loadModel = useCallback(async () => {
    try {
      console.log('🔍 Loading COCO-SSD model...');
      console.log('🔍 TensorFlow.js ready state:', tf.getBackend());
      await tf.ready();
      console.log('✅ TensorFlow.js ready');
      
      const model = await cocoSsd.load({
        base: 'lite_mobilenet_v2'
      });
      modelRef.current = model;
      setIsModelLoading(false);
      console.log('✅ COCO-SSD model loaded successfully');
      setError(null);
    } catch (err) {
      console.error('❌ Error loading model:', err);
      setIsModelLoading(false);
      setError(`Failed to load model: ${err}`);
    }
  }, []);

  // Breathing analysis functions
  const analyzeBreathing = useCallback((personId: string, chestROI: { x: number; y: number; w: number; h: number }, timestamp: number) => {
    // Get or create breathing data for this person
    if (!breathingDataRef.current.has(personId)) {
      breathingDataRef.current.set(personId, {
        chestPositions: [],
        timestamps: [],
        lastAnalysis: 0,
        lastMedicalUpdate: 0
      });
    }
    
    const data = breathingDataRef.current.get(personId)!;
    
    // Add chest position (using y-coordinate as proxy for chest movement)
    const chestY = chestROI.y + chestROI.h / 2; // Center of chest ROI
    data.chestPositions.push(chestY);
    data.timestamps.push(timestamp);
    
    // Keep only last 5 seconds of data (assuming 30fps = 150 frames)
    const maxFrames = 150;
    if (data.chestPositions.length > maxFrames) {
      data.chestPositions = data.chestPositions.slice(-maxFrames);
      data.timestamps = data.timestamps.slice(-maxFrames);
    }
    
    // Analyze breathing every 3 seconds
    if (timestamp - data.lastAnalysis > 3000 && data.chestPositions.length > 30) {
      const respiratoryRate = calculateRespiratoryRate(data.chestPositions, data.timestamps);
      const breathingQuality = assessBreathingQuality(data.chestPositions);
      const triageCategory = determineTriageCategory(respiratoryRate, breathingQuality);
      
      data.lastAnalysis = timestamp;
      
      console.log(`🫁 Breathing analysis for ${personId}:`, {
        respiratoryRate,
        breathingQuality,
        triageCategory
      });
      
      return {
        respiratoryRate,
        breathingQuality,
        triageCategory
      };
    }
    
    return null;
  }, []);

  const calculateRespiratoryRate = useCallback((positions: number[], timestamps: number[]): number => {
    if (positions.length < 30) return 0;
    
    // Simple peak detection for breathing cycles
    const smoothed = smoothData(positions);
    const peaks = findPeaks(smoothed);
    
    if (peaks.length < 2) return 0;
    
    // Calculate time between peaks
    const timeSpan = (timestamps[timestamps.length - 1] - timestamps[0]) / 1000; // seconds
    const cycles = peaks.length - 1;
    const rate = (cycles / timeSpan) * 60; // breaths per minute
    
    return Math.round(Math.max(0, Math.min(60, rate))); // Clamp between 0-60
  }, []);

  const assessBreathingQuality = useCallback((positions: number[]): 'regular' | 'irregular' | 'labored' | 'absent' => {
    if (positions.length < 30) return 'absent';
    
    const smoothed = smoothData(positions);
    const variance = calculateVariance(smoothed);
    const range = Math.max(...smoothed) - Math.min(...smoothed);
    
    // Absent breathing: very low variance and range
    if (variance < 0.001 && range < 0.01) return 'absent';
    
    // Labored breathing: high variance
    if (variance > 0.01) return 'labored';
    
    // Irregular breathing: medium variance
    if (variance > 0.005) return 'irregular';
    
    return 'regular';
  }, []);

  const determineTriageCategory = useCallback((rr: number, quality: string): 'RED' | 'YELLOW' | 'GREEN' | 'BLACK' => {
    // START/SALT triage rules based on respiratory rate
    if (quality === 'absent') return 'BLACK';
    if (rr === 0) return 'BLACK';
    if (rr < 8 || rr > 30) return 'RED'; // Critical respiratory rate
    if (rr < 12 || rr > 20) return 'YELLOW'; // Abnormal but not critical
    return 'GREEN'; // Normal respiratory rate
  }, []);

  // Generate medical description and possible ailments
  const generateMedicalDescription = useCallback((rr: number, quality: string, category: string) => {
    const descriptions = {
      'RED': {
        description: `Critical respiratory distress detected. Patient shows ${quality} breathing pattern with respiratory rate of ${rr} BPM, indicating severe respiratory compromise.`,
        ailments: ['Respiratory failure', 'Severe asthma attack', 'Pneumonia', 'Pulmonary edema', 'Shock'],
        confidence: 0.85
      },
      'YELLOW': {
        description: `Moderate respiratory abnormality detected. Patient shows ${quality} breathing pattern with respiratory rate of ${rr} BPM, requiring medical attention.`,
        ailments: ['Mild respiratory distress', 'Bronchitis', 'Anxiety-induced hyperventilation', 'Mild asthma', 'Dehydration'],
        confidence: 0.75
      },
      'GREEN': {
        description: `Normal respiratory function detected. Patient shows ${quality} breathing pattern with respiratory rate of ${rr} BPM, indicating stable respiratory status.`,
        ailments: ['No immediate respiratory concerns', 'Minor fatigue', 'Normal physiological response'],
        confidence: 0.90
      },
      'BLACK': {
        description: `No respiratory activity detected. Patient shows ${quality} breathing pattern with respiratory rate of ${rr} BPM, indicating potential respiratory arrest.`,
        ailments: ['Respiratory arrest', 'Cardiac arrest', 'Severe trauma', 'Drug overdose', 'Hypothermia'],
        confidence: 0.95
      }
    };

    return descriptions[category as keyof typeof descriptions] || descriptions['GREEN'];
  }, []);

  // Doctor override functions
  const handleDoctorOverride = useCallback((personId: string) => {
    const override = {
      category: overrideCategory,
      reason: overrideReason,
      timestamp: Date.now(),
      doctorName: doctorName || 'Dr. Unknown'
    };

    setDetectedPersons(prev => prev.map(person => 
      person.id === personId 
        ? { ...person, doctorOverride: override }
        : person
    ));

    console.log(`🏥 Doctor override applied to ${personId}:`, override);
    
    // Reset override form
    setSelectedPerson(null);
    setOverrideReason('');
  }, [overrideCategory, overrideReason, doctorName]);

  const clearOverride = useCallback((personId: string) => {
    setDetectedPersons(prev => prev.map(person => 
      person.id === personId 
        ? { ...person, doctorOverride: undefined }
        : person
    ));
  }, []);

  // Helper functions
  const smoothData = (data: number[]): number[] => {
    const smoothed = [];
    for (let i = 1; i < data.length - 1; i++) {
      smoothed.push((data[i-1] + data[i] + data[i+1]) / 3);
    }
    return smoothed;
  };

  const findPeaks = (data: number[]): number[] => {
    const peaks = [];
    for (let i = 1; i < data.length - 1; i++) {
      if (data[i] > data[i-1] && data[i] > data[i+1]) {
        peaks.push(i);
      }
    }
    return peaks;
  };

  const calculateVariance = (data: number[]): number => {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const variance = data.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / data.length;
    return variance;
  };

  // Handle video file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !videoRef.current) return;

    // Cleanup previous video
    if (videoRef.current.src) {
      URL.revokeObjectURL(videoRef.current.src);
    }

    // Create new video URL
    const videoUrl = URL.createObjectURL(file);
    videoRef.current.src = videoUrl;
    videoRef.current.load();

    console.log('📹 Video file loaded:', file.name);
    
    // Reset video loaded state
    setIsVideoLoaded(false);
    
    // Add event listeners to track video loading
    const video = videoRef.current;
    
    const handleLoadedMetadata = () => {
      console.log('📹 Video metadata loaded:', {
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration
      });
      setIsVideoLoaded(true);
      console.log('✅ Video loaded state set to true');
    };
    
    const handleCanPlay = () => {
      console.log('📹 Video can play');
    };

    const handlePlay = () => {
      setIsVideoPlaying(true);
      console.log('▶️ Video started playing');
    };

    const handlePause = () => {
      setIsVideoPlaying(false);
      // Clear all analyses when video is paused (people appear dead)
      setDetectedPersons([]);
      breathingDataRef.current.clear();
      personsInFrameRef.current.clear();
      console.log('⏸️ Video paused - cleared all analyses (people appear dead)');
    };

    const handleEnded = () => {
      setIsVideoPlaying(false);
      // Clear all analyses when video ends
      setDetectedPersons([]);
      breathingDataRef.current.clear();
      personsInFrameRef.current.clear();
      console.log('🏁 Video ended - cleared all analyses');
    };
    
    // Remove any existing listeners first
    video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    video.removeEventListener('canplay', handleCanPlay);
    video.removeEventListener('play', handlePlay);
    video.removeEventListener('pause', handlePause);
    video.removeEventListener('ended', handleEnded);
    
    // Add new listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);
    
    // Also try to set loaded state after a short delay as backup
    setTimeout(() => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        console.log('📹 Backup: Video dimensions detected, setting loaded state');
        setIsVideoLoaded(true);
      }
    }, 1000);
  }, []);

  // Start/stop detection
  const startDetection = useCallback(async () => {
    if (!modelRef.current) {
      console.log('⚠️ Model not loaded yet');
      return;
    }

    if (!isVideoLoaded) {
      console.log('⚠️ No video loaded yet');
      return;
    }

    // Start video playback
    console.log('▶️ Starting video playback...');
    try {
      await videoRef.current.play();
      console.log('✅ Video playback started');
    } catch (err) {
      console.error('❌ Error playing video:', err);
      setError(`Failed to play video: ${err}`);
      return;
    }

    setIsDetecting(true);
    console.log('🎯 Starting person detection...');
    
    // Force canvas to be visible and sized
    if (canvasRef.current && videoRef.current) {
      canvasRef.current.style.display = 'block';
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      console.log('🎨 Canvas made visible and sized');
    }

    // Start detection loop
    const runDetection = async () => {
      if (!modelRef.current || !videoRef.current || !canvasRef.current) return;
      
      // Only run detection when video is actually playing
      if (videoRef.current.paused || videoRef.current.ended) {
        return;
      }
      
      try {
        const predictions = await modelRef.current.detect(videoRef.current);
        console.log('🔍 Detection results:', predictions);
        
        // Draw results on canvas
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
        // Track persons currently detected in this frame
        const currentFramePersons = new Set<string>();
        
        // Draw person detections with medical analysis
        predictions.forEach((pred, i) => {
          if (pred.class === 'person' && pred.score > 0.4) {
            const [x, y, w, h] = pred.bbox;
            const personId = `person_${i}`;
            
            // Add to current frame persons
            currentFramePersons.add(personId);
            
            // Calculate chest ROI (upper third of bounding box)
            const chestROI = {
              x: x / videoRef.current.videoWidth,
              y: y / videoRef.current.videoHeight,
              w: w / videoRef.current.videoWidth,
              h: (h / videoRef.current.videoHeight) / 3 // Upper third
            };
            
            // Analyze breathing
            const breathingAnalysis = analyzeBreathing(personId, chestROI, Date.now());
            
            // Generate medical description if we have analysis (throttled to every 3 seconds)
            let medicalData = null;
            if (breathingAnalysis) {
              const data = breathingDataRef.current.get(personId);
              const now = Date.now();
              
              // Only update medical description every 3 seconds
              if (data && now - data.lastMedicalUpdate > 3000) {
                medicalData = generateMedicalDescription(
                  breathingAnalysis.respiratoryRate,
                  breathingAnalysis.breathingQuality,
                  breathingAnalysis.triageCategory
                );
                data.lastMedicalUpdate = now;
              }
            }
            
            // Update detected persons with medical data
            setDetectedPersons(prev => {
              const existing = prev.find(p => p.id === personId);
              if (existing && breathingAnalysis && medicalData) {
                return prev.map(p => p.id === personId ? {
                  ...p,
                  respiratoryRate: breathingAnalysis.respiratoryRate,
                  breathingQuality: breathingAnalysis.breathingQuality,
                  triageCategory: breathingAnalysis.triageCategory,
                  medicalDescription: medicalData.description,
                  possibleAilments: medicalData.ailments,
                  confidenceScore: medicalData.confidence,
                  lastAnalysis: Date.now()
                } : p);
              } else if (!existing && breathingAnalysis && medicalData) {
                return [...prev, {
                  id: personId,
                  bbox: { x: x / videoRef.current.videoWidth, y: y / videoRef.current.videoHeight, w: w / videoRef.current.videoWidth, h: h / videoRef.current.videoHeight },
                  chestROI,
                  score: pred.score,
                  respiratoryRate: breathingAnalysis.respiratoryRate,
                  breathingQuality: breathingAnalysis.breathingQuality,
                  triageCategory: breathingAnalysis.triageCategory,
                  medicalDescription: medicalData.description,
                  possibleAilments: medicalData.ailments,
                  confidenceScore: medicalData.confidence,
                  lastAnalysis: Date.now()
                }];
              }
              return prev;
            });
            
            // Determine overlay color based on triage category (consider doctor override)
            const person = detectedPersons.find(p => p.id === personId);
            const finalCategory = person?.doctorOverride?.category || breathingAnalysis?.triageCategory || 'GREEN';
            
            let overlayColor = '#00ff00'; // Default green
            let triageText = 'GREEN';
            
            switch (finalCategory) {
              case 'RED':
                overlayColor = '#ff0000';
                triageText = 'RED';
                break;
              case 'YELLOW':
                overlayColor = '#ffff00';
                triageText = 'YELLOW';
                break;
              case 'BLACK':
                overlayColor = '#000000';
                triageText = 'BLACK';
                break;
              default:
                overlayColor = '#00ff00';
                triageText = 'GREEN';
            }
            
            // Draw bounding box with triage color
            ctx.strokeStyle = overlayColor;
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, w, h);
            
            // Draw chest ROI
            const chestX = chestROI.x * videoRef.current.videoWidth;
            const chestY = chestROI.y * videoRef.current.videoHeight;
            const chestW = chestROI.w * videoRef.current.videoWidth;
            const chestH = chestROI.h * videoRef.current.videoHeight;
            
            ctx.strokeStyle = '#ff0000';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.strokeRect(chestX, chestY, chestW, chestH);
            ctx.setLineDash([]);
            
            // Draw triage label
            ctx.fillStyle = overlayColor;
            ctx.fillRect(x, y - 30, 200, 30);
            ctx.fillStyle = overlayColor === '#000000' ? '#ffffff' : '#000000';
            ctx.font = 'bold 14px Arial';
            
            let labelText = `${triageText}`;
            if (breathingAnalysis) {
              labelText += ` RR:${breathingAnalysis.respiratoryRate || 'N/A'}`;
            }
            
            ctx.fillText(labelText, x + 5, y - 10);
          }
        });
        
        // Remove persons who are no longer in frame
        const previousFramePersons = personsInFrameRef.current;
        const personsToRemove = new Set<string>();
        
        // Find persons who were in previous frame but not in current frame
        previousFramePersons.forEach(personId => {
          if (!currentFramePersons.has(personId)) {
            personsToRemove.add(personId);
          }
        });
        
        // Remove persons who went out of frame
        if (personsToRemove.size > 0) {
          setDetectedPersons(prev => prev.filter(person => !personsToRemove.has(person.id)));
          
          // Clean up breathing data for removed persons
          personsToRemove.forEach(personId => {
            breathingDataRef.current.delete(personId);
          });
          
          console.log(`👥 Removed ${personsToRemove.size} persons who went out of frame:`, Array.from(personsToRemove));
        }
        
        // Update persons in frame reference
        personsInFrameRef.current = currentFramePersons;
        }
      } catch (err) {
        console.error('❌ Detection error:', err);
      }
    };

    // Run detection continuously
    const detectionLoop = () => {
      runDetection();
      rafRef.current = requestAnimationFrame(detectionLoop);
    };
    
    detectionLoop();
  }, [isVideoLoaded, isDetecting]);

  const stopDetection = useCallback(() => {
    setIsDetecting(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    
    // Clear all persons and breathing data when detection stops
    setDetectedPersons([]);
    breathingDataRef.current.clear();
    personsInFrameRef.current.clear();
    
    console.log('⏹️ Stopped person detection - cleared all persons');
  }, []);


  // Set canvas size to match video
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) return;

    const updateCanvasSize = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        console.log(`📐 Canvas resized to ${video.videoWidth}x${video.videoHeight}`);
      }
    };

    video.addEventListener('loadedmetadata', updateCanvasSize);
    video.addEventListener('resize', updateCanvasSize);

    return () => {
      video.removeEventListener('loadedmetadata', updateCanvasSize);
      video.removeEventListener('resize', updateCanvasSize);
    };
  }, []);

  // Load model on mount
  useEffect(() => {
    loadModel();
  }, [loadModel]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (videoRef.current?.src) {
        URL.revokeObjectURL(videoRef.current.src);
      }
    };
  }, []);

  return (
    <div className="video-detect">
      <div className="video-container">
        <video
          ref={videoRef}
          className="video-element"
          controls
          muted
          playsInline
          autoPlay={false}
          loop={false}
        />
        <canvas
          ref={canvasRef}
          className="overlay-canvas"
          style={{ 
            display: isDetecting ? 'block' : 'none',
            position: 'absolute',
            top: 0,
            left: 0,
            zIndex: 10
          }}
        />
      </div>

      <div className="controls">
        <input
          type="file"
          accept="video/*"
          onChange={handleFileUpload}
          className="file-input"
        />
        
        <button
          onClick={startDetection}
          disabled={isModelLoading || isDetecting || !isVideoLoaded}
          className="control-btn start"
        >
          {isModelLoading ? '⏳ Loading Model...' : 
           !isVideoLoaded ? '📹 Upload Video First' :
           isDetecting ? '🎯 Detecting...' : '▶️ Start Detection'}
        </button>

        <button
          onClick={stopDetection}
          disabled={!isDetecting}
          className="control-btn stop"
        >
          ⏹️ Stop Detection
        </button>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      {/* Medical Analysis Panel */}
      {detectedPersons.length > 0 && (
        <div className="medical-panel">
          <h3>🏥 Medical Analysis</h3>
          <div className="patients-list">
            {detectedPersons.map(person => (
              <div key={person.id} className="patient-card">
                <div className="patient-header">
                  <span className="patient-id">{person.id}</span>
                  <span className={`triage-badge ${person.doctorOverride?.category || person.triageCategory || 'GREEN'}`}>
                    {person.doctorOverride?.category || person.triageCategory || 'GREEN'}
                  </span>
                  {person.doctorOverride && (
                    <span className="override-indicator">👨‍⚕️ Override</span>
                  )}
                </div>
                
                <div className="medical-details">
                  <div className="vital-signs">
                    <div className="vital-item">
                      <span>Respiratory Rate:</span>
                      <span className="vital-value">{person.respiratoryRate || 'N/A'} BPM</span>
                    </div>
                    <div className="vital-item">
                      <span>Breathing Quality:</span>
                      <span className="vital-value">{person.breathingQuality || 'Unknown'}</span>
                    </div>
                    <div className="vital-item">
                      <span>Confidence:</span>
                      <span className="vital-value">{Math.round((person.confidenceScore || 0) * 100)}%</span>
                    </div>
                  </div>
                  
                  {person.medicalDescription && (
                    <div className="medical-description">
                      <h4>📋 Medical Assessment:</h4>
                      <p>{person.medicalDescription}</p>
                    </div>
                  )}
                  
                  {person.possibleAilments && person.possibleAilments.length > 0 && (
                    <div className="possible-ailments">
                      <h4>🔍 Possible Conditions:</h4>
                      <ul>
                        {person.possibleAilments.map((ailment, index) => (
                          <li key={index}>{ailment}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {person.doctorOverride && (
                    <div className="doctor-override">
                      <h4>👨‍⚕️ Doctor Override:</h4>
                      <p><strong>Category:</strong> {person.doctorOverride.category}</p>
                      <p><strong>Reason:</strong> {person.doctorOverride.reason}</p>
                      <p><strong>Doctor:</strong> {person.doctorOverride.doctorName}</p>
                      <p><strong>Time:</strong> {new Date(person.doctorOverride.timestamp).toLocaleTimeString()}</p>
                    </div>
                  )}
                  
                  <div className="patient-actions">
                    <button
                      onClick={() => setSelectedPerson(person.id)}
                      className="action-btn override"
                    >
                      👨‍⚕️ Override AI
                    </button>
                    {person.doctorOverride && (
                      <button
                        onClick={() => clearOverride(person.id)}
                        className="action-btn clear"
                      >
                        🗑️ Clear Override
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Doctor Override Modal */}
      {selectedPerson && (
        <div className="override-modal">
          <div className="override-content">
            <h3>👨‍⚕️ Doctor Override</h3>
            <div className="override-form">
              <div className="form-group">
                <label>Doctor Name:</label>
                <input
                  type="text"
                  value={doctorName}
                  onChange={(e) => setDoctorName(e.target.value)}
                  placeholder="Enter doctor name"
                />
              </div>
              
              <div className="form-group">
                <label>Triage Category:</label>
                <select
                  value={overrideCategory}
                  onChange={(e) => setOverrideCategory(e.target.value as any)}
                >
                  <option value="GREEN">🟢 GREEN - Minor/Minimal</option>
                  <option value="YELLOW">🟡 YELLOW - Delayed</option>
                  <option value="RED">🔴 RED - Immediate</option>
                  <option value="BLACK">⚫ BLACK - Deceased/Expectant</option>
                </select>
              </div>
              
              <div className="form-group">
                <label>Override Reason:</label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why you're overriding the AI assessment..."
                  rows={3}
                />
              </div>
              
              <div className="form-actions">
                <button
                  onClick={() => handleDoctorOverride(selectedPerson)}
                  className="action-btn apply"
                >
                  ✅ Apply Override
                </button>
                <button
                  onClick={() => setSelectedPerson(null)}
                  className="action-btn cancel"
                >
                  ❌ Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="status">
        Model: {isModelLoading ? '⏳ Loading...' : modelRef.current ? '✅ Loaded' : '❌ Failed'}
        <br />
        Detection: {isDetecting ? '🎯 Active' : '⏸️ Stopped'}
        <br />
        Persons: {boxesRef.current.length}
        <br />
        Video: {isVideoLoaded ? '📹 Loaded' : '❌ No Video'}
      </div>
    </div>
  );
};

export default VideoDetect;

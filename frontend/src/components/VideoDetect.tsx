import React, { useRef, useCallback, useEffect, useState } from 'react';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';

// Install: npm i @tensorflow/tfjs @tensorflow-models/coco-ssd

export interface DetectedPerson {
  id: string;
  bbox: { x: number; y: number; w: number; h: number }; // normalized 0-1
  chestROI: { x: number; y: number; w: number; h: number }; // normalized 0-1
  score: number;
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

  const [isDetecting, setIsDetecting] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    
    // Remove any existing listeners first
    video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    video.removeEventListener('canplay', handleCanPlay);
    
    // Add new listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    
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
      
      try {
        const predictions = await modelRef.current.detect(videoRef.current);
        console.log('🔍 Detection results:', predictions);
        
        // Draw results on canvas
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          // Draw person detections
          predictions.forEach((pred, i) => {
            if (pred.class === 'person' && pred.score > 0.4) {
              const [x, y, w, h] = pred.bbox;
              ctx.strokeStyle = '#00ff00';
              ctx.lineWidth = 3;
              ctx.strokeRect(x, y, w, h);
              
              // Draw label
              ctx.fillStyle = '#00ff00';
              ctx.fillRect(x, y - 25, 150, 25);
              ctx.fillStyle = '#000000';
              ctx.font = 'bold 14px Arial';
              ctx.fillText(`Person ${i+1} (${(pred.score*100).toFixed(0)}%)`, x + 5, y - 8);
            }
          });
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
    console.log('⏹️ Stopped person detection');
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

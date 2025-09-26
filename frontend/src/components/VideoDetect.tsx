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

  const [isDetecting, setIsDetecting] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(true);
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

  // Detection loop
  const detectFrame = useCallback(async () => {
    if (!modelRef.current || !videoRef.current || !canvasRef.current) {
      rafRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx || video.readyState < 2 || video.videoWidth === 0) {
      rafRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    try {
      // Run detection
      const predictions = await modelRef.current.detect(video);
      
      // Filter for persons with score > 0.4
      const personDetections = predictions.filter(
        pred => pred.class === 'person' && pred.score > 0.4
      );

      // Convert to normalized coordinates and create DetectedPerson objects
      const detectedPersons: DetectedPerson[] = personDetections.map((pred, index) => {
        const [x, y, width, height] = pred.bbox;
        const normalizedBbox = {
          x: x / video.videoWidth,
          y: y / video.videoHeight,
          w: width / video.videoWidth,
          h: height / video.videoHeight
        };

        // Chest ROI is upper third of the bounding box
        const chestROI = {
          x: normalizedBbox.x,
          y: normalizedBbox.y,
          w: normalizedBbox.w,
          h: normalizedBbox.h / 3
        };

        return {
          id: `person_${nextIdRef.current + index}`,
          bbox: normalizedBbox,
          chestROI,
          score: pred.score
        };
      });

      // Update next ID
      nextIdRef.current += personDetections.length;

      // Store for drawing
      boxesRef.current = detectedPersons;

      // Callback
      if (onPersonsDetected) {
        onPersonsDetected(detectedPersons, video);
      }

      // Draw on canvas
      drawBoxes(ctx, detectedPersons, video.videoWidth, video.videoHeight);

    } catch (err) {
      console.error('❌ Detection error:', err);
    }

    rafRef.current = requestAnimationFrame(detectFrame);
  }, [onPersonsDetected]);

  // Draw bounding boxes and labels
  const drawBoxes = useCallback((
    ctx: CanvasRenderingContext2D,
    persons: DetectedPerson[],
    videoWidth: number,
    videoHeight: number
  ) => {
    // Clear canvas
    ctx.clearRect(0, 0, videoWidth, videoHeight);

    persons.forEach(person => {
      // Convert normalized coordinates to pixel coordinates
      const x = person.bbox.x * videoWidth;
      const y = person.bbox.y * videoHeight;
      const w = person.bbox.w * videoWidth;
      const h = person.bbox.h * videoHeight;

      // Draw bounding box
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, w, h);

      // Draw chest ROI
      const chestX = person.chestROI.x * videoWidth;
      const chestY = person.chestROI.y * videoHeight;
      const chestW = person.chestROI.w * videoWidth;
      const chestH = person.chestROI.h * videoHeight;

      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(chestX, chestY, chestW, chestH);
      ctx.setLineDash([]);

      // Draw label background
      const labelY = y - 5;
      const labelHeight = 20;
      ctx.fillStyle = '#00ff00';
      ctx.fillRect(x, labelY - labelHeight, w, labelHeight);

      // Draw label text
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(
        `Person ${person.id} (${(person.score * 100).toFixed(0)}%)`,
        x + 5,
        labelY - 8
      );
    });
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
  }, []);

  // Start/stop detection
  const startDetection = useCallback(() => {
    if (!modelRef.current) {
      console.log('⚠️ Model not loaded yet');
      return;
    }

    if (!videoRef.current?.src) {
      console.log('⚠️ No video loaded yet');
      return;
    }

    setIsDetecting(true);
    console.log('🎯 Starting person detection...');
  }, []);

  const stopDetection = useCallback(() => {
    setIsDetecting(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    console.log('⏹️ Stopped person detection');
  }, []);

  // Start detection loop when enabled
  useEffect(() => {
    if (isDetecting && modelRef.current) {
      rafRef.current = requestAnimationFrame(detectFrame);
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [isDetecting, detectFrame]);

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
        />
        <canvas
          ref={canvasRef}
          className="overlay-canvas"
          style={{ display: isDetecting ? 'block' : 'none' }}
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
          disabled={isModelLoading || isDetecting || !videoRef.current?.src}
          className="control-btn start"
        >
          {isModelLoading ? '⏳ Loading Model...' : 
           !videoRef.current?.src ? '📹 Upload Video First' :
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
        Video: {videoRef.current?.src ? '📹 Loaded' : '❌ No Video'}
      </div>
    </div>
  );
};

export default VideoDetect;

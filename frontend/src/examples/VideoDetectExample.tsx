import React from 'react';
import VideoDetect, { DetectedPerson } from '../components/VideoDetect';

// Example usage of VideoDetect component
const VideoDetectExample: React.FC = () => {
  const handlePersonsDetected = (persons: DetectedPerson[], video: HTMLVideoElement) => {
    console.log(`🎯 Detected ${persons.length} persons:`, persons);
    
    // Process each detected person
    persons.forEach(person => {
      console.log(`Person ${person.id}:`, {
        bbox: person.bbox,        // Normalized coordinates (0-1)
        chestROI: person.chestROI, // Upper third of bounding box
        score: person.score        // Detection confidence (0-1)
      });
      
      // Example: Calculate pixel coordinates
      const pixelBbox = {
        x: person.bbox.x * video.videoWidth,
        y: person.bbox.y * video.videoHeight,
        w: person.bbox.w * video.videoWidth,
        h: person.bbox.h * video.videoHeight
      };
      
      console.log(`Pixel coordinates:`, pixelBbox);
    });
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>VideoDetect Component Example</h1>
      <p>Upload a video file and click "Start Detection" to see person detection in action!</p>
      
      <VideoDetect onPersonsDetected={handlePersonsDetected} />
      
      <div style={{ marginTop: '20px', padding: '15px', background: '#f0f0f0', borderRadius: '8px' }}>
        <h3>Features:</h3>
        <ul>
          <li>✅ Video file upload (accept="video/*")</li>
          <li>✅ TensorFlow.js COCO-SSD person detection</li>
          <li>✅ Real-time bounding box overlays</li>
          <li>✅ Chest ROI calculation (upper third)</li>
          <li>✅ Normalized coordinates (0-1)</li>
          <li>✅ Detection confidence scores</li>
          <li>✅ Proper cleanup and memory management</li>
        </ul>
      </div>
    </div>
  );
};

export default VideoDetectExample;

// Media capture and video element management

import { useCallback, useEffect, useRef, useState } from 'react';

export interface MediaState {
  videoStream: MediaStream | null;
  audioStream: MediaStream | null;
  error: string | null;
  isInitialized: boolean;
}

export const useMedia = () => {
  const [mediaState, setMediaState] = useState<MediaState>({
    videoStream: null,
    audioStream: null,
    error: null,
    isInitialized: false
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const initializeMedia = useCallback(async () => {
    try {
      console.log('🎥 Initializing media capture...');
      
      // Get video stream
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: 640,
          height: 360,
          facingMode: "environment"
        },
        audio: false // Disable audio for now
      });

      console.log('✅ Video stream acquired');
      
      // Set video stream
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        videoRef.current.play();
      }

      setMediaState(prev => ({
        ...prev,
        videoStream,
        isInitialized: true,
        error: null
      }));

    } catch (error) {
      console.error('❌ Error initializing media:', error);
      setMediaState(prev => ({
        ...prev,
        error: `Failed to initialize media: ${error}`,
        isInitialized: false
      }));
    }
  }, []);

  const stopMedia = useCallback(() => {
    console.log('🛑 Stopping media streams...');
    
    if (mediaState.videoStream) {
      mediaState.videoStream.getTracks().forEach(track => track.stop());
    }
    
    if (mediaState.audioStream) {
      mediaState.audioStream.getTracks().forEach(track => track.stop());
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Clear the video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.pause();
    }

    setMediaState({
      videoStream: null,
      audioStream: null,
      error: null,
      isInitialized: false
    });
  }, [mediaState.videoStream, mediaState.audioStream]);

  const getAudioData = useCallback(() => {
    // Placeholder for audio analysis
    return {
      breathingPresent: null,
      snr: null
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMedia();
    };
  }, [stopMedia]);

  return {
    ...mediaState,
    videoRef,
    initializeMedia,
    stopMedia,
    getAudioData
  };
};
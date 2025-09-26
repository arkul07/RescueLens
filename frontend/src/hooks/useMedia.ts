import { useState, useEffect, useRef } from 'react';

export interface MediaState {
  videoStream: MediaStream | null;
  audioStream: MediaStream | null;
  error: string | null;
  loading: boolean;
}

export const useMedia = () => {
  const [mediaState, setMediaState] = useState<MediaState>({
    videoStream: null,
    audioStream: null,
    error: null,
    loading: false
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  const initializeMedia = async () => {
    if (isInitializedRef.current) {
      console.log('📹 Media already initialized, skipping...');
      return;
    }

    isInitializedRef.current = true;
    setMediaState(prev => ({ ...prev, loading: true, error: null }));

    try {
      // Request camera and microphone access ONCE
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 360 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Split into video and audio streams
      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      const videoStream = new MediaStream(videoTracks);
      const audioStream = new MediaStream(audioTracks);

      // Set up video element ONCE
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
        videoRef.current.play().catch(console.error);
      }

      // Set up audio analysis ONCE
      if (audioTracks.length > 0) {
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(audioStream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        source.connect(analyserRef.current);
      }

      setMediaState({
        videoStream,
        audioStream,
        error: null,
        loading: false
      });

    } catch (error) {
      console.error('Error accessing media devices:', error);
      setMediaState(prev => ({
        ...prev,
        error: `Failed to access camera/microphone: ${error}`,
        loading: false
      }));
    }
  };

  const stopMedia = () => {
    if (mediaState.videoStream) {
      mediaState.videoStream.getTracks().forEach(track => track.stop());
    }
    if (mediaState.audioStream) {
      mediaState.audioStream.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setMediaState({
      videoStream: null,
      audioStream: null,
      error: null,
      loading: false
    });
    isInitializedRef.current = false;
  };

  const getAudioData = (): { breathingPresent: boolean; snr: number } => {
    if (!analyserRef.current) {
      return { breathingPresent: false, snr: 0 };
    }

    const bufferLength = analyserRef.current.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyserRef.current.getByteFrequencyData(dataArray);

    // Analyze low-frequency band for breathing (0-200 Hz)
    const lowFreqEnd = Math.floor((200 / (audioContextRef.current?.sampleRate || 44100)) * bufferLength);
    let lowFreqSum = 0;
    for (let i = 0; i < lowFreqEnd; i++) {
      lowFreqSum += dataArray[i];
    }
    const lowFreqAvg = lowFreqSum / lowFreqEnd;

    // Calculate SNR (simplified)
    let totalSum = 0;
    for (let i = 0; i < bufferLength; i++) {
      totalSum += dataArray[i];
    }
    const totalAvg = totalSum / bufferLength;
    const snr = lowFreqAvg / Math.max(totalAvg - lowFreqAvg, 1);

    return {
      breathingPresent: lowFreqAvg > 20, // Threshold for breathing detection
      snr: Math.min(snr, 10) // Cap SNR at 10
    };
  };

  useEffect(() => {
    return () => {
      stopMedia();
    };
  }, []);

  return {
    ...mediaState,
    videoRef,
    initializeMedia,
    stopMedia,
    getAudioData
  };
};
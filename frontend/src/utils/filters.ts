// Signal processing utilities for breathing analysis

/**
 * Simple band-pass filter implementation
 * TODO: Replace with proper Butterworth filter for production
 */
export function applyBandPassFilter(
  values: number[], 
  lowFreq: number, 
  highFreq: number, 
  sampleRate: number
): number[] {
  // Simplified band-pass filter - in production, use a proper filter library
  // For now, just return the values (placeholder implementation)
  return values;
}

/**
 * Simple FFT implementation for frequency analysis
 * TODO: Replace with proper FFT library (e.g., fft-js) for production
 */
export function calculateFFT(values: number[]): { frequencies: number[]; magnitudes: number[] } {
  const n = values.length;
  const frequencies = Array.from({ length: n }, (_, i) => i / n);
  const magnitudes = values.map(v => Math.abs(v));
  
  return { frequencies, magnitudes };
}

/**
 * Exponential Moving Average smoothing
 */
export function applyEMA(values: number[], alpha: number = 0.1): number[] {
  if (values.length === 0) return [];
  
  const smoothed = [values[0]];
  for (let i = 1; i < values.length; i++) {
    smoothed.push(alpha * values[i] + (1 - alpha) * smoothed[i - 1]);
  }
  
  return smoothed;
}

/**
 * Calculate peak prominence for confidence scoring
 */
export function calculatePeakProminence(magnitudes: number[], peakIndex: number): number {
  if (peakIndex < 0 || peakIndex >= magnitudes.length) return 0;
  
  const peakValue = magnitudes[peakIndex];
  const leftMin = Math.min(...magnitudes.slice(0, peakIndex));
  const rightMin = Math.min(...magnitudes.slice(peakIndex + 1));
  
  return peakValue - Math.max(leftMin, rightMin);
}

/**
 * Downsample array to target frequency
 */
export function downsample(values: number[], targetFreq: number, currentFreq: number): number[] {
  const ratio = Math.floor(currentFreq / targetFreq);
  if (ratio <= 1) return values;
  
  const downsampled = [];
  for (let i = 0; i < values.length; i += ratio) {
    downsampled.push(values[i]);
  }
  
  return downsampled;
}

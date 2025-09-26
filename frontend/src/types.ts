// TypeScript interfaces for data contracts

export interface PatientState {
  id: string;
  bbox: { x: number; y: number; w: number; h: number }; // normalized 0..1
  rr_bpm?: number | null;
  breathing: boolean | null; // true/false/unknown
  movement: "purposeful" | "low" | "none" | "unknown";
  audio?: {
    distressKeyword?: "help" | "cant_breathe" | "im_ok" | null;
    breathingPresent?: boolean | null;
    snr?: number | null;
  };
  signal_q: number; // 0..1: ROI stability/quality heuristic
  det_conf: number; // 0..1: detector confidence
  ts: number; // epoch ms
}

export interface TriageDecision {
  id: string;
  category: "RED" | "YELLOW" | "GREEN" | "BLACK" | "UNKNOWN";
  confidence: number; // 0..1
  reason: string;
  ts: number;
}

export interface OverrideRequest {
  id: string;
  category: "RED" | "YELLOW" | "GREEN" | "BLACK" | "UNKNOWN";
  reason: string;
  ts: number;
}

// Breathing analysis types
export interface BreathingBuffer {
  values: number[];
  timestamps: number[];
  maxSize: number;
}

export interface MovementBuffer {
  velocities: number[];
  timestamps: number[];
  maxSize: number;
}

export interface PoseLandmarks {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface TrackedPerson {
  id: string;
  bbox: { x: number; y: number; w: number; h: number };
  landmarks?: PoseLandmarks[];
  lastSeen: number;
  breathingBuffer: BreathingBuffer;
  movementBuffer: MovementBuffer;
  centroid: { x: number; y: number };
}
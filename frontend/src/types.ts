// TypeScript interfaces matching the specified data contracts

export interface PatientState {
  id: string;
  bbox: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  rr_bpm?: number | null;
  breathing: boolean | null; // true/false/unknown
  movement: "purposeful" | "low" | "none" | "unknown";
  audio?: {
    distressKeyword?: "help" | "cant_breathe" | "im_ok" | null;
    breathingPresent?: boolean | null;
    snr?: number | null;
  };
  signal_q: number; // 0..1 ROI stability/quality
  det_conf: number; // 0..1 detector confidence
  ts: number; // epoch ms
}

export interface TriageDecision {
  id: string;
  category: "RED" | "YELLOW" | "GREEN" | "BLACK" | "UNKNOWN";
  confidence: number; // 0..1
  reason: string; // e.g., "RR=34; No purposeful movement"
  ts: number;
}

export interface OverrideRequest {
  id: string;
  category: "RED" | "YELLOW" | "GREEN" | "BLACK" | "UNKNOWN";
  reason: string;
  ts: number;
}

export interface EventLogEntry {
  id: string;
  timestamp: number;
  ai: boolean; // true for AI decisions, false for overrides
  patient_id: string;
  category: string;
  confidence: number;
  reason: string;
  override_reason?: string;
}

export interface PoseLandmarks {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export interface BreathingBuffer {
  timestamps: number[];
  values: number[];
  maxSize: number;
}

export interface MovementBuffer {
  timestamps: number[];
  velocities: number[];
  maxSize: number;
}

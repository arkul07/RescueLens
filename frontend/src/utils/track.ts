// Simple IOU-based tracker for stable person IDs

import { TrackedPerson, PatientState } from '../types';

/**
 * Calculate Intersection over Union (IoU) between two bounding boxes
 */
export function calculateIoU(bbox1: { x: number; y: number; w: number; h: number }, 
                           bbox2: { x: number; y: number; w: number; h: number }): number {
  const x1 = Math.max(bbox1.x, bbox2.x);
  const y1 = Math.max(bbox1.y, bbox2.y);
  const x2 = Math.min(bbox1.x + bbox1.w, bbox2.x + bbox2.w);
  const y2 = Math.min(bbox1.y + bbox1.h, bbox2.y + bbox2.h);
  
  if (x2 <= x1 || y2 <= y1) return 0;
  
  const intersection = (x2 - x1) * (y2 - y1);
  const area1 = bbox1.w * bbox1.h;
  const area2 = bbox2.w * bbox2.h;
  const union = area1 + area2 - intersection;
  
  return intersection / union;
}

/**
 * Calculate centroid of bounding box
 */
export function calculateCentroid(bbox: { x: number; y: number; w: number; h: number }): { x: number; y: number } {
  return {
    x: bbox.x + bbox.w / 2,
    y: bbox.y + bbox.h / 2
  };
}

/**
 * Simple IOU-based tracker
 */
export class PersonTracker {
  private trackedPersons: Map<string, TrackedPerson> = new Map();
  private persistentPatients: Map<string, PatientState> = new Map(); // Persistent patient data
  private nextId = 1;
  private maxAge = 30000; // 30 seconds - much longer persistence
  private iouThreshold = 0.3;

  /**
   * Update tracker with new detections
   */
  update(detections: Array<{ bbox: { x: number; y: number; w: number; h: number }; landmarks?: any[] }>): TrackedPerson[] {
    const currentTime = Date.now();
    const activePersons: TrackedPerson[] = [];
    
    // Clean up old tracks
    for (const [id, person] of this.trackedPersons) {
      if (currentTime - person.lastSeen > this.maxAge) {
        this.trackedPersons.delete(id);
      }
    }
    
    // Match new detections to existing tracks
    const usedTracks = new Set<string>();
    
    for (const detection of detections) {
      let bestMatch: { id: string; iou: number } | null = null;
      
      // Find best matching track
      for (const [id, person] of this.trackedPersons) {
        if (usedTracks.has(id)) continue;
        
        const iou = calculateIoU(person.bbox, detection.bbox);
        if (iou > this.iouThreshold && (!bestMatch || iou > bestMatch.iou)) {
          bestMatch = { id, iou };
        }
      }
      
      if (bestMatch) {
        // Update existing track
        const person = this.trackedPersons.get(bestMatch.id)!;
        person.bbox = detection.bbox;
        person.landmarks = detection.landmarks;
        person.lastSeen = currentTime;
        person.centroid = calculateCentroid(detection.bbox);
        usedTracks.add(bestMatch.id);
        activePersons.push(person);
      } else {
        // Create new track
        const newId = `person_${this.nextId++}`;
        const newPerson: TrackedPerson = {
          id: newId,
          bbox: detection.bbox,
          landmarks: detection.landmarks,
          lastSeen: currentTime,
          centroid: calculateCentroid(detection.bbox),
          breathingBuffer: {
            values: [],
            timestamps: [],
            maxSize: 150 // 15 seconds at 10Hz
          },
          movementBuffer: {
            velocities: [],
            timestamps: [],
            maxSize: 50 // 5 seconds at 10Hz
          }
        };
        
        this.trackedPersons.set(newId, newPerson);
        activePersons.push(newPerson);
      }
    }
    
    return activePersons;
  }
  
  /**
   * Get all currently tracked persons
   */
  getActivePersons(): TrackedPerson[] {
    const currentTime = Date.now();
    return Array.from(this.trackedPersons.values())
      .filter(person => currentTime - person.lastSeen <= this.maxAge);
  }

  /**
   * Store persistent patient data
   */
  storePersistentPatient(patient: PatientState): void {
    this.persistentPatients.set(patient.id, patient);
  }

  /**
   * Get persistent patient data
   */
  getPersistentPatient(patientId: string): PatientState | undefined {
    return this.persistentPatients.get(patientId);
  }

  /**
   * Get all persistent patients (including those not currently in frame)
   */
  getAllPersistentPatients(): PatientState[] {
    return Array.from(this.persistentPatients.values());
  }

  /**
   * Update persistent patient data only if they're currently detected
   */
  updatePersistentPatientIfActive(patient: PatientState, isCurrentlyDetected: boolean): void {
    if (isCurrentlyDetected) {
      // Update with new data
      this.persistentPatients.set(patient.id, patient);
    } else {
      // Keep existing data, just update timestamp to show they're still being tracked
      const existing = this.persistentPatients.get(patient.id);
      if (existing) {
        this.persistentPatients.set(patient.id, {
          ...existing,
          ts: Date.now() // Update timestamp but keep old data
        });
      }
    }
  }

  /**
   * Clean up very old persistent patients (older than 5 minutes)
   */
  cleanupOldPersistentPatients(): void {
    const currentTime = Date.now();
    const maxPersistentAge = 300000; // 5 minutes
    
    for (const [id, patient] of this.persistentPatients) {
      if (currentTime - patient.ts > maxPersistentAge) {
        this.persistentPatients.delete(id);
      }
    }
  }
}

// Canvas drawing utilities for patient overlays

import { PatientState, TriageDecision } from '../types';

export interface DrawContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  videoWidth: number;
  videoHeight: number;
}

export const getTriageColor = (category: string): string => {
  switch (category) {
    case 'RED': return '#ff4444';
    case 'YELLOW': return '#ffff00';
    case 'GREEN': return '#00ff00';
    case 'BLACK': return '#000000';
    case 'UNKNOWN': return '#808080';
    default: return '#808080';
  }
};

export const drawPatientOverlay = (
  context: DrawContext,
  patient: PatientState,
  decision?: TriageDecision,
  isCurrentlyDetected: boolean = true
) => {
  const { ctx, videoWidth, videoHeight } = context;

  // Convert normalized coordinates to pixel coordinates
  const x = patient.bbox.x * videoWidth;
  const y = patient.bbox.y * videoHeight;
  const w = patient.bbox.w * videoWidth;
  const h = patient.bbox.h * videoHeight;

  console.log(`🎯 Drawing overlay for ${patient.id}:`, {
    bbox: patient.bbox,
    pixelCoords: { x, y, w, h },
    videoSize: { videoWidth, videoHeight },
    decision: decision,
    isCurrentlyDetected: isCurrentlyDetected,
    category: decision?.category,
    color: color
  });

  // Use the same logic as the text display
  const category = decision?.category || 'UNKNOWN';
  const color = getTriageColor(category);
  const confidence = decision?.confidence || 0;

  // Draw bounding box with enhanced visibility
  ctx.strokeStyle = color;
  ctx.lineWidth = isCurrentlyDetected ? 4 : 2; // Thinner line for out-of-frame patients
  ctx.setLineDash(isCurrentlyDetected ? [] : [5, 5]); // Dashed line for out-of-frame patients
  ctx.strokeRect(x, y, w, h);
  
  // Add a subtle glow effect for better visibility
  ctx.shadowColor = color;
  ctx.shadowBlur = isCurrentlyDetected ? 8 : 4; // Less glow for out-of-frame patients
  ctx.strokeRect(x, y, w, h);
  ctx.shadowBlur = 0;
  ctx.setLineDash([]); // Reset line dash

  // Draw background for text with better contrast
  const textY = y - 5;
  const textHeight = 20;
  ctx.fillStyle = color;
  ctx.fillRect(x, textY - textHeight, w, textHeight);

  // Draw patient ID and category with better contrast
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'left';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 2;
  
  const statusText = isCurrentlyDetected ? `${patient.id} - ${category}` : `${patient.id} - ${category} (OUT OF FRAME)`;
  ctx.strokeText(statusText, x + 5, textY - 8);
  ctx.fillText(statusText, x + 5, textY - 8);

  // Draw confidence with better visibility
  ctx.font = 'bold 11px Arial';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.strokeText(
    `Conf: ${(confidence * 100).toFixed(0)}%`,
    x + 5,
    textY + 2
  );
  ctx.fillText(
    `Conf: ${(confidence * 100).toFixed(0)}%`,
    x + 5,
    textY + 2
  );

  // Draw breathing rate if available
  if (patient.rr_bpm !== null && patient.rr_bpm !== undefined) {
    ctx.strokeText(
      `RR: ${patient.rr_bpm} bpm`,
      x + w - 80,
      textY - 8
    );
    ctx.fillText(
      `RR: ${patient.rr_bpm} bpm`,
      x + w - 80,
      textY - 8
    );
  } else if (patient.breathing !== null) {
    ctx.strokeText(
      patient.breathing ? 'Breathing' : 'No Breathing',
      x + w - 80,
      textY - 8
    );
    ctx.fillText(
      patient.breathing ? 'Breathing' : 'No Breathing',
      x + w - 80,
      textY - 8
    );
  }

  // Draw movement status
  ctx.strokeText(
    `Move: ${patient.movement}`,
    x + w - 80,
    textY + 2
  );
  ctx.fillText(
    `Move: ${patient.movement}`,
    x + w - 80,
    textY + 2
  );

  // Draw reason if available
  if (decision?.reason) {
    const reasonY = y + h + 15;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, reasonY - 12, w, 15);
    
    ctx.fillStyle = 'white';
    ctx.font = '10px Arial';
    ctx.fillText(decision.reason, x + 5, reasonY - 2);
  }
};

export const drawFPS = (context: DrawContext, fps: number) => {
  const { ctx, videoWidth } = context;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(videoWidth - 100, 10, 90, 25);
  
  ctx.fillStyle = '#00ff88';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'right';
  ctx.fillText(`FPS: ${fps.toFixed(1)}`, videoWidth - 10, 25);
};

export const drawStatus = (context: DrawContext, status: string) => {
  const { ctx, videoWidth, videoHeight } = context;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(10, videoHeight - 30, 200, 25);
  
  ctx.fillStyle = 'white';
  ctx.font = '12px Arial';
  ctx.textAlign = 'left';
  ctx.fillText(status, 15, videoHeight - 10);
};

export const clearCanvas = (context: DrawContext) => {
  const { ctx, videoWidth, videoHeight } = context;
  ctx.clearRect(0, 0, videoWidth, videoHeight);
};

export const drawAllOverlays = (
  context: DrawContext,
  patients: PatientState[],
  decisions: Map<string, TriageDecision>,
  fps: number,
  status: string,
  currentlyDetectedIds?: Set<string>
) => {
  clearCanvas(context);
  
  patients.forEach(patient => {
    const decision = decisions.get(patient.id);
    const isCurrentlyDetected = currentlyDetectedIds ? currentlyDetectedIds.has(patient.id) : true;
    drawPatientOverlay(context, patient, decision, isCurrentlyDetected);
  });
  
  drawFPS(context, fps);
  drawStatus(context, status);
};
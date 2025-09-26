"""
FastAPI Backend for RescueLens - Real-time video and audio analysis.

This module provides:
- WebSocket endpoints for real-time communication
- Video processing with perception agent
- Audio processing with audio agent
- Enhanced triage with visual + audio analysis
- Event logging and export
"""

import asyncio
import base64
import cv2
import numpy as np
import time
import json
from typing import Dict, List, Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import uvicorn

# Import our agents
from perception import PerceptionAgent
from triage import TriageAgent
from audio import AudioAgent, AudioAnalysis
from utils import PatientState, TriageDecision, EventLogger, get_triage_color, draw_patient_box, calculate_fps


class RescueLensBackend:
    """Main backend application for RescueLens."""
    
    def __init__(self):
        """Initialize the backend with all agents."""
        self.perception_agent = PerceptionAgent()
        self.triage_agent = TriageAgent()
        self.audio_agent = AudioAgent()
        self.event_logger = EventLogger()
        
        # Application state
        self.current_patients: Dict[str, PatientState] = {}
        self.triage_decisions: Dict[str, TriageDecision] = {}
        self.audio_analysis: Optional[AudioAnalysis] = None
        
        # Analysis state
        self.is_analyzing = False
        self.analysis_interval = 5.0  # seconds
        self.last_analysis_time = 0
        self.fps_counter = []
        
        # Camera state
        self.cap = None
        self.camera_active = False
        
        # WebSocket connections
        self.active_connections: List[WebSocket] = []
        
        print("🚑 RescueLens Backend initialized")
    
    async def connect_websocket(self, websocket: WebSocket):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"📡 WebSocket connected. Total connections: {len(self.active_connections)}")
    
    async def disconnect_websocket(self, websocket: WebSocket):
        """Handle WebSocket disconnection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"📡 WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    async def broadcast_to_clients(self, message: dict):
        """Broadcast message to all connected clients."""
        if not self.active_connections:
            return
        
        # Remove disconnected connections
        active_connections = []
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
                active_connections.append(connection)
            except:
                pass  # Connection is dead
        
        self.active_connections = active_connections
    
    def start_camera(self) -> Dict:
        """Start camera capture."""
        try:
            if self.camera_active:
                return {"status": "success", "message": "Camera already active"}
            
            self.cap = cv2.VideoCapture(0)
            if not self.cap.isOpened():
                return {"status": "error", "message": "Failed to open camera"}
            
            self.camera_active = True
            return {"status": "success", "message": "Camera started successfully"}
            
        except Exception as e:
            return {"status": "error", "message": f"Camera error: {str(e)}"}
    
    def stop_camera(self) -> Dict:
        """Stop camera capture."""
        try:
            if self.cap:
                self.cap.release()
                self.cap = None
            
            self.camera_active = False
            self.current_patients.clear()
            self.triage_decisions.clear()
            
            return {"status": "success", "message": "Camera stopped successfully"}
            
        except Exception as e:
            return {"status": "error", "message": f"Error stopping camera: {str(e)}"}
    
    def start_audio(self) -> Dict:
        """Start audio listening."""
        try:
            if self.audio_agent.start_listening():
                return {"status": "success", "message": "Audio listening started"}
            else:
                return {"status": "error", "message": "Failed to start audio listening"}
                
        except Exception as e:
            return {"status": "error", "message": f"Audio error: {str(e)}"}
    
    def stop_audio(self) -> Dict:
        """Stop audio listening."""
        try:
            self.audio_agent.stop_listening()
            return {"status": "success", "message": "Audio listening stopped"}
            
        except Exception as e:
            return {"status": "error", "message": f"Error stopping audio: {str(e)}"}
    
    def start_analysis(self) -> Dict:
        """Start real-time analysis."""
        try:
            if not self.camera_active:
                return {"status": "error", "message": "Camera not active"}
            
            self.is_analyzing = True
            return {"status": "success", "message": "Analysis started"}
            
        except Exception as e:
            return {"status": "error", "message": f"Analysis error: {str(e)}"}
    
    def stop_analysis(self) -> Dict:
        """Stop real-time analysis."""
        try:
            self.is_analyzing = False
            return {"status": "success", "message": "Analysis stopped"}
            
        except Exception as e:
            return {"status": "error", "message": f"Error stopping analysis: {str(e)}"}
    
    async def process_frame(self) -> Dict:
        """Process a single frame for analysis."""
        try:
            if not self.camera_active or not self.cap:
                return {"status": "error", "message": "Camera not active"}
            
            # Capture frame
            ret, frame = self.cap.read()
            if not ret:
                return {"status": "error", "message": "Failed to capture frame"}
            
            # Calculate FPS
            current_time = time.time()
            self.fps_counter.append(current_time)
            if len(self.fps_counter) > 30:
                self.fps_counter = self.fps_counter[-30:]
            fps = calculate_fps(self.fps_counter) if len(self.fps_counter) > 1 else 0.0
            
            # Process with perception agent
            patient_states = self.perception_agent.process_frame(frame, fps)
            
            # Update current patients
            self.current_patients = {p.id: p for p in patient_states}
            
            # Get audio analysis
            self.audio_analysis = self.audio_agent.analyze_audio()
            
            # Get triage decisions
            new_decisions = {}
            for patient_state in patient_states:
                self.event_logger.log_detection(patient_state)
                decision = self.triage_agent.analyze_patient(patient_state, self.audio_analysis)
                self.event_logger.log_triage_decision(decision)
                new_decisions[patient_state.id] = decision
            
            # Update triage decisions
            self.triage_decisions.update(new_decisions)
            
            # Draw overlays on frame
            overlay_frame = frame.copy()
            for patient_state in patient_states:
                decision = self.triage_decisions.get(patient_state.id)
                if decision:
                    # Get color for triage status
                    color_hex = get_triage_color(decision.final_decision)
                    color_bgr = tuple(int(color_hex[i:i+2], 16) for i in (1, 3, 5))[::-1]
                    
                    # Draw patient box
                    overlay_frame = draw_patient_box(
                        overlay_frame,
                        patient_state.bounding_box,
                        color_bgr,
                        patient_state.id,
                        decision.final_decision,
                        patient_state.breathing_rate,
                        decision.confidence,
                        getattr(patient_state, 'signal_quality', 0.0)
                    )
            
            # Encode frame as base64
            _, buffer = cv2.imencode('.jpg', overlay_frame)
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            
            # Prepare response
            response = {
                "status": "success",
                "frame": frame_base64,
                "patients": [
                    {
                        "id": p.id,
                        "breathing_rate": float(p.breathing_rate),
                        "is_breathing": bool(p.is_breathing),
                        "is_responsive": bool(p.is_responsive),
                        "confidence": float(p.confidence),
                        "bounding_box": [int(x) for x in p.bounding_box]
                    }
                    for p in patient_states
                ],
                "triage_decisions": [
                    {
                        "patient_id": d.patient_id,
                        "ai_suggestion": d.ai_suggestion,
                        "final_decision": d.final_decision,
                        "confidence": float(d.confidence),
                        "reasoning": d.reasoning
                    }
                    for d in new_decisions.values()
                ],
                "audio_analysis": {
                    "keywords_detected": self.audio_analysis.keywords_detected,
                    "distress_score": float(self.audio_analysis.distress_score),
                    "comfort_score": float(self.audio_analysis.comfort_score),
                    "confidence": float(self.audio_analysis.confidence),
                    "is_speaking": bool(self.audio_analysis.is_speaking)
                } if self.audio_analysis else None,
                "fps": fps,
                "timestamp": current_time
            }
            
            return response
            
        except Exception as e:
            return {"status": "error", "message": f"Frame processing error: {str(e)}"}
    
    def get_status(self) -> Dict:
        """Get current system status."""
        return {
            "camera_active": self.camera_active,
            "is_analyzing": self.is_analyzing,
            "patient_count": len(self.current_patients),
            "audio_status": self.audio_agent.get_audio_status(),
            "triage_stats": self.triage_agent.get_triage_statistics()
        }
    
    def export_logs(self, format: str = "csv") -> Dict:
        """Export event logs."""
        try:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            
            if format.lower() == "csv":
                filename = f"triage_log_{timestamp}.csv"
                self.event_logger.export_csv(filename)
            else:
                filename = f"triage_log_{timestamp}.json"
                self.event_logger.export_json(filename)
            
            return {"status": "success", "filename": filename}
            
        except Exception as e:
            return {"status": "error", "message": f"Export error: {str(e)}"}


# Create FastAPI app
app = FastAPI(title="RescueLens Backend", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize backend
backend = RescueLensBackend()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication."""
    await backend.connect_websocket(websocket)
    
    try:
        while True:
            # Keep connection alive
            await asyncio.sleep(1)
            
    except WebSocketDisconnect:
        await backend.disconnect_websocket(websocket)


@app.post("/api/camera/start")
async def start_camera():
    """Start camera capture."""
    result = backend.start_camera()
    await backend.broadcast_to_clients({"type": "camera_status", "status": result["status"]})
    return result


@app.post("/api/camera/stop")
async def stop_camera():
    """Stop camera capture."""
    result = backend.stop_camera()
    await backend.broadcast_to_clients({"type": "camera_status", "status": result["status"]})
    return result


@app.post("/api/audio/start")
async def start_audio():
    """Start audio listening."""
    result = backend.start_audio()
    await backend.broadcast_to_clients({"type": "audio_status", "status": result["status"]})
    return result


@app.post("/api/audio/stop")
async def stop_audio():
    """Stop audio listening."""
    result = backend.stop_audio()
    await backend.broadcast_to_clients({"type": "audio_status", "status": result["status"]})
    return result


@app.post("/api/analysis/start")
async def start_analysis():
    """Start real-time analysis."""
    result = backend.start_analysis()
    await backend.broadcast_to_clients({"type": "analysis_status", "status": result["status"]})
    return result


@app.post("/api/analysis/stop")
async def stop_analysis():
    """Stop real-time analysis."""
    result = backend.stop_analysis()
    await backend.broadcast_to_clients({"type": "analysis_status", "status": result["status"]})
    return result


@app.post("/api/process_frame")
async def process_frame():
    """Process a single frame."""
    result = await backend.process_frame()
    if result["status"] == "success":
        await backend.broadcast_to_clients({"type": "frame_update", "frame": result["frame"], "patients": result["patients"], "triage_decisions": result["triage_decisions"], "audio_analysis": result["audio_analysis"], "fps": result["fps"]})
    return result


@app.get("/api/status")
async def get_status():
    """Get system status."""
    return backend.get_status()


@app.post("/api/export/{format}")
async def export_logs(format: str):
    """Export event logs."""
    return backend.export_logs(format)


@app.get("/api/download/{filename}")
async def download_file(filename: str):
    """Download exported file."""
    try:
        return FileResponse(filename, filename=filename)
    except Exception as e:
        raise HTTPException(status_code=404, detail="File not found")


# Background task for continuous analysis
async def continuous_analysis():
    """Background task for continuous analysis."""
    while True:
        try:
            if backend.is_analyzing and backend.camera_active:
                current_time = time.time()
                
                # Check if it's time for analysis
                if current_time - backend.last_analysis_time >= backend.analysis_interval:
                    result = await backend.process_frame()
                    if result["status"] == "success":
                        await backend.broadcast_to_clients({"type": "analysis_update", "data": result})
                    backend.last_analysis_time = current_time
            
            await asyncio.sleep(0.1)  # Small delay to prevent excessive CPU usage
            
        except Exception as e:
            print(f"❌ Continuous analysis error: {e}")
            await asyncio.sleep(1.0)


@app.on_event("startup")
async def startup_event():
    """Start background tasks on startup."""
    asyncio.create_task(continuous_analysis())
    print("🚀 RescueLens Backend started")


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)

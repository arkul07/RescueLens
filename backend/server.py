"""
FastAPI server for RescueLens backend.
"""

import json
import asyncio
from typing import List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import uvicorn

from models import PatientState, TriageDecision, OverrideRequest, WebSocketMessage
from triage import create_triage_decision
from store import EventStore


class ConnectionManager:
    """Manage WebSocket connections."""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"📡 WebSocket connected. Total: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"📡 WebSocket disconnected. Total: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)
    
    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                # Remove dead connections
                if connection in self.active_connections:
                    self.active_connections.remove(connection)


# Initialize FastAPI app
app = FastAPI(title="RescueLens Backend", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize components
manager = ConnectionManager()
event_store = EventStore()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time communication."""
    await manager.connect(websocket)
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message_data = json.loads(data)
            
            if message_data.get("type") == "patient_state":
                # Process patient state
                patient_state = PatientState(**message_data["data"])
                
                # Create triage decision
                decision = create_triage_decision(patient_state)
                
                # Log the decision
                event_store.log_ai_decision(decision)
                
                # Send decision back to client
                response = WebSocketMessage(
                    type="triage_decision",
                    decision=decision
                )
                
                await manager.send_personal_message(
                    response.json(), 
                    websocket
                )
                
            elif message_data.get("type") == "ping":
                # Heartbeat response
                pong = WebSocketMessage(type="pong")
                await manager.send_personal_message(pong.json(), websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"WebSocket error: {e}")
        manager.disconnect(websocket)


@app.post("/override")
async def override_triage(override: OverrideRequest):
    """Handle human override of triage decision."""
    try:
        # Log the override
        event_store.log_override(override)
        
        # Create override decision
        decision = TriageDecision(
            id=override.id,
            category=override.category,
            confidence=1.0,
            reason=f"Human override: {override.reason}",
            ts=override.ts
        )
        
        # Broadcast to all connected clients
        response = WebSocketMessage(
            type="triage_decision",
            decision=decision
        )
        
        await manager.broadcast(response.json())
        
        return {"status": "success", "message": "Override applied"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/export")
async def export_logs(format: str = "json"):
    """Export event log."""
    try:
        if format.lower() == "csv":
            content = event_store.export_csv()
            return Response(
                content=content,
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=triage_log.csv"}
            )
        else:
            content = event_store.export_json()
            return Response(
                content=content,
                media_type="application/json",
                headers={"Content-Disposition": "attachment; filename=triage_log.json"}
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/status")
async def get_status():
    """Get system status."""
    stats = event_store.get_stats()
    return {
        "status": "running",
        "connections": len(manager.active_connections),
        "events": stats
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


if __name__ == "__main__":
    print("🚑 Starting RescueLens Backend...")
    uvicorn.run(
        "server:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

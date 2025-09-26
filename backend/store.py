"""
In-memory event log storage.
"""

import json
import csv
import io
from typing import List, Dict, Any
from datetime import datetime
from models import EventLogEntry, OverrideRequest, TriageDecision


class EventStore:
    """In-memory event log storage."""
    
    def __init__(self):
        self.events: List[EventLogEntry] = []
        self.next_id = 1
    
    def log_ai_decision(self, decision: TriageDecision) -> None:
        """Log an AI triage decision."""
        entry = EventLogEntry(
            id=f"ai_{self.next_id}",
            timestamp=decision.ts,
            ai=True,
            patient_id=decision.id,
            category=decision.category,
            confidence=decision.confidence,
            reason=decision.reason
        )
        self.events.append(entry)
        self.next_id += 1
    
    def log_override(self, override: OverrideRequest) -> None:
        """Log a human override."""
        entry = EventLogEntry(
            id=f"override_{self.next_id}",
            timestamp=override.ts,
            ai=False,
            patient_id=override.id,
            category=override.category,
            confidence=1.0,  # Human decisions have 100% confidence
            reason="Human override",
            override_reason=override.reason
        )
        self.events.append(entry)
        self.next_id += 1
    
    def get_events(self) -> List[EventLogEntry]:
        """Get all events sorted by timestamp (newest first)."""
        return sorted(self.events, key=lambda x: x.timestamp, reverse=True)
    
    def export_json(self) -> str:
        """Export events as JSON string."""
        events_data = []
        for event in self.events:
            events_data.append({
                "id": event.id,
                "timestamp": event.timestamp,
                "datetime": datetime.fromtimestamp(event.timestamp / 1000).isoformat(),
                "ai": event.ai,
                "patient_id": event.patient_id,
                "category": event.category,
                "confidence": event.confidence,
                "reason": event.reason,
                "override_reason": event.override_reason
            })
        
        return json.dumps(events_data, indent=2)
    
    def export_csv(self) -> str:
        """Export events as CSV string."""
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write header
        writer.writerow([
            "id", "timestamp", "datetime", "ai", "patient_id", 
            "category", "confidence", "reason", "override_reason"
        ])
        
        # Write data
        for event in self.events:
            writer.writerow([
                event.id,
                event.timestamp,
                datetime.fromtimestamp(event.timestamp / 1000).isoformat(),
                event.ai,
                event.patient_id,
                event.category,
                event.confidence,
                event.reason,
                event.override_reason or ""
            ])
        
        return output.getvalue()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about the event log."""
        if not self.events:
            return {
                "total_events": 0,
                "ai_decisions": 0,
                "overrides": 0,
                "categories": {},
                "avg_confidence": 0.0
            }
        
        ai_count = sum(1 for e in self.events if e.ai)
        override_count = sum(1 for e in self.events if not e.ai)
        
        categories = {}
        for event in self.events:
            categories[event.category] = categories.get(event.category, 0) + 1
        
        avg_confidence = sum(e.confidence for e in self.events) / len(self.events)
        
        return {
            "total_events": len(self.events),
            "ai_decisions": ai_count,
            "overrides": override_count,
            "categories": categories,
            "avg_confidence": round(avg_confidence, 3)
        }

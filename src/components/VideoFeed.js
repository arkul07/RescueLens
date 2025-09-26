import React from 'react';
import styled from 'styled-components';

const VideoContainer = styled.div`
  flex: 1;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 400px;
`;

const VideoFrame = styled.img`
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
`;

const NoVideoMessage = styled.div`
  color: #666;
  font-size: 18px;
  text-align: center;
  padding: 40px;
`;

const OverlayInfo = styled.div`
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  padding: 10px;
  border-radius: 5px;
  font-size: 14px;
  z-index: 10;
`;

const FPSIndicator = styled.div`
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(0, 0, 0, 0.7);
  color: #00ff88;
  padding: 8px 12px;
  border-radius: 5px;
  font-size: 12px;
  font-weight: bold;
  z-index: 10;
`;

const PatientOverlay = styled.div`
  position: absolute;
  border: 3px solid ${props => {
    switch(props.triageStatus) {
      case 'RED': return '#ff0000';
      case 'YELLOW': return '#ffff00';
      case 'GREEN': return '#00ff00';
      case 'BLACK': return '#000000';
      case 'UNKNOWN': return '#808080';
      default: return '#808080';
    }
  }};
  background: rgba(0, 0, 0, 0.3);
  z-index: 5;
`;

const PatientInfo = styled.div`
  position: absolute;
  top: -25px;
  left: 0;
  background: ${props => {
    switch(props.triageStatus) {
      case 'RED': return '#ff0000';
      case 'YELLOW': return '#ffff00';
      case 'GREEN': return '#00ff00';
      case 'BLACK': return '#000000';
      case 'UNKNOWN': return '#808080';
      default: return '#808080';
    }
  }};
  color: white;
  padding: 2px 8px;
  font-size: 12px;
  font-weight: bold;
  border-radius: 3px;
`;

const PatientDetails = styled.div`
  position: absolute;
  bottom: -60px;
  left: 0;
  background: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 5px 8px;
  font-size: 10px;
  border-radius: 3px;
  white-space: nowrap;
`;

function VideoFeed({ frame, patients, triageDecisions, fps }) {
  const getTriageDecision = (patientId) => {
    return triageDecisions.find(d => d.patient_id === patientId);
  };

  return (
    <VideoContainer>
      {frame ? (
        <>
          <VideoFrame src={`data:image/jpeg;base64,${frame}`} alt="Live Video Feed" />
          
          <FPSIndicator>
            FPS: {fps.toFixed(1)}
          </FPSIndicator>
          
          <OverlayInfo>
            Patients: {patients.length} | Analysis: Active
          </OverlayInfo>
          
          {/* Render patient overlays */}
          {patients.map((patient) => {
            const decision = getTriageDecision(patient.id);
            const [x, y, w, h] = patient.bounding_box;
            
            return (
              <PatientOverlay
                key={patient.id}
                triageStatus={decision?.final_decision || 'UNKNOWN'}
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${w - x}px`,
                  height: `${h - y}px`,
                }}
              >
                <PatientInfo triageStatus={decision?.final_decision || 'UNKNOWN'}>
                  {patient.id} - {decision?.final_decision || 'UNKNOWN'}
                </PatientInfo>
                
                <PatientDetails>
                  RR: {patient.breathing_rate.toFixed(1)} | 
                  Conf: {decision?.confidence.toFixed(2) || '0.00'} |
                  {patient.is_breathing ? 'Breathing' : 'No Breathing'} |
                  {patient.is_responsive ? 'Responsive' : 'Unresponsive'}
                </PatientDetails>
              </PatientOverlay>
            );
          })}
        </>
      ) : (
        <NoVideoMessage>
          <div>📹</div>
          <div>No video feed</div>
          <div style={{ fontSize: '14px', marginTop: '10px', color: '#888' }}>
            Start camera to begin live analysis
          </div>
        </NoVideoMessage>
      )}
    </VideoContainer>
  );
}

export default VideoFeed;


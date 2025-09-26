import React from 'react';
import styled from 'styled-components';

const Panel = styled.div`
  background: #333;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
`;

const PanelTitle = styled.h3`
  color: #00ff88;
  margin: 0 0 15px 0;
  font-size: 16px;
  border-bottom: 1px solid #555;
  padding-bottom: 8px;
`;

const PatientCard = styled.div`
  background: #444;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 10px;
  border-left: 4px solid ${props => {
    switch(props.triageStatus) {
      case 'RED': return '#ff0000';
      case 'YELLOW': return '#ffff00';
      case 'GREEN': return '#00ff00';
      case 'BLACK': return '#000000';
      case 'UNKNOWN': return '#808080';
      default: return '#808080';
    }
  }};
`;

const PatientHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
`;

const PatientId = styled.span`
  font-weight: bold;
  color: white;
`;

const TriageStatus = styled.span`
  background: ${props => {
    switch(props.status) {
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
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
`;

const PatientDetails = styled.div`
  font-size: 12px;
  color: #ccc;
  line-height: 1.4;
`;

const DetailRow = styled.div`
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
`;

const DetailLabel = styled.span`
  color: #999;
`;

const DetailValue = styled.span`
  color: white;
  font-weight: 500;
`;

const Reasoning = styled.div`
  background: #555;
  padding: 8px;
  border-radius: 4px;
  font-size: 11px;
  color: #ddd;
  margin-top: 8px;
  font-style: italic;
`;

const SystemStats = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 15px;
`;

const StatItem = styled.div`
  background: #444;
  padding: 10px;
  border-radius: 4px;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 18px;
  font-weight: bold;
  color: #00ff88;
`;

const StatLabel = styled.div`
  font-size: 11px;
  color: #999;
  margin-top: 2px;
`;

const NoPatientsMessage = styled.div`
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 20px;
`;

function StatusPanel({ patients, triageDecisions, audioAnalysis, systemStatus }) {
  const getTriageDecision = (patientId) => {
    return triageDecisions.find(d => d.patient_id === patientId);
  };

  const getTriageStats = () => {
    const stats = { RED: 0, YELLOW: 0, GREEN: 0, BLACK: 0, UNKNOWN: 0 };
    triageDecisions.forEach(decision => {
      const status = decision.final_decision || decision.ai_suggestion;
      if (stats.hasOwnProperty(status)) {
        stats[status]++;
      }
    });
    return stats;
  };

  const triageStats = getTriageStats();

  return (
    <>
      <Panel>
        <PanelTitle>📊 System Status</PanelTitle>
        <SystemStats>
          <StatItem>
            <StatValue>{patients.length}</StatValue>
            <StatLabel>Patients</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{triageStats.RED + triageStats.YELLOW}</StatValue>
            <StatLabel>Critical</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{triageStats.GREEN}</StatValue>
            <StatLabel>Stable</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{triageStats.UNKNOWN}</StatValue>
            <StatLabel>Unknown</StatLabel>
          </StatItem>
        </SystemStats>
      </Panel>

      <Panel>
        <PanelTitle>👥 Patient Status</PanelTitle>
        {patients.length > 0 ? (
          patients.map((patient) => {
            const decision = getTriageDecision(patient.id);
            return (
              <PatientCard key={patient.id} triageStatus={decision?.final_decision || 'UNKNOWN'}>
                <PatientHeader>
                  <PatientId>{patient.id}</PatientId>
                  <TriageStatus status={decision?.final_decision || 'UNKNOWN'}>
                    {decision?.final_decision || 'UNKNOWN'}
                  </TriageStatus>
                </PatientHeader>
                
                <PatientDetails>
                  <DetailRow>
                    <DetailLabel>Breathing Rate:</DetailLabel>
                    <DetailValue>{patient.breathing_rate.toFixed(1)} bpm</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>Breathing:</DetailLabel>
                    <DetailValue style={{ color: patient.is_breathing ? '#00ff88' : '#ff4444' }}>
                      {patient.is_breathing ? 'Yes' : 'No'}
                    </DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>Responsive:</DetailLabel>
                    <DetailValue style={{ color: patient.is_responsive ? '#00ff88' : '#ff4444' }}>
                      {patient.is_responsive ? 'Yes' : 'No'}
                    </DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>Confidence:</DetailLabel>
                    <DetailValue>{(decision?.confidence || 0).toFixed(2)}</DetailValue>
                  </DetailRow>
                </PatientDetails>
                
                {decision?.reasoning && (
                  <Reasoning>
                    💡 {decision.reasoning}
                  </Reasoning>
                )}
              </PatientCard>
            );
          })
        ) : (
          <NoPatientsMessage>
            No patients detected
            <br />
            <span style={{ fontSize: '12px' }}>
              {systemStatus.is_analyzing ? 'Analyzing...' : 'Start analysis to detect patients'}
            </span>
          </NoPatientsMessage>
        )}
      </Panel>

      {audioAnalysis && (
        <Panel>
          <PanelTitle>🎤 Audio Analysis</PanelTitle>
          <PatientDetails>
            <DetailRow>
              <DetailLabel>Speaking:</DetailLabel>
              <DetailValue style={{ color: audioAnalysis.is_speaking ? '#00ff88' : '#666' }}>
                {audioAnalysis.is_speaking ? 'Yes' : 'No'}
              </DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>Distress Score:</DetailLabel>
              <DetailValue style={{ color: audioAnalysis.distress_score > 0.5 ? '#ff4444' : '#00ff88' }}>
                {(audioAnalysis.distress_score * 100).toFixed(1)}%
              </DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>Comfort Score:</DetailLabel>
              <DetailValue style={{ color: audioAnalysis.comfort_score > 0.5 ? '#00ff88' : '#666' }}>
                {(audioAnalysis.comfort_score * 100).toFixed(1)}%
              </DetailValue>
            </DetailRow>
            <DetailRow>
              <DetailLabel>Confidence:</DetailLabel>
              <DetailValue>{(audioAnalysis.confidence * 100).toFixed(1)}%</DetailValue>
            </DetailRow>
            {audioAnalysis.keywords_detected.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <DetailLabel>Keywords:</DetailLabel>
                <div style={{ color: '#00ff88', fontSize: '11px', marginTop: '4px' }}>
                  {audioAnalysis.keywords_detected.join(', ')}
                </div>
              </div>
            )}
          </PatientDetails>
        </Panel>
      )}
    </>
  );
}

export default StatusPanel;


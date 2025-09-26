import React from 'react';
import styled from 'styled-components';

const Panel = styled.div`
  background: #333;
  border-radius: 8px;
  padding: 20px;
  margin-top: 20px;
`;

const PanelTitle = styled.h3`
  color: #00ff88;
  margin: 0 0 15px 0;
  font-size: 16px;
  border-bottom: 1px solid #555;
  padding-bottom: 8px;
`;

const ButtonGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 15px;
`;

const Button = styled.button`
  background: ${props => {
    if (props.active) return '#00ff88';
    if (props.danger) return '#ff4444';
    return '#555';
  }};
  color: ${props => props.active ? '#000' : 'white'};
  border: none;
  padding: 12px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  
  &:hover {
    background: ${props => {
      if (props.active) return '#00cc6a';
      if (props.danger) return '#ff2222';
      return '#666';
    }};
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
  }
  
  &:disabled {
    background: #333;
    color: #666;
    cursor: not-allowed;
    transform: none;
  }
`;

const ExportSection = styled.div`
  border-top: 1px solid #555;
  padding-top: 15px;
`;

const ExportTitle = styled.h4`
  color: #ccc;
  margin: 0 0 10px 0;
  font-size: 14px;
`;

const ExportButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const ExportButton = styled.button`
  background: #666;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.2s;
  
  &:hover {
    background: #777;
  }
`;

const StatusIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: ${props => props.active ? '#00ff88' : '#333'};
  color: ${props => props.active ? '#000' : '#ccc'};
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 10px;
`;

function ControlsPanel({
  cameraActive,
  audioActive,
  analysisActive,
  onStartCamera,
  onStopCamera,
  onStartAudio,
  onStopAudio,
  onStartAnalysis,
  onStopAnalysis,
  onExportLogs
}) {
  return (
    <Panel>
      <PanelTitle>🎛️ Controls</PanelTitle>
      
      <StatusIndicator active={cameraActive}>
        📹 Camera: {cameraActive ? 'Active' : 'Inactive'}
      </StatusIndicator>
      
      <StatusIndicator active={audioActive}>
        🎤 Audio: {audioActive ? 'Active' : 'Inactive'}
      </StatusIndicator>
      
      <StatusIndicator active={analysisActive}>
        🧠 Analysis: {analysisActive ? 'Active' : 'Inactive'}
      </StatusIndicator>
      
      <ButtonGrid>
        <Button
          active={cameraActive}
          onClick={cameraActive ? onStopCamera : onStartCamera}
        >
          {cameraActive ? '⏹️ Stop Camera' : '▶️ Start Camera'}
        </Button>
        
        <Button
          active={audioActive}
          onClick={audioActive ? onStopAudio : onStartAudio}
        >
          {audioActive ? '🔇 Stop Audio' : '🎤 Start Audio'}
        </Button>
        
        <Button
          active={analysisActive}
          onClick={analysisActive ? onStopAnalysis : onStartAnalysis}
          disabled={!cameraActive}
        >
          {analysisActive ? '⏸️ Stop Analysis' : '▶️ Start Analysis'}
        </Button>
        
        <Button
          danger
          onClick={() => {
            if (cameraActive) onStopCamera();
            if (audioActive) onStopAudio();
            if (analysisActive) onStopAnalysis();
          }}
        >
          🛑 Emergency Stop
        </Button>
      </ButtonGrid>
      
      <ExportSection>
        <ExportTitle>📊 Export Data</ExportTitle>
        <ExportButtons>
          <ExportButton onClick={() => onExportLogs('csv')}>
            📄 Export CSV
          </ExportButton>
          <ExportButton onClick={() => onExportLogs('json')}>
            📄 Export JSON
          </ExportButton>
        </ExportButtons>
      </ExportSection>
    </Panel>
  );
}

export default ControlsPanel;


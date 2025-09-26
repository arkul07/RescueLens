import React from 'react';
import styled, { keyframes } from 'styled-components';

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

const VisualizerContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
`;

const AudioLevelBar = styled.div`
  flex: 1;
  height: 20px;
  background: #222;
  border-radius: 10px;
  overflow: hidden;
  position: relative;
`;

const AudioLevelFill = styled.div`
  height: 100%;
  background: linear-gradient(90deg, #00ff88 0%, #ffff00 70%, #ff4444 100%);
  width: ${props => Math.min(props.level * 100, 100)}%;
  transition: width 0.1s ease;
  border-radius: 10px;
`;

const AudioLevelText = styled.div`
  color: #ccc;
  font-size: 12px;
  font-weight: bold;
  min-width: 30px;
  text-align: center;
`;

const KeywordContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
`;

const KeywordTag = styled.span`
  background: ${props => {
    if (props.type === 'distress') return '#ff4444';
    if (props.type === 'comfort') return '#00ff88';
    return '#666';
  }};
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: bold;
`;

const PulseAnimation = keyframes`
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.7; }
  100% { transform: scale(1); opacity: 1; }
`;

const SpeakingIndicator = styled.div`
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: ${props => props.speaking ? '#00ff88' : '#666'};
  animation: ${props => props.speaking ? PulseAnimation : 'none'} 1s infinite;
`;

const NoAudioMessage = styled.div`
  text-align: center;
  color: #666;
  font-style: italic;
  padding: 20px;
`;

const AudioStats = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-top: 15px;
`;

const StatItem = styled.div`
  background: #444;
  padding: 8px;
  border-radius: 4px;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 14px;
  font-weight: bold;
  color: ${props => {
    if (props.type === 'distress') return props.value > 0.5 ? '#ff4444' : '#00ff88';
    if (props.type === 'comfort') return props.value > 0.5 ? '#00ff88' : '#666';
    return '#ccc';
  }};
`;

const StatLabel = styled.div`
  font-size: 10px;
  color: #999;
  margin-top: 2px;
`;

function AudioVisualizer({ audioAnalysis, audioActive }) {
  if (!audioActive) {
    return (
      <Panel>
        <PanelTitle>🎤 Audio Analysis</PanelTitle>
        <NoAudioMessage>
          Audio not active
          <br />
          <span style={{ fontSize: '12px' }}>
            Start audio to begin speech analysis
          </span>
        </NoAudioMessage>
      </Panel>
    );
  }

  if (!audioAnalysis) {
    return (
      <Panel>
        <PanelTitle>🎤 Audio Analysis</PanelTitle>
        <NoAudioMessage>
          Listening for speech...
          <br />
          <span style={{ fontSize: '12px' }}>
            Speak clearly for analysis
          </span>
        </NoAudioMessage>
      </Panel>
    );
  }

  const getKeywordType = (keyword) => {
    const distressKeywords = ['help', 'pain', 'hurt', 'dying', 'emergency', 'ambulance', 'doctor', 'bleeding', 'injured', 'unconscious', 'chest pain', 'heart attack', 'stroke', 'seizure'];
    const comfortKeywords = ['im ok', 'im fine', 'doing well', 'feeling better', 'no problem', 'good', 'fine', 'okay', 'no pain', 'comfortable', 'stable', 'normal', 'healthy'];
    
    const lowerKeyword = keyword.toLowerCase();
    if (distressKeywords.some(dk => lowerKeyword.includes(dk))) return 'distress';
    if (comfortKeywords.some(ck => lowerKeyword.includes(ck))) return 'comfort';
    return 'neutral';
  };

  return (
    <Panel>
      <PanelTitle>🎤 Audio Analysis</PanelTitle>
      
      <VisualizerContainer>
        <SpeakingIndicator speaking={audioAnalysis.is_speaking} />
        <AudioLevelBar>
          <AudioLevelFill level={audioAnalysis.audio_level} />
        </AudioLevelBar>
        <AudioLevelText>
          {Math.round(audioAnalysis.audio_level * 100)}%
        </AudioLevelText>
      </VisualizerContainer>
      
      {audioAnalysis.keywords_detected.length > 0 && (
        <div>
          <div style={{ color: '#ccc', fontSize: '12px', marginBottom: '8px' }}>
            Detected Keywords:
          </div>
          <KeywordContainer>
            {audioAnalysis.keywords_detected.map((keyword, index) => (
              <KeywordTag
                key={index}
                type={getKeywordType(keyword)}
              >
                {keyword}
              </KeywordTag>
            ))}
          </KeywordContainer>
        </div>
      )}
      
      <AudioStats>
        <StatItem>
          <StatValue type="distress" value={audioAnalysis.distress_score}>
            {Math.round(audioAnalysis.distress_score * 100)}%
          </StatValue>
          <StatLabel>Distress</StatLabel>
        </StatItem>
        
        <StatItem>
          <StatValue type="comfort" value={audioAnalysis.comfort_score}>
            {Math.round(audioAnalysis.comfort_score * 100)}%
          </StatValue>
          <StatLabel>Comfort</StatLabel>
        </StatItem>
      </AudioStats>
    </Panel>
  );
}

export default AudioVisualizer;


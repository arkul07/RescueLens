# 🚑 RescueLens - One Minute Demo Script

## **Demo Overview (60 seconds)**
*AI-Powered Medical Triage System for Disaster Response*

---

## **Opening (0-10 seconds)**
**"Welcome to RescueLens - an AI-assisted medical triage system designed for disaster response and low-resource medical environments."**

- Show the main interface at http://localhost:3003
- Point to the clean, medical-grade interface
- Highlight the real-time camera feed

---

## **Live Detection Demo (10-25 seconds)**
**"Let me demonstrate real-time patient detection and triage analysis."**

1. **Start Camera**: Click "Start Camera" button
2. **Grant Permissions**: Allow camera and microphone access
3. **Start Detection**: Click "Start Detection" 
4. **Show Overlays**: Point out the color-coded patient boxes
5. **Explain Colors**: 
   - 🔴 **RED**: Critical - immediate attention required
   - 🟡 **YELLOW**: Urgent - serious but not life-threatening  
   - 🟢 **GREEN**: Delayed - minor injuries
   - ⚫ **BLACK**: Deceased or expectant

---

## **Medical Analysis (25-40 seconds)**
**"The system analyzes multiple medical indicators in real-time."**

- **Breathing Analysis**: Show respiratory rate detection
- **Movement Assessment**: Demonstrate purposeful vs. low vs. none movement
- **Persistent Tracking**: Show how patients remain tracked even when out of frame
- **Triage Decisions**: Point to the patient list showing medical reasoning
- **Confidence Scores**: Highlight the AI confidence levels

---

## **Video Analysis Demo (40-55 seconds)**
**"For recorded footage, we can analyze at quarter speed for detailed assessment."**

1. **Switch to Video Detect**: Click the "Video Detect" tab
2. **Upload Video**: Show file upload capability
3. **Playback Control**: Demonstrate 0.25x speed for detailed analysis
4. **Medical Overlays**: Show the same color-coded system on recorded video

---

## **Closing (55-60 seconds)**
**"RescueLens provides instant, AI-powered triage decisions to help medical teams prioritize patients during emergencies, potentially saving lives through faster, more accurate assessments."**

- Show export capabilities (JSON/CSV)
- Highlight the privacy-first approach (no raw video sent to backend)
- Mention the START triage protocol compliance

---

## **Key Talking Points**

### **Technical Features**
- ✅ Real-time MediaPipe pose detection
- ✅ Browser-side processing (privacy-first)
- ✅ WebSocket communication for live updates
- ✅ Persistent patient tracking
- ✅ START triage protocol compliance

### **Medical Benefits**
- 🏥 Faster triage decisions
- 🎯 Objective assessment criteria
- 📊 Comprehensive patient data
- 🔄 Continuous monitoring
- 📱 Works on any device with camera

### **Use Cases**
- 🚨 Disaster response scenarios
- 🏥 Low-resource medical environments
- 🚑 Emergency medical services
- 📊 Mass casualty incidents
- 🎓 Medical training and simulation

---

## **Demo Preparation Checklist**

### **Before Demo**
- [ ] Ensure both servers are running (backend:8002, frontend:3003)
- [ ] Test camera permissions
- [ ] Have a sample video ready for upload
- [ ] Prepare a clean, well-lit area for live detection
- [ ] Close unnecessary applications for better performance

### **During Demo**
- [ ] Speak clearly and confidently
- [ ] Point to specific UI elements
- [ ] Explain the medical significance of each feature
- [ ] Keep to the 60-second timeline
- [ ] Be ready to answer questions about technical details

### **Backup Plans**
- [ ] If camera doesn't work, focus on video upload demo
- [ ] If detection is slow, explain it's processing in real-time
- [ ] If colors don't match, explain the system is learning and adapting

---

## **Post-Demo Q&A Topics**

### **Technical Questions**
- **"How accurate is the AI?"** - Explain confidence scoring and human override capabilities
- **"What about privacy?"** - Highlight browser-side processing and no raw data transmission
- **"Can it work offline?"** - Explain the local processing capabilities

### **Medical Questions**
- **"Is this FDA approved?"** - Explain it's a research/development tool
- **"How does it compare to human triage?"** - Position as decision support, not replacement
- **"What about different patient types?"** - Explain the system's adaptability

### **Deployment Questions**
- **"How do you deploy this?"** - Explain the lightweight, browser-based architecture
- **"What about training?"** - Highlight the intuitive interface and minimal training needs
- **"Integration with existing systems?"** - Explain the export capabilities and API design

---

*This demo script showcases RescueLens as a cutting-edge AI tool that can revolutionize medical triage in emergency situations, combining advanced computer vision with medical expertise to save lives.*

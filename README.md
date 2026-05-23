# FocusRec - Screen Recorder for Windows

## Setup Instructions

### Requirements
- Node.js v18+ 
- npm v9+

### Installation
```bash
npm install
```

### Run in Development
```bash
npm start
```

### Build Windows Installer
```bash
npm run build
```
The installer will be in the `dist/` folder.

## Features
- Screen & Window Recording
- Auto Zoom on Click
- Cursor Highlight Effects (Ripple, Spotlight, Circle, Crosshair)
- Microphone + System Audio Recording
- HD/4K Export (WebM format)
- Clean dark UI
- Recording History

## Project Structure
```
focusrec/
├── main.js          # Electron main process
├── preload.js       # Secure IPC bridge
├── src/
│   ├── index.html   # Main UI
│   └── overlay.html # Cursor overlay
└── assets/          # Icons
```

## Notes
- Grant screen recording permission when prompted
- For best results, use a dedicated microphone
- WebM export works in all modern browsers & VLC

const { app, BrowserWindow, ipcMain, desktopCapturer, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');

let mainWindow;
let overlayWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f0f13',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
  });
  mainWindow.loadFile('index.html');
}

function createOverlayWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize;
  overlayWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  overlayWindow.loadFile('overlay.html');
  overlayWindow.setIgnoreMouseEvents(true);
  overlayWindow.hide();
}

app.whenReady().then(() => {
  createMainWindow();
  createOverlayWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers
ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
  });
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
  }));
});

ipcMain.handle('get-save-path', async (event, filename) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: path.join(os.homedir(), 'Videos', filename),
    filters: [{ name: 'Video', extensions: ['mp4'] }],
  });
  return result.filePath || null;
});

ipcMain.handle('save-video', async (event, { buffer, filePath }) => {
  try {
    const buf = Buffer.from(buffer);
    fs.writeFileSync(filePath, buf);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.message };
  }
});

// Process video with zoom effects using ffmpeg
ipcMain.handle('process-video', async (event, { inputPath, outputPath, clicks, duration, width, height, zoomStrength }) => {
  return new Promise((resolve) => {
    try {
      // Find ffmpeg
      let ffmpegPath;
      try {
        ffmpegPath = require('ffmpeg-static');
      } catch(e) {
        // Try system ffmpeg
        ffmpegPath = 'ffmpeg';
      }

      if (!clicks || clicks.length === 0) {
        // No clicks, just copy
        fs.copyFileSync(inputPath, outputPath);
        return resolve({ success: true });
      }

      // Build zoompan filter for each click
      // Each click: zoom in for 1.5s, zoom out for 0.5s
      const fps = 30;
      const zoomScale = zoomStrength || 1.8;
      const zoomInFrames = Math.floor(fps * 0.3);
      const holdFrames = Math.floor(fps * 0.8);
      const zoomOutFrames = Math.floor(fps * 0.4);

      // Build complex zoompan expressions
      let zoomExpr = '1';
      let xExpr = 'iw/2-(iw/zoom/2)';
      let yExpr = 'ih/2-(ih/zoom/2)';

      if (clicks.length > 0) {
        // Simple approach: zoom at first few clicks
        const processedClicks = clicks.slice(0, 5); // max 5 zoom events

        let zoomParts = [];
        let xParts = [];
        let yParts = [];

        processedClicks.forEach((click, i) => {
          const startFrame = Math.floor(click.time * fps / 1000);
          const endFrame = startFrame + zoomInFrames + holdFrames + zoomOutFrames;
          
          // Normalize click position (0-1)
          const nx = Math.min(Math.max(click.nx || 0.5, 0.1), 0.9);
          const ny = Math.min(Math.max(click.ny || 0.5, 0.1), 0.9);

          zoomParts.push(
            `if(between(n,${startFrame},${startFrame+zoomInFrames}),` +
            `1+(${zoomScale-1})*((n-${startFrame})/${zoomInFrames}),` +
            `if(between(n,${startFrame+zoomInFrames},${startFrame+zoomInFrames+holdFrames}),` +
            `${zoomScale},` +
            `if(between(n,${startFrame+zoomInFrames+holdFrames},${endFrame}),` +
            `${zoomScale}-(${zoomScale-1})*((n-${startFrame+zoomInFrames+holdFrames})/${zoomOutFrames}),` +
            `1)))`
          );

          xParts.push(
            `if(between(n,${startFrame},${endFrame}),` +
            `${nx}*iw-(iw/zoom/2),` +
            `iw/2-(iw/zoom/2))`
          );

          yParts.push(
            `if(between(n,${startFrame},${endFrame}),` +
            `${ny}*ih-(ih/zoom/2),` +
            `ih/2-(ih/zoom/2))`
          );
        });

        if (zoomParts.length > 0) {
          zoomExpr = zoomParts[0];
          xExpr = xParts[0];
          yExpr = yParts[0];
        }
      }

      const filter = `zoompan=z='${zoomExpr}':x='${xExpr}':y='${yExpr}':d=1:s=${width}x${height}:fps=${fps}`;

      const args = [
        '-i', inputPath,
        '-vf', filter,
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '22',
        '-c:a', 'aac',
        '-movflags', '+faststart',
        '-y',
        outputPath
      ];

      const proc = execFile(ffmpegPath, args, { timeout: 300000 }, (err, stdout, stderr) => {
        if (err) {
          console.error('FFmpeg error:', err.message);
          // Fallback: just copy the file
          try {
            fs.copyFileSync(inputPath, outputPath);
            resolve({ success: true, fallback: true });
          } catch(e2) {
            resolve({ success: false, error: err.message });
          }
        } else {
          resolve({ success: true });
        }
      });

    } catch(e) {
      resolve({ success: false, error: e.message });
    }
  });
});

ipcMain.handle('get-temp-path', async (event, filename) => {
  return path.join(os.tmpdir(), filename);
});

ipcMain.handle('delete-file', async (event, filePath) => {
  try { fs.unlinkSync(filePath); } catch(e) {}
  return true;
});

ipcMain.on('show-overlay', () => {
  if (overlayWindow) {
    overlayWindow.show();
    overlayWindow.webContents.send('overlay-show');
  }
});

ipcMain.on('hide-overlay', () => {
  if (overlayWindow) {
    overlayWindow.hide();
    overlayWindow.webContents.send('overlay-hide');
  }
});

ipcMain.on('update-cursor', (event, pos) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('cursor-pos', pos);
  }
});

ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

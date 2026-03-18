import { BrowserWindow, desktopCapturer, nativeTheme, screen } from 'electron';
import * as path from 'path';
import { readConfig, writeConfig } from './config-store';

const COLLAPSED_SIZE = 64;
const EXPANDED_WIDTH = 380;
const EXPANDED_HEIGHT = 520;
const SAMPLE_INTERVAL_MS = 2000;

let floatingBallWindow: BrowserWindow | null = null;
let brightnessTimer: ReturnType<typeof setInterval> | null = null;
let isExpanded = false;
// Track consecutive capture failures to avoid wasting resources
let captureFailures = 0;
const MAX_FAILURES_BEFORE_PAUSE = 5;

export function getFloatingBallWindow(): BrowserWindow | null {
  return floatingBallWindow;
}

// ---- Brightness Sampling ----

/**
 * Returns perceived brightness (0-255) of the screen region behind the ball,
 * or -1 if capture failed (no data available, keep current state).
 */
async function sampleBrightness(): Promise<number> {
  if (!floatingBallWindow || floatingBallWindow.isDestroyed()) return -1;
  if (captureFailures >= MAX_FAILURES_BEFORE_PAUSE) return -1;

  const [ballX, ballY] = floatingBallWindow.getPosition();
  const [ballW, ballH] = floatingBallWindow.getSize();
  const ballCenter = { x: ballX + ballW / 2, y: ballY + ballH / 2 };
  const display = screen.getDisplayNearestPoint(ballCenter);

  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 320, height: 180 },
    });

    const source = sources.find((s) => s.display_id === String(display.id)) || sources[0];
    if (!source) { captureFailures++; return -1; }

    const thumb = source.thumbnail;
    const { width: tw, height: th } = thumb.getSize();
    if (tw < 10 || th < 10) { captureFailures++; return -1; }

    const scaleX = tw / display.bounds.width;
    const scaleY = th / display.bounds.height;
    const relX = ballX - display.bounds.x;
    const relY = ballY - display.bounds.y;

    let cropX = Math.round(relX * scaleX);
    let cropY = Math.round(relY * scaleY);
    let cropW = Math.max(1, Math.round(ballW * scaleX));
    let cropH = Math.max(1, Math.round(ballH * scaleY));

    cropX = Math.max(0, Math.min(cropX, tw - 1));
    cropY = Math.max(0, Math.min(cropY, th - 1));
    cropW = Math.min(cropW, tw - cropX);
    cropH = Math.min(cropH, th - cropY);
    if (cropW <= 0 || cropH <= 0) { captureFailures++; return -1; }

    const cropped = thumb.crop({ x: cropX, y: cropY, width: cropW, height: cropH });
    const bitmap = cropped.toBitmap();
    if (bitmap.length === 0) { captureFailures++; return -1; }

    // Detect blank thumbnails (permission denied on macOS).
    // Blank thumbnails are all-zero (transparent black) or uniform opaque black.
    let hasVariation = false;
    const firstPixel = [bitmap[0], bitmap[1], bitmap[2], bitmap[3]];
    // Check first ~100 pixels for any variation
    const checkLimit = Math.min(bitmap.length, 400);
    for (let i = 4; i < checkLimit; i += 4) {
      if (bitmap[i] !== firstPixel[0] || bitmap[i + 1] !== firstPixel[1] ||
          bitmap[i + 2] !== firstPixel[2] || bitmap[i + 3] !== firstPixel[3]) {
        hasVariation = true;
        break;
      }
    }

    // If all sampled pixels are identical AND near-black, it's a blank thumbnail
    if (!hasVariation) {
      const pixelBrightness = firstPixel[2] * 0.299 + firstPixel[1] * 0.587 + firstPixel[0] * 0.114;
      if (pixelBrightness < 5) {
        captureFailures++;
        return -1;
      }
    }

    // Valid capture! Reset failure counter.
    captureFailures = 0;

    // BGRA format: calculate perceived brightness
    let total = 0;
    let count = 0;
    for (let i = 0; i < bitmap.length; i += 4) {
      const b = bitmap[i];
      const g = bitmap[i + 1];
      const r = bitmap[i + 2];
      total += r * 0.299 + g * 0.587 + b * 0.114;
      count++;
    }

    return count > 0 ? Math.round(total / count) : -1;
  } catch {
    captureFailures++;
    return -1;
  }
}

function pushBrightness(): void {
  sampleBrightness().then((brightness) => {
    // Only push when we have valid data (>= 0)
    if (brightness >= 0 && floatingBallWindow && !floatingBallWindow.isDestroyed()) {
      floatingBallWindow.webContents.send('floating-ball:brightness', brightness);
    }
  }).catch(() => {
    // Ignore errors
  });
}

function startBrightnessSampling(): void {
  stopBrightnessSampling();
  // Reset failure counter when starting fresh
  captureFailures = 0;
  setTimeout(() => pushBrightness(), 500);
  brightnessTimer = setInterval(pushBrightness, SAMPLE_INTERVAL_MS);
}

function stopBrightnessSampling(): void {
  if (brightnessTimer) {
    clearInterval(brightnessTimer);
    brightnessTimer = null;
  }
}

// ---- Window Management ----

export function createFloatingBallWindow(devServerUrl: string): void {
  if (floatingBallWindow && !floatingBallWindow.isDestroyed()) {
    floatingBallWindow.show();
    return;
  }

  const config = readConfig();
  const display = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = display.workAreaSize;

  const defaultX = screenW - COLLAPSED_SIZE - 24;
  const defaultY = screenH - COLLAPSED_SIZE - 24;
  const savedPos = config.floatingBallPosition;
  const startX = savedPos ? savedPos.x : defaultX;
  const startY = savedPos ? savedPos.y : defaultY;

  isExpanded = false;

  floatingBallWindow = new BrowserWindow({
    width: COLLAPSED_SIZE,
    height: COLLAPSED_SIZE,
    x: startX,
    y: startY,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    focusable: false,
    show: false,
    ...(process.platform === 'darwin' ? { type: 'panel' } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Exclude this window from desktopCapturer screen capture.
  // This ensures we only capture what's BEHIND the ball, not the ball itself.
  floatingBallWindow.setContentProtection(true);

  if (process.platform === 'darwin') {
    floatingBallWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  floatingBallWindow.loadURL(`${devServerUrl}/floating-ball`);

  floatingBallWindow.once('ready-to-show', () => {
    floatingBallWindow?.show();
    startBrightnessSampling();
  });

  floatingBallWindow.on('moved', () => {
    if (floatingBallWindow && !floatingBallWindow.isDestroyed()) {
      const [x, y] = floatingBallWindow.getPosition();
      writeConfig('floatingBallPosition', { x, y });
      if (!isExpanded) {
        pushBrightness();
      }
    }
  });

  // Listen for OS theme changes
  nativeTheme.off('updated', pushBrightness);
  nativeTheme.on('updated', () => {
    if (!isExpanded) pushBrightness();
  });

  floatingBallWindow.on('closed', () => {
    stopBrightnessSampling();
    floatingBallWindow = null;
  });
}

export function destroyFloatingBallWindow(): void {
  stopBrightnessSampling();
  if (floatingBallWindow && !floatingBallWindow.isDestroyed()) {
    floatingBallWindow.close();
  }
  floatingBallWindow = null;
}

// Saved ball screen position so collapse restores exactly
let ballSavedX = 0;
let ballSavedY = 0;

const PANEL_CONTENT_HEIGHT = EXPANDED_HEIGHT - COLLAPSED_SIZE - 8; // 448

export function resizeFloatingBallWindow(expanded: boolean): void {
  if (!floatingBallWindow || floatingBallWindow.isDestroyed()) return;

  isExpanded = expanded;

  if (expanded) {
    stopBrightnessSampling();

    if (!floatingBallWindow.isVisible()) {
      floatingBallWindow.show();
    }

    // Save the ball's exact screen position
    [ballSavedX, ballSavedY] = floatingBallWindow.getPosition();

    const ballCenterX = ballSavedX + COLLAPSED_SIZE / 2;
    const ballCenterY = ballSavedY + COLLAPSED_SIZE / 2;
    const display = screen.getDisplayNearestPoint({ x: ballCenterX, y: ballCenterY });
    const wa = display.workArea;

    // Decide direction: open downward if enough space below, else upward
    const spaceBelow = (wa.y + wa.height) - (ballSavedY + COLLAPSED_SIZE);
    const direction: 'down' | 'up' = spaceBelow >= PANEL_CONTENT_HEIGHT + 8 ? 'down' : 'up';

    // Window Y: keep ball at the same screen Y
    let winY: number;
    if (direction === 'down') {
      winY = ballSavedY; // ball at top of window
    } else {
      winY = ballSavedY - PANEL_CONTENT_HEIGHT - 8; // ball at bottom of window
    }

    // Window X: center panel on ball, clamp to work area
    let winX = ballCenterX - EXPANDED_WIDTH / 2;
    winX = Math.max(wa.x, Math.min(winX, wa.x + wa.width - EXPANDED_WIDTH));
    winY = Math.max(wa.y, Math.min(winY, wa.y + wa.height - EXPANDED_HEIGHT));

    // Ball's position within the expanded window
    const ballInWinX = ballSavedX - winX;

    floatingBallWindow.setFocusable(true);
    floatingBallWindow.setResizable(true);
    floatingBallWindow.setSize(EXPANDED_WIDTH, EXPANDED_HEIGHT);
    floatingBallWindow.setPosition(Math.round(winX), Math.round(winY));
    floatingBallWindow.setResizable(false);
    floatingBallWindow.focus();

    // Tell renderer how to layout
    floatingBallWindow.webContents.send('floating-ball:layout', {
      direction,
      ballX: Math.round(ballInWinX),
    });
  } else {
    // Collapse: restore ball to exact saved position
    floatingBallWindow.setResizable(true);
    floatingBallWindow.setSize(COLLAPSED_SIZE, COLLAPSED_SIZE);
    floatingBallWindow.setPosition(ballSavedX, ballSavedY);
    floatingBallWindow.setResizable(false);
    floatingBallWindow.setFocusable(false);

    writeConfig('floatingBallPosition', { x: ballSavedX, y: ballSavedY });
    startBrightnessSampling();
  }
}

export function isFloatingBallExpanded(): boolean {
  return isExpanded;
}

export function hideFloatingBallWindow(): void {
  // Never hide while user is interacting with the expanded panel
  if (isExpanded) return;
  if (floatingBallWindow && !floatingBallWindow.isDestroyed() && floatingBallWindow.isVisible()) {
    stopBrightnessSampling();
    floatingBallWindow.hide();
  }
}

export function showFloatingBallWindow(): void {
  if (floatingBallWindow && !floatingBallWindow.isDestroyed() && !floatingBallWindow.isVisible()) {
    floatingBallWindow.show();
    if (!isExpanded) {
      startBrightnessSampling();
    }
  }
}

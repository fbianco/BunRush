// ---------------------------------------------------------------------------
// PoseTracker: webcam -> MediaPipe Pose Landmarker -> 33 body landmarks.
//
// The MediaPipe library (JavaScript + WebAssembly) ships inside the project
// in vendor/mediapipe, so nothing has to be installed. The neural-network
// model is loaded from models/ if you downloaded it, otherwise from Google's
// public model storage.
// It also draws the camera "mirror" with the skeleton and the gesture zones.
// ---------------------------------------------------------------------------
import { GESTURE } from '../config.js';
import { LM } from './GestureInterpreter.js';

const LIB = new URL('../../vendor/mediapipe/vision_bundle.mjs', import.meta.url).href;
const WASM = new URL('../../vendor/mediapipe/wasm', import.meta.url).href;
const MODEL_LOCAL = new URL('../../models/pose_landmarker_lite.task', import.meta.url).href;
const MODEL_REMOTE = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

// Skeleton lines to draw (pairs of landmark indices)
const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28],
];

export class PoseTracker {
  constructor(video, overlay) {
    this.video = video;
    this.overlay = overlay;
    this.octx = overlay.getContext('2d');
    this.status = 'idle';       // idle | camera | model | ready | error
    this.message = 'Camera off';
    this.landmarker = null;
    this.lastVideoTime = -1;
    this.latest = null;
    this.fps = 0;
  }

  get ready() {
    return this.status === 'ready';
  }

  async start() {
    try {
      this.status = 'camera';
      this.message = 'Waiting for camera permission...';
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('This browser has no camera API');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });
      this.video.srcObject = stream;
      await this.video.play();

      this.status = 'model';
      this.message = 'Loading body tracking...';
      const vision = await import(LIB);
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM);
      const modelAssetPath = await pickModel();
      const options = (delegate) => ({
        baseOptions: { modelAssetPath, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
      // add ?delegate=CPU to the address to skip the graphics card
      const forced = new URLSearchParams(location.search).get('delegate');
      try {
        this.landmarker = await vision.PoseLandmarker.createFromOptions(fileset, options(forced === 'CPU' ? 'CPU' : 'GPU'));
      } catch (gpuError) {
        console.warn('GPU delegate failed, using CPU', gpuError);
        this.landmarker = await vision.PoseLandmarker.createFromOptions(fileset, options('CPU'));
      }
      this.status = 'ready';
      this.message = 'Body control ON';
    } catch (err) {
      console.error(err);
      this.status = 'error';
      this.message = friendlyError(err);
    }
  }

  /**
   * Run the detector on the newest camera frame.
   * Returns the landmarks (or null if nobody is visible), or undefined if
   * there was no new camera frame since the last call.
   */
  detect(nowMs) {
    if (!this.ready || this.video.readyState < 2) return undefined;
    if (this.video.currentTime === this.lastVideoTime) return undefined;
    this.lastVideoTime = this.video.currentTime;
    const result = this.landmarker.detectForVideo(this.video, nowMs);
    if (this.lastDetectAt) this.fps = this.fps * 0.9 + (1000 / Math.max(1, nowMs - this.lastDetectAt)) * 0.1;
    this.lastDetectAt = nowMs;
    this.latest = result.landmarks?.[0] ?? null;
    return this.latest;
  }

  /** Draw skeleton + gesture zones over the (mirrored) camera picture. */
  drawOverlay(gest) {
    const v = this.video;
    const c = this.overlay;
    const w = v.videoWidth || 640;
    const h = v.videoHeight || 480;
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    const g = this.octx;
    g.clearRect(0, 0, w, h);
    const out = gest.out;
    const b = gest.baseline;
    const cfg = GESTURE;

    if (b && !gest.calibrating) {
      // the interpreter works in "width units" (y is scaled by h/w), so one
      // unit = w pixels in both directions here
      const sw = b.sw * w;
      const cy = b.y * w;
      g.lineWidth = 2;
      // arm zones: a wrist inside a box (around shoulder height, out to the
      // side) = walk that way. Your left is image +x (the panel is mirrored).
      const body = out.body;
      if (body) {
        const bx = body.x * w;
        const by = body.y * w;
        const u = body.unit * w;
        const top = by - cfg.armLevel * u;
        const tall = 2 * cfg.armLevel * u;
        for (const [s, on] of [[1, out.armL], [-1, out.armR]]) {
          const edge = bx + s * (0.5 + cfg.armOut) * u;
          const pepper = out.pepperPose === -s;
          g.fillStyle = on ? 'rgba(255,210,63,0.35)' : pepper ? 'rgba(255,93,143,0.3)' : 'rgba(255,210,63,0.1)';
          g.strokeStyle = on ? '#ffd23f' : pepper ? '#ff5d8f' : 'rgba(255,210,63,0.45)';
          const x0 = s > 0 ? edge : 0;
          const x1 = s > 0 ? w : edge;
          g.fillRect(x0, top, x1 - x0, tall);
          g.setLineDash([6, 6]);
          g.strokeRect(x0, top, x1 - x0, tall);
        }
        // body centre: both wrists past it on one side = pepper
        g.strokeStyle = out.pepperPose ? '#ff5d8f' : 'rgba(255,255,255,0.35)';
        line(g, bx, 0, bx, h);
      }
      // squat level
      g.strokeStyle = out.crouch ? '#5ee1ff' : 'rgba(94,225,255,0.5)';
      line(g, 0, cy + cfg.crouchEnter * sw, w, cy + cfg.crouchEnter * sw);
      g.setLineDash([]);
    }

    const lm = this.latest;
    if (!lm) return;
    g.lineCap = 'round';
    g.lineWidth = 6;
    g.strokeStyle = out.handsUp ? '#7CFFB2' : 'rgba(124,255,178,0.85)';
    for (const [i, j] of BONES) {
      if ((lm[i].visibility ?? 1) < 0.4 || (lm[j].visibility ?? 1) < 0.4) continue;
      line(g, lm[i].x * w, lm[i].y * h, lm[j].x * w, lm[j].y * h);
    }
    g.fillStyle = '#ffffff';
    for (const i of [LM.NOSE, LM.L_WRIST, LM.R_WRIST, LM.L_SHOULDER, LM.R_SHOULDER]) {
      g.beginPath();
      g.arc(lm[i].x * w, lm[i].y * h, 7, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function line(g, x1, y1, x2, y2) {
  g.beginPath();
  g.moveTo(x1, y1);
  g.lineTo(x2, y2);
  g.stroke();
}

async function pickModel() {
  try {
    const r = await fetch(MODEL_LOCAL, { method: 'HEAD' });
    if (r.ok) return MODEL_LOCAL;
  } catch { /* not there */ }
  return MODEL_REMOTE;
}

function friendlyError(err) {
  const name = err?.name ?? '';
  if (name === 'NotAllowedError') return 'Camera blocked - allow it in the browser, then press R';
  if (name === 'NotFoundError') return 'No webcam found - keyboard mode';
  if (name === 'NotReadableError') return 'Webcam busy in another app - close it, then press R';
  if (location.protocol === 'file:') return 'Start the game with start.bat (not by double-clicking index.html)';
  return 'Body tracking unavailable (' + (err?.message ?? err) + ') - keyboard mode';
}

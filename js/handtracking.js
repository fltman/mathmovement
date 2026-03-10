/**
 * Hand tracking module using MediaPipe Hands.
 * Tracks both hands, detects pinch gesture (thumb + index finger).
 */

export class HandTracker {
  constructor() {
    this.hands = null;
    this.camera = null;
    this.canvas = null;
    this.ctx = null;
    this.videoElement = null;

    // State per hand (0 = right when mirrored, 1 = left)
    this.handStates = [
      { position: null, thumbPos: null, indexPos: null, isGrabbing: false, visible: false, pinchDistance: 1 },
      { position: null, thumbPos: null, indexPos: null, isGrabbing: false, visible: false, pinchDistance: 1 },
    ];

    // Hysteresis: require N consecutive frames in new state before switching
    this.grabCounters = [0, 0];
    this.GRAB_THRESHOLD = 2; // frames required to change state

    // Pinch thresholds (normalized distance between thumb tip and index tip)
    this.PINCH_CLOSE = 0.06;  // distance to trigger grab
    this.PINCH_OPEN = 0.09;   // distance to trigger release (wider to avoid flicker)

    this.onUpdate = null; // callback({ hands: handStates[] })
    this.running = false;
  }

  async init(videoElement, canvasElement) {
    this.videoElement = videoElement;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d');

    if (typeof Hands === 'undefined') {
      console.error('MediaPipe Hands not loaded');
      return false;
    }

    this.hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
      },
    });

    this.hands.setOptions({
      maxNumHands: 2,
      modelComplexity: 1,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.5,
    });

    this.hands.onResults((results) => this._onResults(results));

    return true;
  }

  async startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      });
      this.videoElement.srcObject = stream;

      this.camera = new Camera(this.videoElement, {
        onFrame: async () => {
          if (this.running && this.hands) {
            await this.hands.send({ image: this.videoElement });
          }
        },
        width: 1280,
        height: 720,
      });

      this.running = true;
      await this.camera.start();
      return true;
    } catch (err) {
      console.error('Game camera failed:', err);
      return false;
    }
  }

  stop() {
    this.running = false;
    if (this.camera) {
      this.camera.stop();
      this.camera = null;
    }
    if (this.videoElement && this.videoElement.srcObject) {
      this.videoElement.srcObject.getTracks().forEach(t => t.stop());
      this.videoElement.srcObject = null;
    }
  }

  _onResults(results) {
    this.canvas.width = this.videoElement.videoWidth || 1280;
    this.canvas.height = this.videoElement.videoHeight || 720;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Reset visibility
    this.handStates[0].visible = false;
    this.handStates[1].visible = false;

    if (results.multiHandLandmarks && results.multiHandedness) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        const handedness = results.multiHandedness[i];
        const handIndex = handedness.label === 'Right' ? 0 : 1;

        // Thumb tip = landmark 4, Index finger tip = landmark 8
        const thumb = landmarks[4];
        const index = landmarks[8];

        // Pinch position = midpoint between thumb and index (mirrored X)
        this.handStates[handIndex].position = {
          x: 1 - (thumb.x + index.x) / 2,
          y: (thumb.y + index.y) / 2,
        };
        this.handStates[handIndex].thumbPos = { x: 1 - thumb.x, y: thumb.y };
        this.handStates[handIndex].indexPos = { x: 1 - index.x, y: index.y };
        this.handStates[handIndex].visible = true;

        // Detect pinch gesture
        const dist = this._pinchDistance(thumb, index);
        this.handStates[handIndex].pinchDistance = dist;
        const isPinching = this._detectPinch(handIndex, dist);
        this._updateGrabState(handIndex, isPinching);

        // Draw hand with pinch visualization
        this._drawHand(landmarks, this.handStates[handIndex].isGrabbing, dist);
      }
    }

    if (this.onUpdate) {
      this.onUpdate({ hands: this.handStates });
    }
  }

  /**
   * Euclidean distance between thumb tip and index tip (normalized).
   */
  _pinchDistance(thumb, index) {
    const dx = thumb.x - index.x;
    const dy = thumb.y - index.y;
    const dz = (thumb.z || 0) - (index.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * Detect pinch with hysteresis: close threshold to grab, wider threshold to release.
   */
  _detectPinch(handIndex, dist) {
    const currentlyGrabbing = this.handStates[handIndex].isGrabbing;
    if (currentlyGrabbing) {
      // Must open wider than PINCH_OPEN to release
      return dist < this.PINCH_OPEN;
    } else {
      // Must close tighter than PINCH_CLOSE to grab
      return dist < this.PINCH_CLOSE;
    }
  }

  /**
   * Apply frame-count hysteresis to grab state changes.
   */
  _updateGrabState(handIndex, isGrabbing) {
    const current = this.handStates[handIndex].isGrabbing;
    if (isGrabbing !== current) {
      this.grabCounters[handIndex]++;
      if (this.grabCounters[handIndex] >= this.GRAB_THRESHOLD) {
        this.handStates[handIndex].isGrabbing = isGrabbing;
        this.grabCounters[handIndex] = 0;
      }
    } else {
      this.grabCounters[handIndex] = 0;
    }
  }

  /**
   * Draw hand landmarks with pinch visualization.
   */
  _drawHand(landmarks, isGrabbing, pinchDist) {
    const w = this.canvas.width;
    const h = this.canvas.height;

    const connections = [
      [0, 1], [1, 2], [2, 3], [3, 4],       // Thumb
      [0, 5], [5, 6], [6, 7], [7, 8],       // Index
      [0, 9], [9, 10], [10, 11], [11, 12],  // Middle
      [0, 13], [13, 14], [14, 15], [15, 16], // Ring
      [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
      [5, 9], [9, 13], [13, 17],             // Palm
    ];

    const color = isGrabbing ? '#e77f67' : '#546de5';
    const glowColor = isGrabbing ? 'rgba(231, 127, 103, 0.4)' : 'rgba(84, 109, 229, 0.3)';

    // Draw skeleton
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = 3;
    this.ctx.shadowColor = glowColor;
    this.ctx.shadowBlur = 10;

    for (const [a, b] of connections) {
      const la = landmarks[a];
      const lb = landmarks[b];
      this.ctx.beginPath();
      this.ctx.moveTo((1 - la.x) * w, la.y * h);
      this.ctx.lineTo((1 - lb.x) * w, lb.y * h);
      this.ctx.stroke();
    }

    // Draw joint dots
    this.ctx.shadowBlur = 0;
    for (const lm of landmarks) {
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc((1 - lm.x) * w, lm.y * h, 4, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Draw pinch line between thumb and index
    const thumb = landmarks[4];
    const index = landmarks[8];
    const thumbX = (1 - thumb.x) * w;
    const thumbY = thumb.y * h;
    const indexX = (1 - index.x) * w;
    const indexY = index.y * h;

    // Line between thumb and index - color indicates pinch closeness
    const pinchProgress = Math.max(0, Math.min(1, 1 - (pinchDist - this.PINCH_CLOSE) / (this.PINCH_OPEN - this.PINCH_CLOSE)));
    const lineColor = isGrabbing
      ? '#ff6348'
      : `rgba(${Math.round(84 + pinchProgress * 147)}, ${Math.round(109 - pinchProgress * 10)}, ${Math.round(229 - pinchProgress * 157)}, ${0.5 + pinchProgress * 0.5})`;

    this.ctx.strokeStyle = lineColor;
    this.ctx.lineWidth = isGrabbing ? 4 : 2;
    this.ctx.setLineDash(isGrabbing ? [] : [6, 4]);
    this.ctx.beginPath();
    this.ctx.moveTo(thumbX, thumbY);
    this.ctx.lineTo(indexX, indexY);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    // Highlight thumb tip
    this.ctx.fillStyle = isGrabbing ? '#ff6348' : '#f7d794';
    this.ctx.shadowColor = isGrabbing ? 'rgba(255, 99, 72, 0.6)' : 'rgba(247, 215, 148, 0.5)';
    this.ctx.shadowBlur = 12;
    this.ctx.beginPath();
    this.ctx.arc(thumbX, thumbY, 8, 0, Math.PI * 2);
    this.ctx.fill();

    // Highlight index finger tip
    this.ctx.beginPath();
    this.ctx.arc(indexX, indexY, 8, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw pinch midpoint (the "cursor")
    const midX = (thumbX + indexX) / 2;
    const midY = (thumbY + indexY) / 2;
    this.ctx.fillStyle = isGrabbing ? 'rgba(255, 99, 72, 0.8)' : 'rgba(247, 215, 148, 0.4)';
    this.ctx.shadowBlur = isGrabbing ? 20 : 8;
    this.ctx.beginPath();
    this.ctx.arc(midX, midY, isGrabbing ? 14 : 10, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
  }

  getPrimaryHand() {
    for (const h of this.handStates) {
      if (h.visible) return h;
    }
    return null;
  }
}

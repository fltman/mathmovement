/**
 * Camera module for photo capture of math book pages.
 * Separate from the game webcam.
 */

export class CameraCapture {
  constructor() {
    this.video = document.getElementById('photo-video');
    this.canvas = document.getElementById('photo-canvas');
    this.preview = document.getElementById('photo-preview');
    this.stream = null;
    this.capturedImage = null;
  }

  async start() {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Use rear camera on mobile
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      this.video.srcObject = this.stream;
      this.video.hidden = false;
      this.preview.hidden = true;
      this.capturedImage = null;
      return true;
    } catch (err) {
      console.error('Camera access failed:', err);
      return false;
    }
  }

  snap() {
    this.canvas.width = this.video.videoWidth;
    this.canvas.height = this.video.videoHeight;
    const ctx = this.canvas.getContext('2d');
    ctx.drawImage(this.video, 0, 0);
    this.capturedImage = this.canvas.toDataURL('image/jpeg', 0.85);
    this.preview.src = this.capturedImage;
    this.preview.hidden = false;
    this.video.hidden = true;
    return this.capturedImage;
  }

  retake() {
    this.capturedImage = null;
    this.preview.hidden = true;
    this.video.hidden = false;
  }

  getImage() {
    return this.capturedImage;
  }

  /**
   * Load image from file input.
   */
  loadFromFile(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.capturedImage = e.target.result;
        this.preview.src = this.capturedImage;
        this.preview.hidden = false;
        this.video.hidden = true;
        resolve(this.capturedImage);
      };
      reader.readAsDataURL(file);
    });
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
  }
}

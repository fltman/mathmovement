/**
 * Main application controller.
 * Manages state transitions and wires modules together.
 */

import { CameraCapture } from './camera.js';
import { extractProblems } from './ai.js';
import { HandTracker } from './handtracking.js';
import { Game } from './game.js';
import { ProblemManager } from './problems.js';
import { Report } from './report.js';

// State
const State = {
  START: 'START',
  PHOTO: 'PHOTO',
  PROCESSING: 'PROCESSING',
  PLAYING: 'PLAYING',
  REPORT: 'REPORT',
};

let currentState = State.START;
const pm = new ProblemManager();
const camera = new CameraCapture();
const tracker = new HandTracker();
let game = null;
let report = null;
let handTrackingActive = false;
let prevGrabState = false;
let lastHandSeenTime = 0;
const HAND_LOST_GRACE_MS = 500; // keep grab state for 500ms after losing tracking

// Screen management
function showScreen(state) {
  currentState = state;
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screenMap = {
    [State.START]: 'start-screen',
    [State.PHOTO]: 'photo-screen',
    [State.PROCESSING]: 'processing-screen',
    [State.PLAYING]: 'game-screen',
    [State.REPORT]: 'report-screen',
  };
  document.getElementById(screenMap[state]).classList.add('active');
}

// -- START SCREEN --
document.getElementById('btn-camera-capture').addEventListener('click', async () => {
  showScreen(State.PHOTO);
  const ok = await camera.start();
  if (!ok) {
    alert('Kunde inte starta kameran. Prova att ladda upp en bild istället.');
    showScreen(State.START);
  }
  document.getElementById('btn-snap').hidden = false;
  document.getElementById('btn-retake').hidden = true;
  document.getElementById('btn-use-photo').hidden = true;
});

document.getElementById('btn-file-upload').addEventListener('click', () => {
  document.getElementById('file-input').click();
});

document.getElementById('file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  showScreen(State.PHOTO);
  await camera.loadFromFile(file);
  document.getElementById('btn-snap').hidden = true;
  document.getElementById('btn-retake').hidden = false;
  document.getElementById('btn-use-photo').hidden = false;
  // Reset file input for re-use
  e.target.value = '';
});

document.getElementById('btn-demo').addEventListener('click', () => {
  pm.loadDemo();
  startGame();
});

// -- PHOTO SCREEN --
document.getElementById('btn-snap').addEventListener('click', () => {
  camera.snap();
  document.getElementById('btn-snap').hidden = true;
  document.getElementById('btn-retake').hidden = false;
  document.getElementById('btn-use-photo').hidden = false;
});

document.getElementById('btn-retake').addEventListener('click', () => {
  camera.retake();
  document.getElementById('btn-snap').hidden = false;
  document.getElementById('btn-retake').hidden = true;
  document.getElementById('btn-use-photo').hidden = true;
});

document.getElementById('btn-use-photo').addEventListener('click', async () => {
  const img = camera.getImage();
  if (!img) return;
  camera.stop();
  showScreen(State.PROCESSING);

  try {
    const problems = await extractProblems(img, (status) => {
      document.getElementById('processing-status').textContent = status;
    });

    if (problems.length === 0) {
      alert('Hittade inga matteuppgifter i bilden. Försök med en annan bild eller prova exempeltalen.');
      showScreen(State.START);
      return;
    }

    pm.loadProblems(problems);
    startGame();
  } catch (err) {
    alert(`Fel vid analys: ${err.message}\n\nProva igen eller använd exempeltal.`);
    showScreen(State.START);
  }
});

document.getElementById('btn-back-start').addEventListener('click', () => {
  camera.stop();
  showScreen(State.START);
});

// -- GAME --
async function startGame() {
  showScreen(State.PLAYING);

  game = new Game(pm);
  report = new Report(pm);

  game.onAllSolved = () => {
    showReport();
  };

  // Try to start hand tracking
  const videoEl = document.getElementById('game-video');
  const canvasEl = document.getElementById('game-canvas');

  const initOk = await tracker.init(videoEl, canvasEl);
  if (initOk) {
    const camOk = await tracker.startCamera();
    if (camOk) {
      handTrackingActive = true;
      prevGrabState = false;

      tracker.onUpdate = ({ hands }) => {
        const hand = tracker.getPrimaryHand();
        const now = Date.now();

        if (hand && hand.visible) {
          const timeSinceLost = now - lastHandSeenTime;
          lastHandSeenTime = now;

          // If hand was lost briefly and we were grabbing, keep grab state
          // Don't trigger a false release on the first frame back
          if (timeSinceLost > 100 && timeSinceLost < HAND_LOST_GRACE_MS && prevGrabState) {
            // Hand just came back within grace period - treat as still grabbing
            game.update(hand.position, hand.isGrabbing, hand.isGrabbing);
            prevGrabState = hand.isGrabbing;
          } else {
            const wasGrabbing = prevGrabState;
            prevGrabState = hand.isGrabbing;
            game.update(hand.position, hand.isGrabbing, wasGrabbing);
          }
        }
      };
    }
  }

  // Always enable mouse/touch fallback (works alongside hand tracking)
  game.enableMouseFallback();
  game.start();
}

function stopGame() {
  handTrackingActive = false;
  tracker.stop();
}

// -- REPORT --
function showReport() {
  showScreen(State.REPORT);
  report.render();
}

document.getElementById('btn-report').addEventListener('click', () => {
  if (currentState === State.PLAYING) {
    showReport();
  }
});

document.getElementById('btn-print').addEventListener('click', () => {
  window.print();
});

document.getElementById('btn-back-game').addEventListener('click', () => {
  showScreen(State.PLAYING);
});

document.getElementById('btn-back-start-report').addEventListener('click', () => {
  stopGame();
  showScreen(State.START);
});

document.getElementById('btn-quit').addEventListener('click', () => {
  stopGame();
  showScreen(State.START);
});

// Init
showScreen(State.START);

/**
 * Main game logic.
 * Renders the arithmetic grid, handles number picking and placing,
 * validates answers with carry/borrow support.
 * Player manually places carry/borrow digits.
 */

// Simple fireworks effect
class Fireworks {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.animId = null;
  }

  launch() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    // Create 3 bursts at random positions
    const colors = [
      ['#f7d794', '#f19066', '#e77f67'],
      ['#78e08f', '#38ada9', '#2ed573'],
      ['#546de5', '#3c40c6', '#786fa6'],
      ['#ff6348', '#ff4757', '#ffa502'],
    ];

    for (let b = 0; b < 3; b++) {
      const cx = 0.2 * window.innerWidth + Math.random() * 0.6 * window.innerWidth;
      const cy = 0.2 * window.innerHeight + Math.random() * 0.4 * window.innerHeight;
      const palette = colors[Math.floor(Math.random() * colors.length)];
      const count = 40 + Math.floor(Math.random() * 20);

      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.3;
        const speed = 2 + Math.random() * 5;
        this.particles.push({
          x: cx, y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          color: palette[Math.floor(Math.random() * palette.length)],
          life: 1,
          decay: 0.012 + Math.random() * 0.015,
          size: 3 + Math.random() * 4,
          delay: b * 8,
        });
      }
    }

    if (!this.animId) this._animate();
  }

  _animate() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    let alive = false;
    for (const p of this.particles) {
      if (p.delay > 0) { p.delay--; alive = true; continue; }
      if (p.life <= 0) continue;
      alive = true;

      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08; // gravity
      p.vx *= 0.985;
      p.life -= p.decay;

      this.ctx.globalAlpha = Math.max(0, p.life);
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8;
      const r = Math.max(0.1, p.size * p.life);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      this.ctx.fill();
    }

    this.ctx.globalAlpha = 1;
    this.ctx.shadowBlur = 0;

    if (alive) {
      this.animId = requestAnimationFrame(() => this._animate());
    } else {
      this.particles = [];
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.animId = null;
    }
  }
}

export class Game {
  constructor(problemManager) {
    this.pm = problemManager;
    this.gridEl = document.getElementById('arithmetic-grid');
    this.pickerEl = document.getElementById('number-picker');
    this.grabbedEl = document.getElementById('grabbed-number');
    this.feedbackEl = document.getElementById('feedback-overlay');
    this.feedbackTextEl = document.getElementById('feedback-text');
    this.nextBtn = document.getElementById('btn-next');
    this.counterCurrent = document.getElementById('current-problem');
    this.counterTotal = document.getElementById('total-problems');
    this.sidebarEl = document.getElementById('problem-sidebar');

    // Game state
    this.grabbedDigit = null;
    this.answerCells = [];   // DOM elements for answer row
    this.answerValues = [];  // digit values or null
    this.carryCells = [];    // DOM elements for carry row (player can place digits here)
    this.carryValues = [];   // digit values or null
    this.columnCount = 0;
    this.hoveredPickerZone = null;
    this.hoveredCell = null; // { type: 'answer'|'carry'|'digit1', index: number }
    this.solved = false;

    this.digits1 = [];
    this.digits2 = [];
    this.digits1Display = []; // current display values (affected by borrows)
    this.borrows = [];        // borrows[col] = true if borrowed from this column
    this.digit1Cells = [];    // DOM references to top number cells
    this.problemType = null;
    this.borrowZone = document.querySelector('.borrow-zone');
    this.fireworks = new Fireworks(document.getElementById('fireworks-canvas'));

    this.onAllSolved = null;

    this._bindNextButton();
  }

  _bindNextButton() {
    this.nextBtn.addEventListener('click', () => {
      this.nextBtn.classList.add('hidden');
      if (this.pm.next()) {
        this.renderProblem();
      } else {
        if (this.onAllSolved) this.onAllSolved();
      }
    });
  }

  start() {
    this.counterTotal.textContent = this.pm.getTotal();
    this._renderSidebar();
    this.renderProblem();
  }

  _renderSidebar() {
    this.sidebarEl.innerHTML = '';
    const problems = this.pm.problems;
    const results = this.pm.getResults();
    const currentIdx = this.pm.getCurrentIndex();

    problems.forEach((p, i) => {
      const item = document.createElement('div');
      item.className = 'sidebar-item';

      // Check if solved
      const result = results.find(r =>
        r.problem.numbers[0] === p.numbers[0] &&
        r.problem.numbers[1] === p.numbers[1] &&
        r.correct
      );

      if (result) {
        item.classList.add('done');
      } else if (i === currentIdx) {
        item.classList.add('current');
      }

      const op = p.type === 'addition' ? '+' : '\u2212';
      item.innerHTML = `
        <span class="sidebar-num">${i + 1}.</span>
        <span class="sidebar-problem">${p.numbers[0]} ${op} ${p.numbers[1]}</span>
        <span class="sidebar-status">${result ? '\u2713' : ''}</span>
      `;

      this.sidebarEl.appendChild(item);
    });
  }

  renderProblem() {
    const problem = this.pm.getCurrent();
    if (!problem) return;

    this._renderSidebar();
    this.solved = false;
    this.grabbedDigit = null;
    this.grabbedEl.classList.add('hidden');
    this.feedbackEl.classList.add('hidden');
    this.feedbackEl.classList.remove('correct', 'wrong');
    this.nextBtn.classList.add('hidden');
    this.counterCurrent.textContent = this.pm.getCurrentIndex() + 1;

    this.columnCount = this.pm.getColumnCount(problem);
    this.answerValues = new Array(this.columnCount).fill(null);
    this.carryValues = new Array(this.columnCount).fill(null);
    this.borrows = new Array(this.columnCount).fill(false);
    this.problemType = problem.type;
    this.digits1 = this.pm.getDigits(problem.numbers[0], this.columnCount);
    this.digits2 = this.pm.getDigits(problem.numbers[1], this.columnCount);
    this.digits1Display = [...this.digits1];

    // Show/hide borrow button
    if (this.borrowZone) {
      this.borrowZone.classList.toggle('hidden', problem.type !== 'subtraction');
    }

    this._buildGrid(problem);
  }

  _buildGrid(problem) {
    this.gridEl.innerHTML = '';
    this.answerCells = [];
    this.carryCells = [];
    this.digit1Cells = [];

    const { type } = problem;
    const cols = this.columnCount;
    const operator = type === 'addition' ? '+' : '\u2212';

    // Row 1: Carry/borrow row - player can place digits here
    const carryRow = document.createElement('div');
    carryRow.className = 'grid-row carry-row';
    const opSpaceCarry = document.createElement('div');
    opSpaceCarry.className = 'grid-cell operator-cell';
    carryRow.appendChild(opSpaceCarry);

    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell carry-cell empty';
      cell.dataset.carryCol = c;
      this.carryCells.push(cell);
      carryRow.appendChild(cell);
    }
    this.gridEl.appendChild(carryRow);

    // Row 2: First number
    const row1 = document.createElement('div');
    row1.className = 'grid-row';
    const opSpace1 = document.createElement('div');
    opSpace1.className = 'grid-cell operator-cell';
    row1.appendChild(opSpace1);

    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell digit-cell';
      cell.dataset.row = '0';
      cell.dataset.col = c;
      // Wrap digit in a span so we can add strikethrough + new value
      const digitSpan = document.createElement('span');
      digitSpan.className = 'digit-original';
      digitSpan.textContent = this.digits1[c] !== null ? this.digits1[c] : '';
      cell.appendChild(digitSpan);
      this.digit1Cells.push(cell);
      row1.appendChild(cell);
    }
    this.gridEl.appendChild(row1);

    // Row 3: Operator + Second number
    const row2 = document.createElement('div');
    row2.className = 'grid-row';
    const opCell = document.createElement('div');
    opCell.className = 'grid-cell operator-cell';
    opCell.textContent = operator;
    row2.appendChild(opCell);

    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell digit-cell';
      cell.textContent = this.digits2[c] !== null ? this.digits2[c] : '';
      cell.dataset.row = '1';
      cell.dataset.col = c;
      row2.appendChild(cell);
    }
    this.gridEl.appendChild(row2);

    // Separator line
    const sepRow = document.createElement('div');
    sepRow.className = 'separator-row';
    const sepLine = document.createElement('div');
    sepLine.className = 'separator-line';
    const cellWidth = 80;
    sepLine.style.width = `${(cols + 1) * cellWidth}px`;
    sepLine.style.maxWidth = '95vw';
    sepRow.appendChild(sepLine);
    this.gridEl.appendChild(sepRow);

    // Row 4: Answer cells
    const ansRow = document.createElement('div');
    ansRow.className = 'grid-row';
    const opSpace3 = document.createElement('div');
    opSpace3.className = 'grid-cell operator-cell';
    ansRow.appendChild(opSpace3);

    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'grid-cell answer-cell empty';
      cell.textContent = '_';
      cell.dataset.answerCol = c;
      this.answerCells.push(cell);
      ansRow.appendChild(cell);
    }
    this.gridEl.appendChild(ansRow);
  }

  /**
   * Called each frame with hand tracking data.
   */
  update(handPos, isGrabbing, wasGrabbing) {
    if (!handPos) return;

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    const handX = handPos.x * screenW;
    const handY = handPos.y * screenH;

    if (this.grabbedDigit !== null) {
      this.grabbedEl.style.left = `${handX}px`;
      this.grabbedEl.style.top = `${handY - 40}px`;
    }

    this._updateButtonHover(handX, handY);
    if (isGrabbing && !wasGrabbing) {
      this._pinchClickButton(handX, handY);
    }

    if (this.solved) return;

    this._updatePickerHover(handX, handY);
    this._updateCellHover(handX, handY);

    if (isGrabbing && !wasGrabbing) {
      this._onGrab(handX, handY);
    }

    if (!isGrabbing && wasGrabbing) {
      this._onRelease();
    }
  }

  _updateButtonHover(hx, hy) {
    const buttons = document.querySelectorAll('#game-overlay .btn, #game-overlay .btn-small');
    buttons.forEach(btn => {
      if (btn.classList.contains('hidden')) return;
      const rect = btn.getBoundingClientRect();
      const expand = 5;
      const over = hx >= rect.left - expand && hx <= rect.right + expand &&
                   hy >= rect.top - expand && hy <= rect.bottom + expand;
      btn.classList.toggle('pinch-hover', over);
    });
  }

  _pinchClickButton(hx, hy) {
    const buttons = document.querySelectorAll('#game-overlay .btn, #game-overlay .btn-small');
    for (const btn of buttons) {
      if (btn.classList.contains('hidden')) continue;
      const rect = btn.getBoundingClientRect();
      const expand = 5;
      if (hx >= rect.left - expand && hx <= rect.right + expand &&
          hy >= rect.top - expand && hy <= rect.bottom + expand) {
        btn.click();
        return;
      }
    }
  }

  _updatePickerHover(hx, hy) {
    const zones = this.pickerEl.querySelectorAll('.number-zone');
    this.hoveredPickerZone = null;

    zones.forEach(zone => {
      if (zone.classList.contains('hidden')) return;
      const rect = zone.getBoundingClientRect();
      if (hx >= rect.left && hx <= rect.right && hy >= rect.top && hy <= rect.bottom) {
        zone.classList.add('hover');
        const val = zone.dataset.digit;
        this.hoveredPickerZone = val === 'borrow' ? 'borrow' : parseInt(val);
      } else {
        zone.classList.remove('hover');
      }
    });
  }

  /**
   * Check hover on both answer cells AND carry cells.
   */
  _updateCellHover(hx, hy) {
    this.hoveredCell = null;

    // Remove hover from all
    this.answerCells.forEach(c => c.classList.remove('hover'));
    this.carryCells.forEach(c => c.classList.remove('hover'));
    this.digit1Cells.forEach(c => c.classList.remove('hover'));

    const expand = 10;

    // Check answer cells
    for (let i = 0; i < this.answerCells.length; i++) {
      const rect = this.answerCells[i].getBoundingClientRect();
      if (hx >= rect.left - expand && hx <= rect.right + expand &&
          hy >= rect.top - expand && hy <= rect.bottom + expand) {
        this.answerCells[i].classList.add('hover');
        this.hoveredCell = { type: 'answer', index: i };
        return;
      }
    }

    // Check carry cells
    for (let i = 0; i < this.carryCells.length; i++) {
      const rect = this.carryCells[i].getBoundingClientRect();
      if (hx >= rect.left - expand && hx <= rect.right + expand &&
          hy >= rect.top - expand && hy <= rect.bottom + expand) {
        this.carryCells[i].classList.add('hover');
        this.hoveredCell = { type: 'carry', index: i };
        return;
      }
    }

    // Check digit1 cells (top number) - for borrow target
    if (this.problemType === 'subtraction') {
      for (let i = 0; i < this.digit1Cells.length; i++) {
        const rect = this.digit1Cells[i].getBoundingClientRect();
        if (hx >= rect.left - expand && hx <= rect.right + expand &&
            hy >= rect.top - expand && hy <= rect.bottom + expand) {
          this.digit1Cells[i].classList.add('hover');
          this.hoveredCell = { type: 'digit1', index: i };
          return;
        }
      }
    }
  }

  _onGrab(handX, handY) {
    // Pick up from number picker
    if (this.hoveredPickerZone !== null && this.grabbedDigit === null) {
      this.grabbedDigit = this.hoveredPickerZone;
      this.grabbedEl.textContent = this.grabbedDigit === 'borrow' ? 'Låna' : this.grabbedDigit;
      this.grabbedEl.style.left = `${handX}px`;
      this.grabbedEl.style.top = `${handY - 40}px`;
      this.grabbedEl.classList.remove('hidden');
      if (this.grabbedDigit === 'borrow') {
        this.grabbedEl.classList.add('borrow-grabbed');
      }

      const zone = this.pickerEl.querySelector(`[data-digit="${this.grabbedDigit}"]`);
      if (zone) zone.classList.add('grabbed');
      setTimeout(() => {
        if (zone) zone.classList.remove('grabbed');
      }, 400);
      return;
    }

    // Pick up from a filled cell (answer or carry) - not digit1
    if (this.hoveredCell && this.grabbedDigit === null) {
      const { type, index } = this.hoveredCell;
      if (type === 'digit1') return; // can't pick up from top number
      const values = type === 'answer' ? this.answerValues : this.carryValues;
      const cells = type === 'answer' ? this.answerCells : this.carryCells;

      if (values[index] !== null) {
        this.grabbedDigit = values[index];
        values[index] = null;
        cells[index].textContent = type === 'answer' ? '_' : '';
        cells[index].classList.add('empty');
        cells[index].classList.remove('filled');
        if (type === 'carry') cells[index].classList.remove('carry-active');
        this.grabbedEl.textContent = this.grabbedDigit;
        this.grabbedEl.style.left = `${handX}px`;
        this.grabbedEl.style.top = `${handY - 40}px`;
        this.grabbedEl.classList.remove('hidden');
      }
    }
  }

  _onRelease() {
    if (this.grabbedDigit === null) return;

    // Handle borrow: can drop on digit1 cell or carry cell above it
    if (this.grabbedDigit === 'borrow' && this.hoveredCell &&
        (this.hoveredCell.type === 'digit1' || this.hoveredCell.type === 'carry')) {
      const col = this.hoveredCell.index;
      const d = this.digits1Display[col];

      // Effective value = display digit + any carry above this column
      const carryAbove = parseInt(this.carryCells[col].textContent) || 0;
      const effectiveValue = (d || 0) + carryAbove;

      // Can borrow if effective value > 0 and there's a column to the right
      if (effectiveValue > 0 && col < this.columnCount - 1) {
        if (carryAbove > 0) {
          // Reduce carry by 1 (e.g. 10 → 9)
          const newCarry = carryAbove - 1;
          if (newCarry > 0) {
            this.carryCells[col].textContent = newCarry;
          } else {
            this.carryCells[col].textContent = '';
            this.carryCells[col].classList.remove('filled', 'borrow-ten');
            this.carryCells[col].classList.add('empty');
          }
        } else {
          // Reduce the digit by 1
          const prevDisplay = this.digits1Display[col];
          this.digits1Display[col] = prevDisplay - 1;

          // Update visual: strikethrough previous, show new value
          const cell = this.digit1Cells[col];
          const prevText = cell.querySelector('.digit-new')?.textContent
            ?? cell.querySelector('.digit-original')?.textContent
            ?? prevDisplay;
          cell.innerHTML = '';
          cell.classList.add('borrowed-from');
          const struck = document.createElement('span');
          struck.className = 'digit-struck';
          struck.textContent = prevText;
          cell.appendChild(struck);
          const newVal = document.createElement('span');
          newVal.className = 'digit-new';
          newVal.textContent = this.digits1Display[col];
          cell.appendChild(newVal);
        }

        // Add 10 to the column to the right
        const rightCarry = this.carryCells[col + 1];
        const existing = parseInt(rightCarry.textContent) || 0;
        rightCarry.textContent = existing + 10;
        rightCarry.classList.remove('empty');
        rightCarry.classList.add('filled', 'borrow-ten');
      }

      this.grabbedDigit = null;
      this.grabbedEl.classList.remove('borrow-grabbed');
      this.grabbedEl.classList.add('hidden');
      return;
    }

    // Drop borrow on invalid target - just cancel
    if (this.grabbedDigit === 'borrow') {
      this.grabbedDigit = null;
      this.grabbedEl.classList.remove('borrow-grabbed');
      this.grabbedEl.classList.add('hidden');
      return;
    }

    if (this.hoveredCell) {
      const { type, index } = this.hoveredCell;
      if (type === 'digit1') {
        // Can't place regular digits on top number
        this.grabbedDigit = null;
        this.grabbedEl.classList.add('hidden');
        return;
      }
      const values = type === 'answer' ? this.answerValues : this.carryValues;
      const cells = type === 'answer' ? this.answerCells : this.carryCells;

      values[index] = this.grabbedDigit;
      cells[index].textContent = this.grabbedDigit;
      cells[index].classList.remove('empty');
      cells[index].classList.add('filled');
      if (type === 'carry') cells[index].classList.add('carry-active');

      this.grabbedDigit = null;
      this.grabbedEl.classList.add('hidden');

      this._checkIfComplete();
    } else {
      this.grabbedDigit = null;
      this.grabbedEl.classList.add('hidden');
    }
  }

  _checkIfComplete() {
    // Allow leading empty cells (they count as 0) - needed for addition's extra column
    const problem = this.pm.getCurrent();
    const correctDigits = this.pm.getDigits(
      Math.abs(this.pm.calculateAnswer(problem)),
      this.columnCount
    );

    let allRelevantFilled = true;
    for (let i = 0; i < this.columnCount; i++) {
      if (this.answerValues[i] === null) {
        // Empty cell is OK only if correct digit is also null (leading position)
        if (correctDigits[i] !== null) {
          allRelevantFilled = false;
          break;
        }
      }
    }
    if (!allRelevantFilled) return;

    const correct = this.pm.validateAnswer(problem, this.answerValues);

    this.pm.recordResult(this.answerValues, correct);

    if (correct) {
      this._showCorrect();
    } else {
      this._showWrong();
    }
  }

  _showCorrect() {
    this.solved = true;
    this._renderSidebar();

    this.answerCells.forEach(cell => cell.classList.add('correct-flash'));
    this.fireworks.launch();

    this.feedbackEl.classList.remove('hidden', 'wrong');
    this.feedbackEl.classList.add('correct');
    this.feedbackTextEl.textContent = 'Rätt!';

    setTimeout(() => {
      this.feedbackEl.classList.add('hidden');
      if (this.pm.getCurrentIndex() + 1 < this.pm.getTotal()) {
        this.nextBtn.classList.remove('hidden');
      } else {
        this.nextBtn.textContent = 'Visa rapport';
        this.nextBtn.classList.remove('hidden');
      }
    }, 1500);
  }

  _showWrong() {
    this.answerCells.forEach(cell => cell.classList.add('wrong-flash'));

    this.feedbackEl.classList.remove('hidden', 'correct');
    this.feedbackEl.classList.add('wrong');
    this.feedbackTextEl.textContent = 'Fel, justera ditt svar!';

    setTimeout(() => {
      this.feedbackEl.classList.add('hidden');
      this.feedbackEl.classList.remove('wrong');
      this.answerCells.forEach(cell => cell.classList.remove('wrong-flash'));
    }, 1200);
  }

  enableMouseFallback() {
    let mouseDown = false;

    const getPos = (e) => {
      const x = (e.clientX || e.touches?.[0]?.clientX || 0) / window.innerWidth;
      const y = (e.clientY || e.touches?.[0]?.clientY || 0) / window.innerHeight;
      return { x, y };
    };

    const gameScreen = document.getElementById('game-screen');

    gameScreen.addEventListener('mousedown', (e) => {
      const pos = getPos(e);
      this.update(pos, false, false);
      const wasGrabbing = mouseDown;
      mouseDown = true;
      this.update(pos, true, wasGrabbing);
    });

    gameScreen.addEventListener('mousemove', (e) => {
      const pos = getPos(e);
      this.update(pos, mouseDown, mouseDown);
    });

    gameScreen.addEventListener('mouseup', (e) => {
      const pos = getPos(e);
      mouseDown = false;
      this.update(pos, false, true);
    });

    gameScreen.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const pos = getPos(e);
      this.update(pos, false, false);
      mouseDown = true;
      this.update(pos, true, false);
    }, { passive: false });

    gameScreen.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const pos = getPos(e);
      this.update(pos, true, true);
    }, { passive: false });

    gameScreen.addEventListener('touchend', (e) => {
      e.preventDefault();
      const lastTouch = e.changedTouches?.[0];
      if (lastTouch) {
        const pos = {
          x: lastTouch.clientX / window.innerWidth,
          y: lastTouch.clientY / window.innerHeight,
        };
        mouseDown = false;
        this.update(pos, false, true);
      }
    }, { passive: false });
  }
}

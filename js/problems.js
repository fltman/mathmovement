/**
 * Problem data management.
 * Stores problems, tracks progress, handles answer validation
 * including borrowing/carrying logic.
 */

const DEMO_PROBLEMS = [
  { type: 'subtraction', numbers: [7632, 4321] },
  { type: 'addition', numbers: [3456, 2187] },
  { type: 'subtraction', numbers: [832, 457] },
  { type: 'addition', numbers: [1567, 2845] },
  { type: 'subtraction', numbers: [5041, 1876] },
];

export class ProblemManager {
  constructor() {
    this.problems = [];
    this.currentIndex = 0;
    this.results = []; // { problem, playerAnswer, correctAnswer, correct, timestamp }
  }

  loadProblems(problems) {
    this.problems = problems;
    this.currentIndex = 0;
    this.results = [];
  }

  loadDemo() {
    this.loadProblems(DEMO_PROBLEMS);
  }

  getCurrent() {
    if (this.currentIndex >= this.problems.length) return null;
    return this.problems[this.currentIndex];
  }

  getTotal() {
    return this.problems.length;
  }

  getCurrentIndex() {
    return this.currentIndex;
  }

  /**
   * Calculate the correct answer for a problem.
   */
  calculateAnswer(problem) {
    if (problem.type === 'addition') {
      return problem.numbers.reduce((a, b) => a + b, 0);
    } else {
      return problem.numbers[0] - problem.numbers[1];
    }
  }

  /**
   * Get the number of digit columns needed for a problem.
   * Includes space for potential carry in addition.
   */
  getColumnCount(problem) {
    const maxNum = Math.max(...problem.numbers);
    const answer = this.calculateAnswer(problem);
    const maxDigits = Math.max(
      maxNum.toString().length,
      Math.abs(answer).toString().length
    );
    // Add one extra column for potential carry in addition
    if (problem.type === 'addition') {
      return maxDigits + 1;
    }
    return maxDigits;
  }

  /**
   * Get digits of a number, right-aligned to columnCount.
   * Returns array of digits (or null for empty leading positions).
   */
  getDigits(number, columnCount) {
    const str = number.toString();
    const digits = [];
    for (let i = 0; i < columnCount; i++) {
      const idx = str.length - (columnCount - i);
      if (idx >= 0) {
        digits.push(parseInt(str[idx]));
      } else {
        digits.push(null);
      }
    }
    return digits;
  }

  /**
   * Validate the player's answer.
   * playerDigits: array of digits (left to right), null for unfilled.
   */
  validateAnswer(problem, playerDigits) {
    const correctAnswer = this.calculateAnswer(problem);
    const columnCount = this.getColumnCount(problem);
    const correctDigits = this.getDigits(Math.abs(correctAnswer), columnCount);

    // Compare each digit
    for (let i = 0; i < columnCount; i++) {
      const playerD = playerDigits[i];
      const correctD = correctDigits[i];
      if (correctD === null && (playerD === null || playerD === undefined)) continue;
      if (correctD === null && playerD === 0) continue; // Leading zero is ok
      if (playerD !== correctD) return false;
    }
    return true;
  }

  /**
   * Record a result for the current problem.
   */
  recordResult(playerDigits, correct) {
    const problem = this.getCurrent();
    if (!problem) return;

    // Convert player digits to number
    const playerAnswer = parseInt(
      playerDigits.map(d => (d === null || d === undefined) ? '0' : d.toString()).join('')
    );

    this.results.push({
      problem: { ...problem },
      playerAnswer,
      correctAnswer: this.calculateAnswer(problem),
      correct,
      timestamp: new Date(),
    });
  }

  /**
   * Move to next problem. Returns false if no more problems.
   */
  next() {
    this.currentIndex++;
    return this.currentIndex < this.problems.length;
  }

  /**
   * Get all results for reporting.
   */
  getResults() {
    return this.results;
  }

  /**
   * Get summary stats.
   */
  getSummary() {
    const total = this.results.length;
    const correct = this.results.filter(r => r.correct).length;
    return { total, correct, incorrect: total - correct };
  }

  /**
   * Calculate carry values for an addition problem, column by column (right to left).
   * Returns array of carry values per column (index 0 = rightmost).
   */
  getCarries(problem) {
    if (problem.type !== 'addition') return [];
    const cols = this.getColumnCount(problem);
    const num1Digits = this.getDigits(problem.numbers[0], cols);
    const num2Digits = this.getDigits(problem.numbers[1], cols);

    const carries = new Array(cols).fill(0);
    let carry = 0;

    // Process right to left
    for (let i = cols - 1; i >= 0; i--) {
      const d1 = num1Digits[i] || 0;
      const d2 = num2Digits[i] || 0;
      const sum = d1 + d2 + carry;
      carry = Math.floor(sum / 10);
      if (i > 0) {
        carries[i - 1] = carry;
      }
    }
    return carries;
  }
}

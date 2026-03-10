/**
 * Report module - generates visual report of completed problems.
 */

export class Report {
  constructor(problemManager) {
    this.pm = problemManager;
    this.summaryEl = document.getElementById('report-summary');
    this.listEl = document.getElementById('report-list');
  }

  render() {
    const summary = this.pm.getSummary();
    const results = this.pm.getResults();

    // Summary
    const pct = summary.total > 0 ? Math.round((summary.correct / summary.total) * 100) : 0;
    this.summaryEl.innerHTML = `
      <div class="big-number">${summary.correct} / ${summary.total}</div>
      <div class="label">rätt svar (${pct}%)</div>
    `;

    // Problem list
    this.listEl.innerHTML = '';
    results.forEach((result, i) => {
      const div = document.createElement('div');
      div.className = `report-problem ${result.correct ? 'correct' : 'incorrect'}`;

      const { problem, playerAnswer, correctAnswer } = result;
      const operator = problem.type === 'addition' ? '+' : '-';
      const maxLen = Math.max(
        problem.numbers[0].toString().length,
        problem.numbers[1].toString().length,
        Math.abs(correctAnswer).toString().length,
        playerAnswer.toString().length
      );

      const pad = (n) => n.toString().padStart(maxLen, ' ');

      let display = `  ${pad(problem.numbers[0])}\n${operator} ${pad(problem.numbers[1])}\n${'─'.repeat(maxLen + 2)}\n`;

      if (result.correct) {
        display += `  ${pad(playerAnswer)}`;
      } else {
        display += `  ${pad(playerAnswer)}  (rätt: ${correctAnswer})`;
      }

      const timeStr = result.timestamp.toLocaleTimeString('sv-SE', {
        hour: '2-digit',
        minute: '2-digit',
      });

      div.innerHTML = `
        <div class="problem-display">${display}</div>
        <div class="problem-result">
          ${result.correct ? 'Rätt' : 'Fel'} - ${timeStr}
        </div>
      `;

      this.listEl.appendChild(div);
    });
  }
}

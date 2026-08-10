/* ============================================================
   TRAINING MODULE
   Training session management, scenario configuration,
   performance history, and after-action review.
   ============================================================ */

class TrainingModule {
  constructor(containerId, eventBus, telemetrySim) {
    this.container = document.getElementById(containerId);
    this.eventBus = eventBus;
    this.telemetry = telemetrySim;
    this.trainingHistory = Storage.get('training_history', []);
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this._buildLayout();

    this.eventBus.on('emergency:resolve', (data) => {
      this._recordSession(data);
      this._updateHistoryDisplay();
      this._updateStats();
    });
  }

  _buildLayout() {
    this.container.innerHTML = `
      <!-- Training Header -->
      <div class="training-header">
        <div class="training-header-left">
          <h2 class="text-display">Training & Simulation</h2>
          <span class="text-label">Crew Readiness Assessment Platform</span>
        </div>
        <div class="training-header-right">
          <div class="training-stat-mini">
            <span class="text-label">SESSIONS</span>
            <span class="text-mono text-value" id="training-total-sessions">${this.trainingHistory.length}</span>
          </div>
          <div class="training-stat-mini">
            <span class="text-label">AVG SCORE</span>
            <span class="text-mono text-value" id="training-avg-score">${this._getAvgScore()}%</span>
          </div>
        </div>
      </div>

      <!-- Main Grid -->
      <div class="training-main-grid">
        <!-- Left: Readiness Overview -->
        <div class="training-readiness-section">
          <div class="section-title">
            <h3 class="text-display">Crew Readiness Matrix</h3>
          </div>
          <div class="glass-card readiness-matrix">
            <table class="readiness-table">
              <thead>
                <tr>
                  <th class="text-label">CREW</th>
                  <th class="text-label">DEPRESS</th>
                  <th class="text-label">FIRE</th>
                  <th class="text-label">POWER</th>
                  <th class="text-label">MEDICAL</th>
                  <th class="text-label">DEBRIS</th>
                  <th class="text-label">COMMS</th>
                  <th class="text-label">OVERALL</th>
                </tr>
              </thead>
              <tbody>
                ${CREW_DATA.map(member => `
                  <tr>
                    <td>
                      <div class="readiness-crew">
                        <span class="crew-dot" style="background: ${member.color}"></span>
                        <span>${member.callsign}</span>
                      </div>
                    </td>
                    ${this._generateReadinessScores(6)}
                    <td><span class="readiness-overall text-mono">${75 + Math.floor(Math.random() * 20)}%</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Training Scenarios Quick Launch -->
          <div class="section-title" style="margin-top: 24px;">
            <h3 class="text-display">Quick Launch</h3>
            <span class="text-label">START A TRAINING SESSION</span>
          </div>
          <div class="training-quick-grid">
            ${this._buildQuickLaunchCards()}
          </div>
        </div>

        <!-- Right: History & Stats -->
        <div class="training-history-section">
          <!-- Performance Chart -->
          <div class="section-title">
            <h3 class="text-display">Performance Trend</h3>
          </div>
          <div class="glass-card performance-chart-container">
            <canvas id="chart-training-performance"></canvas>
          </div>

          <!-- Scenario Completion Stats -->
          <div class="section-title" style="margin-top: 20px;">
            <h3 class="text-display">Scenario Statistics</h3>
          </div>
          <div class="glass-card scenario-stats-container">
            <div class="scenario-stats-grid" id="scenario-stats-grid">
              ${this._buildScenarioStats()}
            </div>
          </div>

          <!-- Recent Sessions -->
          <div class="section-title" style="margin-top: 20px;">
            <h3 class="text-display">Recent Sessions</h3>
          </div>
          <div class="glass-card sessions-container">
            <div class="sessions-list" id="sessions-list">
              ${this._buildSessionsList()}
            </div>
          </div>

          <!-- Training Recommendations -->
          <div class="section-title" style="margin-top: 20px;">
            <h3 class="text-display">Recommendations</h3>
          </div>
          <div class="glass-card recommendations-container">
            <div class="recommendation-list">
              <div class="recommendation-item">
                <span class="recommendation-icon">📋</span>
                <div class="recommendation-content">
                  <span class="recommendation-title">Fire Response Drill Needed</span>
                  <span class="recommendation-desc text-label">Last completed: 12 days ago. Recommended frequency: weekly.</span>
                </div>
                <span class="recommendation-priority warning">OVERDUE</span>
              </div>
              <div class="recommendation-item">
                <span class="recommendation-icon">🎯</span>
                <div class="recommendation-content">
                  <span class="recommendation-title">Improve Decision Speed</span>
                  <span class="recommendation-desc text-label">Average response time is 15% above target. Focus on rapid triage exercises.</span>
                </div>
                <span class="recommendation-priority info">SUGGESTED</span>
              </div>
              <div class="recommendation-item">
                <span class="recommendation-icon">⭐</span>
                <div class="recommendation-content">
                  <span class="recommendation-title">Depressurization Mastery</span>
                  <span class="recommendation-desc text-label">Crew achieved 95%+ in last 3 drills. Consider advanced difficulty.</span>
                </div>
                <span class="recommendation-priority nominal">ACHIEVED</span>
              </div>
              <div class="recommendation-item">
                <span class="recommendation-icon">🔄</span>
                <div class="recommendation-content">
                  <span class="recommendation-title">Multi-Failure Scenario</span>
                  <span class="recommendation-desc text-label">Team ready for combined emergency scenarios (e.g., power failure + medical).</span>
                </div>
                <span class="recommendation-priority info">SUGGESTED</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._initPerformanceChart();
  }

  _generateReadinessScores(count) {
    let cells = '';
    for (let i = 0; i < count; i++) {
      const score = 60 + Math.floor(Math.random() * 35);
      const color = score >= 85 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444';
      cells += `<td><span class="readiness-score text-mono" style="color: ${color}">${score}</span></td>`;
    }
    return cells;
  }

  _buildQuickLaunchCards() {
    const scenarios = [
      { id: 'cabin-depressurization', icon: '💨', name: 'Depressurization', difficulty: 'Hard' },
      { id: 'fire', icon: '🔥', name: 'Fire Response', difficulty: 'Hard' },
      { id: 'power-failure', icon: '⚡', name: 'Power Failure', difficulty: 'Medium' },
      { id: 'medical-emergency', icon: '🏥', name: 'Medical Emergency', difficulty: 'Hard' },
      { id: 'comm-blackout', icon: '📡', name: 'Comm Blackout', difficulty: 'Medium' },
      { id: 'coolant-leak', icon: '🧊', name: 'Coolant Leak', difficulty: 'Medium' }
    ];

    return scenarios.map(s => `
      <div class="training-quick-card glass-card" onclick="window.app && window.app.navigateTo('emergency')">
        <span class="quick-card-icon">${s.icon}</span>
        <span class="quick-card-name">${s.name}</span>
        <span class="quick-card-difficulty text-label">${s.difficulty}</span>
      </div>
    `).join('');
  }

  _buildScenarioStats() {
    const scenarios = [
      { name: 'Depressurization', completed: 12, bestScore: 92, avgScore: 81 },
      { name: 'Fire Response', completed: 8, bestScore: 88, avgScore: 74 },
      { name: 'Power Failure', completed: 15, bestScore: 95, avgScore: 86 },
      { name: 'Medical Emergency', completed: 6, bestScore: 78, avgScore: 68 },
      { name: 'Debris Impact', completed: 4, bestScore: 72, avgScore: 65 },
      { name: 'Comm Blackout', completed: 10, bestScore: 90, avgScore: 82 }
    ];

    return scenarios.map(s => `
      <div class="scenario-stat-row">
        <span class="scenario-stat-name">${s.name}</span>
        <span class="scenario-stat-count text-mono">${s.completed}x</span>
        <div class="scenario-stat-bar-container">
          <div class="scenario-stat-bar" style="width: ${s.avgScore}%; background: ${s.avgScore >= 80 ? '#10b981' : s.avgScore >= 60 ? '#f59e0b' : '#ef4444'}"></div>
        </div>
        <span class="scenario-stat-score text-mono">${s.avgScore}%</span>
      </div>
    `).join('');
  }

  _buildSessionsList() {
    // Use stored history or generate sample
    const sessions = this.trainingHistory.length > 0
      ? this.trainingHistory.slice(-5).reverse()
      : [
        { date: '2026-08-07', scenario: 'Power Failure', score: 87, duration: '6:42' },
        { date: '2026-08-06', scenario: 'Fire Response', score: 74, duration: '5:18' },
        { date: '2026-08-05', scenario: 'Depressurization', score: 92, duration: '7:55' },
        { date: '2026-08-04', scenario: 'Comm Blackout', score: 88, duration: '4:30' },
        { date: '2026-08-03', scenario: 'Medical Emergency', score: 71, duration: '8:12' }
      ];

    if (sessions.length === 0) {
      return '<div class="empty-state text-label">No training sessions yet. Launch a scenario to begin.</div>';
    }

    return sessions.map(s => `
      <div class="session-row">
        <span class="session-date text-mono">${s.date}</span>
        <span class="session-scenario">${s.scenario}</span>
        <span class="session-score text-mono" style="color: ${s.score >= 80 ? '#10b981' : s.score >= 60 ? '#f59e0b' : '#ef4444'}">${s.score}%</span>
        <span class="session-duration text-mono text-muted">${s.duration}</span>
      </div>
    `).join('');
  }

  _initPerformanceChart() {
    const ctx = document.getElementById('chart-training-performance');
    if (!ctx) return;

    const labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6', 'Week 7', 'Week 8'];
    const data = [65, 70, 72, 78, 76, 82, 85, 88];

    this.performanceChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Average Score',
          data,
          borderColor: '#00f0ff',
          backgroundColor: 'rgba(0, 240, 255, 0.1)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: '#00f0ff',
          pointBorderColor: '#0a0e1a',
          pointBorderWidth: 2,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(17, 24, 39, 0.9)',
            titleColor: '#f1f5f9',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(0, 240, 255, 0.3)',
            borderWidth: 1,
            cornerRadius: 6
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(30, 41, 59, 0.3)' },
            ticks: {
              color: '#64748b',
              font: { family: "'Inter', sans-serif", size: 10 }
            }
          },
          y: {
            min: 50,
            max: 100,
            grid: { color: 'rgba(30, 41, 59, 0.3)' },
            ticks: {
              color: '#64748b',
              font: { family: "'JetBrains Mono', monospace", size: 10 },
              callback: v => v + '%'
            }
          }
        }
      }
    });
  }

  _recordSession(data) {
    const now = new Date();
    const session = {
      date: now.toISOString().split('T')[0],
      scenario: data.scenario,
      score: data.score?.total || 0,
      duration: '—'
    };
    this.trainingHistory.push(session);
    Storage.set('training_history', this.trainingHistory.slice(-50)); // Keep last 50
  }

  _updateHistoryDisplay() {
    const list = document.getElementById('sessions-list');
    if (list) list.innerHTML = this._buildSessionsList();
  }

  _updateStats() {
    const totalEl = document.getElementById('training-total-sessions');
    const avgEl = document.getElementById('training-avg-score');
    if (totalEl) totalEl.textContent = this.trainingHistory.length;
    if (avgEl) avgEl.textContent = this._getAvgScore() + '%';
  }

  _getAvgScore() {
    if (this.trainingHistory.length === 0) return 82; // Default display value
    const sum = this.trainingHistory.reduce((acc, s) => acc + (s.score || 0), 0);
    return Math.round(sum / this.trainingHistory.length);
  }

  destroy() {
    if (this.performanceChart) this.performanceChart.destroy();
  }
}

window.TrainingModule = TrainingModule;

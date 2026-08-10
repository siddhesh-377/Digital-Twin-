/* ============================================================
   EMERGENCY PANEL
   Emergency scenario simulation with cascade failure modeling,
   decision trees, response tracking, and performance scoring.
   ============================================================ */

class EmergencyPanel {
  constructor(containerId, eventBus, telemetrySim) {
    this.container = document.getElementById(containerId);
    this.eventBus = eventBus;
    this.telemetry = telemetrySim;
    this.activeScenario = null;
    this.responseLog = [];
    this.scenarioStartTime = null;
    this.decisionHistory = [];
    this.score = { total: 0, speed: 0, accuracy: 0, completeness: 0 };
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this._buildLayout();

    this.eventBus.on('telemetry:update', (data) => this._updateActiveScenario(data));
  }

  _buildLayout() {
    this.container.innerHTML = `
      <!-- Emergency Header -->
      <div class="emergency-header">
        <div class="emergency-header-left">
          <h2 class="text-display">Emergency Scenarios</h2>
          <span class="text-label">Simulation & Training Module</span>
        </div>
        <div class="emergency-header-right">
          <div class="emergency-active-indicator" id="emergency-status-indicator">
            <span class="status-dot nominal"></span>
            <span class="text-mono">ALL SYSTEMS NOMINAL</span>
          </div>
        </div>
      </div>

      <!-- Scenario Selection Grid -->
      <div class="section-title">
        <h3 class="text-display">Scenario Library</h3>
        <span class="text-label">SELECT A SCENARIO TO BEGIN</span>
      </div>
      <div class="scenario-grid" id="scenario-grid"></div>

      <!-- Active Scenario Panel (hidden initially) -->
      <div class="active-scenario-panel" id="active-scenario-panel" style="display: none;">
        <!-- Scenario Info Bar -->
        <div class="scenario-info-bar glass-card" id="scenario-info-bar">
          <div class="scenario-info-left">
            <span class="scenario-active-icon" id="scenario-active-icon">🔥</span>
            <div>
              <h3 class="text-display" id="scenario-active-name">—</h3>
              <span class="text-label" id="scenario-active-desc">—</span>
            </div>
          </div>
          <div class="scenario-info-right">
            <div class="scenario-timer">
              <span class="text-label">ELAPSED</span>
              <span class="text-mono scenario-timer-value" id="scenario-elapsed">00:00</span>
            </div>
            <span class="severity-badge" id="scenario-severity-badge">CRITICAL</span>
            <button class="btn-resolve" id="btn-resolve-scenario" onclick="window.emergencyPanel.resolveScenario()">
              RESOLVE SCENARIO
            </button>
          </div>
        </div>

        <!-- Cascade + Decision Grid -->
        <div class="emergency-main-grid">
          <!-- Cascade Failure Tree -->
          <div class="cascade-section">
            <div class="section-title">
              <h3 class="text-display">Cascade Analysis</h3>
            </div>
            <div class="glass-card cascade-container">
              <div class="cascade-tree" id="cascade-tree"></div>
            </div>
          </div>

          <!-- Decision Tree -->
          <div class="decision-section">
            <div class="section-title">
              <h3 class="text-display">Response Actions</h3>
            </div>
            <div class="glass-card decision-container">
              <div class="decision-tree" id="decision-tree"></div>
            </div>
          </div>

          <!-- Response Timeline -->
          <div class="response-section">
            <div class="section-title">
              <h3 class="text-display">Response Timeline</h3>
            </div>
            <div class="glass-card response-container">
              <div class="response-timeline" id="response-timeline"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Score Panel (shown after resolution) -->
      <div class="score-panel-overlay" id="score-panel" style="display: none;">
        <div class="glass-card score-card">
          <h3 class="text-display">Performance Assessment</h3>
          <div class="score-main">
            <div class="score-circle">
              <svg viewBox="0 0 120 120">
                <circle class="gauge-bg" cx="60" cy="60" r="52" />
                <circle class="gauge-ring" cx="60" cy="60" r="52" id="score-ring"
                        style="stroke: #10b981" />
              </svg>
              <div class="gauge-center">
                <span class="score-value text-mono" id="score-total-value">0</span>
                <span class="gauge-unit">/ 100</span>
              </div>
            </div>
          </div>
          <div class="score-breakdown">
            <div class="score-category">
              <span class="text-label">Response Speed</span>
              <div class="score-bar-container">
                <div class="score-bar" id="score-speed-bar" style="width: 0%; background: #3b82f6"></div>
              </div>
              <span class="text-mono" id="score-speed-value">0</span>
            </div>
            <div class="score-category">
              <span class="text-label">Decision Accuracy</span>
              <div class="score-bar-container">
                <div class="score-bar" id="score-accuracy-bar" style="width: 0%; background: #10b981"></div>
              </div>
              <span class="text-mono" id="score-accuracy-value">0</span>
            </div>
            <div class="score-category">
              <span class="text-label">Procedure Completeness</span>
              <div class="score-bar-container">
                <div class="score-bar" id="score-completeness-bar" style="width: 0%; background: #8b5cf6"></div>
              </div>
              <span class="text-mono" id="score-completeness-value">0</span>
            </div>
          </div>
          <button class="btn-primary" onclick="window.emergencyPanel.closeScore()">RETURN TO SCENARIOS</button>
        </div>
      </div>
    `;

    this._buildScenarioGrid();
  }

  _buildScenarioGrid() {
    const grid = document.getElementById('scenario-grid');
    const scenarios = this._getScenarios();

    scenarios.forEach(scenario => {
      const card = DOM.create('div', {
        className: `scenario-card severity-${scenario.severity}`,
        html: `
          <div class="scenario-card-icon">${scenario.icon}</div>
          <div class="scenario-card-content">
            <h4 class="scenario-card-name">${scenario.name}</h4>
            <p class="scenario-card-desc">${scenario.description}</p>
          </div>
          <div class="scenario-card-footer">
            <span class="severity-badge ${scenario.severity}">${scenario.severity.toUpperCase()}</span>
            <span class="text-label">~${scenario.duration}min</span>
          </div>
        `,
        parent: grid
      });

      card.addEventListener('click', () => this.triggerScenario(scenario));
    });
  }

  _getScenarios() {
    return [
      {
        id: 'cabin-depressurization',
        name: 'Cabin Depressurization',
        icon: '💨',
        description: 'Rapid pressure loss detected in the habitation module. Crew must locate the leak and execute emergency sealing procedures.',
        severity: 'critical',
        duration: 8,
        cascadeEffects: ['life-support', 'structural', 'laboratory'],
        decisions: [
          { question: 'First response action?', options: ['Sound alarm & don O₂ masks', 'Locate leak source', 'Seal hatches to isolate'], correct: 0 },
          { question: 'Leak located in Node 2. Action?', options: ['Apply emergency patch', 'Evacuate & seal module', 'Both: Evacuate then patch'], correct: 2 },
          { question: 'Pressure stabilized at 13.2 psi. Next?', options: ['Monitor only', 'Begin re-pressurization', 'Full module inspection first'], correct: 2 }
        ]
      },
      {
        id: 'fire',
        name: 'Onboard Fire',
        icon: '🔥',
        description: 'Smoke and thermal alert triggered in the Columbus module electrical panel. Execute fire response protocol.',
        severity: 'critical',
        duration: 6,
        cascadeEffects: ['life-support', 'power', 'laboratory'],
        decisions: [
          { question: 'Immediate action?', options: ['Alert crew & activate alarm', 'Cut power to affected panel', 'Grab fire extinguisher'], correct: 0 },
          { question: 'Fire source identified. Next?', options: ['Deploy PFE extinguisher', 'Ventilation shutoff first', 'Both: Shutoff then extinguish'], correct: 2 },
          { question: 'Fire suppressed. Post-fire action?', options: ['Resume operations', 'Air quality sampling', 'Full electrical inspection'], correct: 1 }
        ]
      },
      {
        id: 'power-failure',
        name: 'Power System Failure',
        icon: '⚡',
        description: 'Main Bus A undervoltage detected. Solar array alpha joint malfunction causing reduced power generation.',
        severity: 'warning',
        duration: 10,
        cascadeEffects: ['power', 'thermal', 'laboratory', 'communications'],
        decisions: [
          { question: 'Initial response?', options: ['Switch to backup bus', 'Shed non-critical loads', 'Diagnose SARJ malfunction'], correct: 1 },
          { question: 'Load shed complete. Battery at 65%. Next?', options: ['Wait for orbital daylight', 'Attempt SARJ manual override', 'Both: Override + wait'], correct: 2 },
          { question: 'SARJ partially recovered. Action?', options: ['Restore all loads', 'Gradual load restoration', 'Keep minimal loads'], correct: 1 }
        ]
      },
      {
        id: 'medical-emergency',
        name: 'Medical Emergency',
        icon: '🏥',
        description: 'Crew member experiencing cardiac arrhythmia and elevated stress response. CMO must assess and stabilize.',
        severity: 'critical',
        duration: 7,
        cascadeEffects: ['life-support'],
        decisions: [
          { question: 'First response?', options: ['Begin vitals monitoring', 'Administer medication', 'Contact flight surgeon'], correct: 0 },
          { question: 'Vitals showing tachycardia. Action?', options: ['Administer beta-blocker', 'Non-pharmacological intervention first', 'Emergency deorbit prep'], correct: 1 },
          { question: 'Heart rate stabilizing. Next?', options: ['Resume duties', 'Rest period + continuous monitoring', 'Prepare for medevac'], correct: 1 }
        ]
      },
      {
        id: 'debris-impact',
        name: 'Micrometeorite Impact',
        icon: '☄️',
        description: 'MMOD impact detected on port-side truss segment. Hull integrity sensors triggered. Potential breach.',
        severity: 'critical',
        duration: 12,
        cascadeEffects: ['structural', 'life-support', 'power', 'thermal'],
        decisions: [
          { question: 'Impact detected. First action?', options: ['Seal all hatches', 'Check pressure readings', 'Visual inspection'], correct: 0 },
          { question: 'Slow leak detected in truss area. Action?', options: ['EVA repair immediately', 'Internal sealant application', 'Isolate & assess damage extent'], correct: 2 },
          { question: 'Damage assessed as repairable. Next?', options: ['Plan EVA repair', 'Robotic arm inspection first', 'Apply temporary sealant'], correct: 1 }
        ]
      },
      {
        id: 'comm-blackout',
        name: 'Communication Blackout',
        icon: '📡',
        description: 'Total loss of TDRS relay link. No ground contact. Crew must operate autonomously.',
        severity: 'warning',
        duration: 5,
        cascadeEffects: ['communications', 'navigation'],
        decisions: [
          { question: 'All comm lost. First action?', options: ['Switch to backup antenna', 'Begin autonomous ops protocol', 'Attempt direct ground link'], correct: 1 },
          { question: 'Backup antenna shows same issue. Action?', options: ['Wait for TDRS handover', 'Diagnose onboard comm system', 'Both: Diagnose while waiting'], correct: 2 },
          { question: 'Partial link restored. Next?', options: ['Full status report to ground', 'Verify data integrity first', 'Resume normal operations'], correct: 1 }
        ]
      },
      {
        id: 'coolant-leak',
        name: 'Ammonia Coolant Leak',
        icon: '🧊',
        description: 'External thermal loop ammonia leak detected. Photovoltaic thermal control compromised.',
        severity: 'warning',
        duration: 9,
        cascadeEffects: ['thermal', 'power', 'laboratory'],
        decisions: [
          { question: 'Ammonia leak detected. Action?', options: ['Isolate affected loop', 'Emergency EVA prep', 'Switch to backup loop'], correct: 0 },
          { question: 'Loop A isolated. Temps rising. Next?', options: ['Activate backup loop immediately', 'Reduce heat-generating loads', 'Both: Backup + load reduction'], correct: 2 },
          { question: 'Temps stabilized. Long-term fix?', options: ['Plan EVA repair', 'Ground-controlled robotic fix', 'Operate on single loop'], correct: 0 }
        ]
      },
      {
        id: 'cmg-failure',
        name: 'CMG Saturation',
        icon: '🔄',
        description: 'Control Moment Gyroscope reaching saturation. Station attitude control degrading. Momentum dump required.',
        severity: 'warning',
        duration: 6,
        cascadeEffects: ['navigation', 'power', 'communications'],
        decisions: [
          { question: 'CMGs nearing saturation. Action?', options: ['Initiate momentum dump', 'Switch to thruster control', 'Adjust attitude first'], correct: 0 },
          { question: 'Dump partially effective. Attitude drifting. Next?', options: ['Secondary thruster burn', 'CMG desaturation maneuver', 'Free-drift mode temporarily'], correct: 1 },
          { question: 'CMGs desaturated. Next?', options: ['Resume TEA attitude', 'Full GNC system checkout', 'Monitor before resuming'], correct: 1 }
        ]
      }
    ];
  }

  triggerScenario(scenario) {
    this.activeScenario = scenario;
    this.scenarioStartTime = Date.now();
    this.responseLog = [];
    this.decisionHistory = [];

    // Inject anomaly into telemetry
    this.telemetry.injectAnomaly(scenario.id, scenario.severity);

    // Update UI
    document.getElementById('scenario-grid').style.display = 'none';
    document.getElementById('active-scenario-panel').style.display = 'block';

    // Set active indicator
    const indicator = document.getElementById('emergency-status-indicator');
    indicator.innerHTML = `
      <span class="status-dot critical"></span>
      <span class="text-mono" style="color: var(--accent-red)">⚠ EMERGENCY ACTIVE</span>
    `;

    // Fill scenario info
    document.getElementById('scenario-active-icon').textContent = scenario.icon;
    document.getElementById('scenario-active-name').textContent = scenario.name;
    document.getElementById('scenario-active-desc').textContent = scenario.description;
    const sevBadge = document.getElementById('scenario-severity-badge');
    sevBadge.textContent = scenario.severity.toUpperCase();
    sevBadge.className = `severity-badge ${scenario.severity}`;

    // Toggle red alert mode
    document.body.classList.add('red-alert');

    // Build cascade tree
    this._buildCascadeTree(scenario);

    // Build decision tree
    this._buildDecisionTree(scenario);

    // Build response timeline
    this._buildResponseTimeline(scenario);

    // Start elapsed timer
    this._startTimer();

    // Emit event
    this.eventBus.emit('emergency:trigger', { scenario: scenario.id, severity: scenario.severity });

    // Notify via toast
    if (window.toastManager) {
      window.toastManager.show(
        `${scenario.name}: ${scenario.description}`,
        'critical',
        0 // persistent
      );
    }
  }

  resolveScenario() {
    if (!this.activeScenario) return;

    // Clear anomaly
    this.telemetry.clearAnomaly(this.activeScenario.id);

    // Calculate score
    this._calculateScore();

    // Show score panel
    document.getElementById('active-scenario-panel').style.display = 'none';
    document.getElementById('score-panel').style.display = 'flex';

    // Remove red alert
    document.body.classList.remove('red-alert');

    // Update indicator
    const indicator = document.getElementById('emergency-status-indicator');
    indicator.innerHTML = `
      <span class="status-dot nominal"></span>
      <span class="text-mono">ALL SYSTEMS NOMINAL</span>
    `;

    // Emit event
    this.eventBus.emit('emergency:resolve', { scenario: this.activeScenario.id, score: this.score });

    // Stop timer
    if (this._timerInterval) clearInterval(this._timerInterval);
  }

  closeScore() {
    document.getElementById('score-panel').style.display = 'none';
    document.getElementById('scenario-grid').style.display = '';
    this.activeScenario = null;
  }

  _startTimer() {
    const el = document.getElementById('scenario-elapsed');
    if (this._timerInterval) clearInterval(this._timerInterval);
    this._timerInterval = setInterval(() => {
      if (!this.scenarioStartTime) return;
      const elapsed = Math.floor((Date.now() - this.scenarioStartTime) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      if (el) el.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, 1000);
  }

  _buildCascadeTree(scenario) {
    const tree = document.getElementById('cascade-tree');
    tree.innerHTML = '';

    // Primary failure node
    const primaryNode = DOM.create('div', {
      className: 'cascade-node failed primary',
      html: `
        <span class="cascade-node-icon">${scenario.icon}</span>
        <span class="cascade-node-name">${SUBSYSTEMS[scenario.cascadeEffects[0]]?.name || scenario.name}</span>
        <span class="cascade-node-status">FAILED</span>
      `,
      parent: tree
    });

    // Cascade links and affected nodes
    if (scenario.cascadeEffects.length > 1) {
      const linkContainer = DOM.create('div', { className: 'cascade-links', parent: tree });

      scenario.cascadeEffects.slice(1).forEach((sysKey, i) => {
        const sys = SUBSYSTEMS[sysKey];
        if (!sys) return;

        const link = DOM.create('div', { className: 'cascade-link-line', parent: linkContainer });

        const node = DOM.create('div', {
          className: 'cascade-node affected',
          html: `
            <span class="cascade-node-icon">${sys.icon}</span>
            <span class="cascade-node-name">${sys.name}</span>
            <span class="cascade-node-status">DEGRADED</span>
          `,
          parent: linkContainer
        });

        // Animate in with delay
        node.style.animationDelay = `${(i + 1) * 0.3}s`;
        node.classList.add('animate-slide-up');
      });
    }

    // Unaffected systems
    const unaffected = Object.entries(SUBSYSTEMS)
      .filter(([key]) => !scenario.cascadeEffects.includes(key));

    if (unaffected.length > 0) {
      const nominalRow = DOM.create('div', { className: 'cascade-nominal-row', parent: tree });
      DOM.create('div', { className: 'cascade-separator-label text-label', text: 'UNAFFECTED SYSTEMS', parent: nominalRow });
      const nominalGrid = DOM.create('div', { className: 'cascade-nominal-grid', parent: nominalRow });
      unaffected.forEach(([key, sys]) => {
        DOM.create('div', {
          className: 'cascade-node nominal compact',
          html: `
            <span class="cascade-node-icon">${sys.icon}</span>
            <span class="cascade-node-name">${sys.abbr}</span>
          `,
          parent: nominalGrid
        });
      });
    }
  }

  _buildDecisionTree(scenario) {
    const tree = document.getElementById('decision-tree');
    tree.innerHTML = '';

    scenario.decisions.forEach((decision, dIndex) => {
      const node = DOM.create('div', {
        className: `decision-node ${dIndex === 0 ? 'active' : 'locked'}`,
        id: `decision-${dIndex}`,
        parent: tree
      });

      DOM.create('div', {
        className: 'decision-question',
        html: `<span class="decision-number">${dIndex + 1}</span> ${decision.question}`,
        parent: node
      });

      const optionsContainer = DOM.create('div', { className: 'decision-options', parent: node });

      decision.options.forEach((option, oIndex) => {
        const btn = DOM.create('button', {
          className: 'decision-option',
          text: option,
          parent: optionsContainer
        });

        btn.addEventListener('click', () => {
          if (!node.classList.contains('active')) return;
          this._handleDecision(dIndex, oIndex, decision.correct);
        });
      });
    });
  }

  _handleDecision(decisionIndex, optionIndex, correctIndex) {
    const node = document.getElementById(`decision-${decisionIndex}`);
    const options = node.querySelectorAll('.decision-option');

    // Mark selection
    options.forEach((opt, i) => {
      if (i === optionIndex) {
        opt.classList.add(i === correctIndex ? 'correct' : 'incorrect');
        opt.classList.add('selected');
      }
      if (i === correctIndex && i !== optionIndex) {
        opt.classList.add('correct');
      }
      opt.disabled = true;
    });

    node.classList.remove('active');
    node.classList.add('completed');

    // Record decision
    this.decisionHistory.push({
      questionIndex: decisionIndex,
      selected: optionIndex,
      correct: correctIndex,
      isCorrect: optionIndex === correctIndex,
      timestamp: Date.now()
    });

    // Add to response timeline
    this._addResponseEvent(
      `Decision ${decisionIndex + 1}: ${this.activeScenario.decisions[decisionIndex].options[optionIndex]}`,
      optionIndex === correctIndex ? 'correct' : 'incorrect'
    );

    // Unlock next decision
    const nextNode = document.getElementById(`decision-${decisionIndex + 1}`);
    if (nextNode) {
      setTimeout(() => {
        nextNode.classList.remove('locked');
        nextNode.classList.add('active');
      }, 500);
    }
  }

  _buildResponseTimeline(scenario) {
    const timeline = document.getElementById('response-timeline');
    timeline.innerHTML = '';

    // Expected response events
    const expectedEvents = [
      { time: '0:00', label: 'Alert Triggered', type: 'expected' },
      { time: '0:30', label: 'Crew Acknowledged', type: 'expected' },
      { time: '1:00', label: 'Initial Assessment', type: 'expected' },
      { time: '2:00', label: 'Corrective Action', type: 'expected' },
      { time: `${scenario.duration}:00`, label: 'Resolution', type: 'expected' }
    ];

    expectedEvents.forEach(evt => {
      DOM.create('div', {
        className: `response-marker ${evt.type}`,
        html: `
          <span class="response-time text-mono">${evt.time}</span>
          <span class="response-dot"></span>
          <span class="response-label">${evt.label}</span>
        `,
        parent: timeline
      });
    });

    // Add initial actual event
    this._addResponseEvent('Emergency scenario activated', 'actual');
  }

  _addResponseEvent(label, type) {
    const timeline = document.getElementById('response-timeline');
    if (!timeline || !this.scenarioStartTime) return;

    const elapsed = Math.floor((Date.now() - this.scenarioStartTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

    const marker = DOM.create('div', {
      className: `response-marker actual ${type}`,
      html: `
        <span class="response-time text-mono">${timeStr}</span>
        <span class="response-dot"></span>
        <span class="response-label">${label}</span>
      `,
      parent: timeline
    });

    marker.classList.add('animate-slide-up');
    this.responseLog.push({ time: elapsed, label, type });
  }

  _calculateScore() {
    const elapsed = (Date.now() - this.scenarioStartTime) / 1000;
    const expectedDuration = this.activeScenario.duration * 60;

    // Speed score (faster = better, max at 50% of expected time)
    const speedRatio = elapsed / expectedDuration;
    this.score.speed = Math.round(MathUtils.clamp(100 - (speedRatio * 60), 20, 100));

    // Accuracy score (correct decisions)
    const correctCount = this.decisionHistory.filter(d => d.isCorrect).length;
    const totalDecisions = this.activeScenario.decisions.length;
    this.score.accuracy = totalDecisions > 0
      ? Math.round((correctCount / totalDecisions) * 100)
      : 50;

    // Completeness score (how many decisions were made)
    this.score.completeness = totalDecisions > 0
      ? Math.round((this.decisionHistory.length / totalDecisions) * 100)
      : 0;

    // Total weighted score
    this.score.total = Math.round(
      this.score.speed * 0.3 +
      this.score.accuracy * 0.45 +
      this.score.completeness * 0.25
    );

    // Update UI
    this._animateScore();
  }

  _animateScore() {
    // Animate score ring
    const ring = document.getElementById('score-ring');
    const totalEl = document.getElementById('score-total-value');
    if (ring) {
      const circumference = 2 * Math.PI * 52;
      ring.style.strokeDasharray = circumference;
      ring.style.strokeDashoffset = circumference;

      setTimeout(() => {
        const offset = circumference * (1 - this.score.total / 100);
        ring.style.transition = 'stroke-dashoffset 1.5s ease-out';
        ring.style.strokeDashoffset = offset;

        // Color based on score
        if (this.score.total >= 80) ring.style.stroke = '#10b981';
        else if (this.score.total >= 50) ring.style.stroke = '#f59e0b';
        else ring.style.stroke = '#ef4444';
      }, 100);
    }

    // Animate numbers
    this._animateNumber('score-total-value', this.score.total, 1500);
    this._animateNumber('score-speed-value', this.score.speed, 1000);
    this._animateNumber('score-accuracy-value', this.score.accuracy, 1200);
    this._animateNumber('score-completeness-value', this.score.completeness, 1400);

    // Animate bars
    setTimeout(() => {
      const speedBar = document.getElementById('score-speed-bar');
      const accBar = document.getElementById('score-accuracy-bar');
      const compBar = document.getElementById('score-completeness-bar');
      if (speedBar) speedBar.style.width = this.score.speed + '%';
      if (accBar) accBar.style.width = this.score.accuracy + '%';
      if (compBar) compBar.style.width = this.score.completeness + '%';
    }, 200);
  }

  _animateNumber(elementId, target, duration) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const start = 0;
    const startTime = performance.now();

    const step = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = Easing.easeOutCubic(progress);
      el.textContent = Math.round(start + (target - start) * eased);
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  _updateActiveScenario(data) {
    if (!this.activeScenario) return;
    // Could add real-time cascade effect updates here
  }

  destroy() {
    if (this._timerInterval) clearInterval(this._timerInterval);
  }
}

window.EmergencyPanel = EmergencyPanel;

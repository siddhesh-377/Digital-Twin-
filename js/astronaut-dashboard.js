/* ============================================================
   ASTRONAUT DASHBOARD
   Individual astronaut view with biometric vitals, suit telemetry,
   task schedule, procedure checklists, and direct comms panel.
   ============================================================ */

class AstronautDashboard {
  constructor(containerId, eventBus, telemetrySim) {
    this.container = document.getElementById(containerId);
    this.eventBus = eventBus;
    this.telemetry = telemetrySim;
    this.selectedCrew = CREW_DATA[0]; // Default to Commander
    this.initialized = false;
    this.gaugeAnimationFrame = null;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this._buildLayout();

    this.eventBus.on('telemetry:update', (data) => this._updateAll(data));
    this.eventBus.on('crew:select', (member) => this.selectCrew(member));
  }

  selectCrew(member) {
    this.selectedCrew = member;
    // Update selector highlight
    document.querySelectorAll('.astro-crew-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.crewId === member.id);
    });
    // Update header
    const nameEl = document.getElementById('astro-crew-name');
    const roleEl = document.getElementById('astro-crew-role');
    if (nameEl) nameEl.textContent = member.name;
    if (roleEl) roleEl.textContent = member.role;
    // Force immediate update
    const data = this.telemetry.getTelemetry();
    this._updateAll(data);
  }

  _buildLayout() {
    this.container.innerHTML = `
      <!-- Crew Selector Tabs -->
      <div class="astro-crew-selector">
        ${CREW_DATA.map((m, i) => `
          <button class="astro-crew-tab ${i === 0 ? 'active' : ''}" 
                  data-crew-id="${m.id}"
                  style="--crew-color: ${m.color}">
            <span class="crew-tab-initials" style="color: ${m.color}">${m.initials}</span>
            <span class="crew-tab-name">${m.callsign}</span>
          </button>
        `).join('')}
      </div>

      <!-- Astronaut Header -->
      <div class="astro-header">
        <div class="astro-avatar-large" style="border-color: ${this.selectedCrew.color}">
          <span style="color: ${this.selectedCrew.color}; font-size: 32px; font-family: var(--font-display);">${this.selectedCrew.initials}</span>
        </div>
        <div class="astro-header-info">
          <h2 class="text-display" id="astro-crew-name">${this.selectedCrew.name}</h2>
          <span class="text-label" id="astro-crew-role">${this.selectedCrew.role}</span>
          <div class="astro-status-badges">
            <span class="status-badge nominal" id="astro-activity-badge">NOMINAL</span>
            <span class="status-badge info" id="astro-location-badge">DESTINY LAB</span>
          </div>
        </div>
        <div class="astro-header-stats">
          <div class="astro-stat">
            <span class="text-label">MISSION DAY</span>
            <span class="text-mono text-value" id="astro-mission-day">45</span>
          </div>
          <div class="astro-stat">
            <span class="text-label">RAD DOSE</span>
            <span class="text-mono text-value" id="astro-rad-dose">0.52 mSv</span>
          </div>
          <div class="astro-stat">
            <span class="text-label">SLEEP QUALITY</span>
            <span class="text-mono text-value" id="astro-sleep">78%</span>
          </div>
        </div>
      </div>

      <!-- Main Content Grid -->
      <div class="astro-main-grid">
        <!-- Left Column: Vitals -->
        <div class="astro-vitals-section">
          <div class="section-title">
            <h3 class="text-display">Biometric Vitals</h3>
            <span class="status-dot nominal" id="astro-vitals-status"></span>
          </div>

          <!-- Gauge Row -->
          <div class="gauge-group">
            <div class="gauge-wrapper">
              <div class="gauge" id="gauge-hr">
                <svg viewBox="0 0 120 120">
                  <circle class="gauge-bg" cx="60" cy="60" r="52" />
                  <circle class="gauge-ring" cx="60" cy="60" r="52" id="gauge-hr-ring" 
                          style="stroke: #ef4444" />
                </svg>
                <div class="gauge-center">
                  <span class="gauge-value text-mono" id="gauge-hr-value">72</span>
                  <span class="gauge-unit">BPM</span>
                </div>
              </div>
              <span class="gauge-label text-label">Heart Rate</span>
            </div>
            <div class="gauge-wrapper">
              <div class="gauge" id="gauge-spo2">
                <svg viewBox="0 0 120 120">
                  <circle class="gauge-bg" cx="60" cy="60" r="52" />
                  <circle class="gauge-ring" cx="60" cy="60" r="52" id="gauge-spo2-ring"
                          style="stroke: #3b82f6" />
                </svg>
                <div class="gauge-center">
                  <span class="gauge-value text-mono" id="gauge-spo2-value">98</span>
                  <span class="gauge-unit">%SpO₂</span>
                </div>
              </div>
              <span class="gauge-label text-label">Blood Oxygen</span>
            </div>
            <div class="gauge-wrapper">
              <div class="gauge" id="gauge-temp">
                <svg viewBox="0 0 120 120">
                  <circle class="gauge-bg" cx="60" cy="60" r="52" />
                  <circle class="gauge-ring" cx="60" cy="60" r="52" id="gauge-temp-ring"
                          style="stroke: #f59e0b" />
                </svg>
                <div class="gauge-center">
                  <span class="gauge-value text-mono" id="gauge-temp-value">36.6</span>
                  <span class="gauge-unit">°C</span>
                </div>
              </div>
              <span class="gauge-label text-label">Body Temp</span>
            </div>
            <div class="gauge-wrapper">
              <div class="gauge" id="gauge-stress">
                <svg viewBox="0 0 120 120">
                  <circle class="gauge-bg" cx="60" cy="60" r="52" />
                  <circle class="gauge-ring" cx="60" cy="60" r="52" id="gauge-stress-ring"
                          style="stroke: #8b5cf6" />
                </svg>
                <div class="gauge-center">
                  <span class="gauge-value text-mono" id="gauge-stress-value">25</span>
                  <span class="gauge-unit">STRESS</span>
                </div>
              </div>
              <span class="gauge-label text-label">Stress Level</span>
            </div>
          </div>

          <!-- Detail Vitals Cards -->
          <div class="vitals-grid">
            <div class="vital-card glass-card">
              <div class="vital-icon" style="color: #ef4444">♥</div>
              <div class="vital-data">
                <span class="vital-label text-label">Heart Rate</span>
                <span class="vital-value text-mono" id="vital-hr">72 <small>BPM</small></span>
              </div>
              <div class="vital-trend" id="vital-hr-trend"></div>
            </div>
            <div class="vital-card glass-card">
              <div class="vital-icon" style="color: #3b82f6">🩸</div>
              <div class="vital-data">
                <span class="vital-label text-label">Blood Pressure</span>
                <span class="vital-value text-mono" id="vital-bp">120/78 <small>mmHg</small></span>
              </div>
              <div class="vital-trend" id="vital-bp-trend"></div>
            </div>
            <div class="vital-card glass-card">
              <div class="vital-icon" style="color: #10b981">🫁</div>
              <div class="vital-data">
                <span class="vital-label text-label">Respiration</span>
                <span class="vital-value text-mono" id="vital-resp">16 <small>br/min</small></span>
              </div>
              <div class="vital-trend" id="vital-resp-trend"></div>
            </div>
            <div class="vital-card glass-card">
              <div class="vital-icon" style="color: #f59e0b">🌡️</div>
              <div class="vital-data">
                <span class="vital-label text-label">Body Temperature</span>
                <span class="vital-value text-mono" id="vital-temp-card">36.6 <small>°C</small></span>
              </div>
              <div class="vital-trend" id="vital-temp-trend"></div>
            </div>
          </div>
        </div>

        <!-- Right Column: Suit + Tasks -->
        <div class="astro-ops-section">
          <!-- Suit Telemetry -->
          <div class="section-title">
            <h3 class="text-display">EMU Suit Telemetry</h3>
            <span class="status-badge info" id="suit-mode-badge">STANDBY</span>
          </div>
          <div class="glass-card suit-panel">
            <div class="suit-metrics-grid">
              <div class="suit-metric">
                <span class="suit-metric-label text-label">Suit Pressure</span>
                <div class="suit-metric-row">
                  <span class="suit-metric-value text-mono" id="suit-pressure">4.3 <small>psi</small></span>
                  <div class="metric-bar-container">
                    <div class="metric-bar" id="suit-pressure-bar" style="width: 86%; background: linear-gradient(90deg, #10b981, #3b82f6)"></div>
                  </div>
                </div>
              </div>
              <div class="suit-metric">
                <span class="suit-metric-label text-label">O₂ Remaining</span>
                <div class="suit-metric-row">
                  <span class="suit-metric-value text-mono" id="suit-o2">100 <small>%</small></span>
                  <div class="metric-bar-container">
                    <div class="metric-bar" id="suit-o2-bar" style="width: 100%; background: linear-gradient(90deg, #10b981, #00f0ff)"></div>
                  </div>
                </div>
              </div>
              <div class="suit-metric">
                <span class="suit-metric-label text-label">Battery Level</span>
                <div class="suit-metric-row">
                  <span class="suit-metric-value text-mono" id="suit-battery">100 <small>%</small></span>
                  <div class="metric-bar-container">
                    <div class="metric-bar" id="suit-battery-bar" style="width: 100%; background: linear-gradient(90deg, #f59e0b, #10b981)"></div>
                  </div>
                </div>
              </div>
              <div class="suit-metric">
                <span class="suit-metric-label text-label">CO₂ Scrubber</span>
                <div class="suit-metric-row">
                  <span class="suit-metric-value text-mono" id="suit-co2">100 <small>%</small></span>
                  <div class="metric-bar-container">
                    <div class="metric-bar" id="suit-co2-bar" style="width: 100%; background: linear-gradient(90deg, #8b5cf6, #3b82f6)"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Task Schedule -->
          <div class="section-title" style="margin-top: 20px;">
            <h3 class="text-display">Task Schedule</h3>
            <span class="text-label">TODAY</span>
          </div>
          <div class="glass-card task-list-container">
            <div class="task-list" id="astro-task-list">
              ${this._buildTaskList()}
            </div>
          </div>

          <!-- Procedure Checklist -->
          <div class="section-title" style="margin-top: 20px;">
            <h3 class="text-display">Active Procedure</h3>
            <span class="status-badge info">EVA-47 PREP</span>
          </div>
          <div class="glass-card procedure-container">
            <div class="procedure-list" id="astro-procedure-list">
              ${this._buildProcedureList()}
            </div>
          </div>
        </div>
      </div>
    `;

    // Attach crew tab click handlers
    document.querySelectorAll('.astro-crew-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const member = CREW_DATA.find(m => m.id === tab.dataset.crewId);
        if (member) this.selectCrew(member);
      });
    });
  }

  _buildTaskList() {
    const tasks = [
      { time: '06:00', name: 'Morning health check', priority: 'normal', status: 'completed' },
      { time: '07:00', name: 'Daily planning conference', priority: 'normal', status: 'completed' },
      { time: '08:30', name: 'JAXA Crystal Growth Experiment', priority: 'high', status: 'completed' },
      { time: '10:00', name: 'Exercise protocol — ARED', priority: 'normal', status: 'completed' },
      { time: '11:30', name: 'EVA suit checkout', priority: 'high', status: 'completed' },
      { time: '13:00', name: 'EVA-47: S6 Truss Repair', priority: 'critical', status: 'active' },
      { time: '16:00', name: 'Post-EVA medical debrief', priority: 'normal', status: 'upcoming' },
      { time: '17:30', name: 'ESA Fluid Physics Run #4', priority: 'normal', status: 'upcoming' },
      { time: '19:00', name: 'Evening DPC', priority: 'normal', status: 'upcoming' },
      { time: '21:30', name: 'Crew sleep period', priority: 'normal', status: 'upcoming' }
    ];

    return tasks.map(task => `
      <div class="task-item ${task.status}">
        <span class="task-checkbox ${task.status === 'completed' ? 'checked' : ''}">
          ${task.status === 'completed' ? '✓' : task.status === 'active' ? '▶' : '○'}
        </span>
        <span class="task-time text-mono">${task.time}</span>
        <span class="task-name">${task.name}</span>
        <span class="task-priority ${task.priority}">${task.priority === 'critical' ? '!!!' : task.priority === 'high' ? '!!' : ''}</span>
      </div>
    `).join('');
  }

  _buildProcedureList() {
    const steps = [
      { num: 1, text: 'Verify EMU suit pressure integrity', status: 'completed' },
      { num: 2, text: 'Connect O₂ supply and verify flow rate', status: 'completed' },
      { num: 3, text: 'Comm check with EVA CAPCOM', status: 'completed' },
      { num: 4, text: 'Depressurize airlock to vacuum', status: 'current' },
      { num: 5, text: 'Open outer hatch', status: 'pending' },
      { num: 6, text: 'Tether attachment to station handrail', status: 'pending' },
      { num: 7, text: 'Translate to S6 truss worksite', status: 'pending' },
      { num: 8, text: 'Remove and replace MBSU unit', status: 'pending' }
    ];

    return steps.map(step => `
      <div class="procedure-step ${step.status}">
        <span class="step-number">${step.num}</span>
        <span class="step-text">${step.text}</span>
        <span class="step-status">${step.status === 'completed' ? '✓' : step.status === 'current' ? '▶' : '○'}</span>
      </div>
    `).join('');
  }

  _updateAll(data) {
    if (!this.selectedCrew || !data.crew) return;
    const vitals = data.crew[this.selectedCrew.id];
    if (!vitals) return;

    this._updateGauges(vitals);
    this._updateVitalCards(vitals);
    this._updateSuitTelemetry(vitals);
    this._updateStats(data, vitals);
  }

  _updateGauges(vitals) {
    // Heart Rate gauge (max 200 BPM)
    this._setGaugeValue('gauge-hr-ring', 'gauge-hr-value', vitals.heartRate, 200, 0);
    // SpO2 gauge (90-100%)
    this._setGaugeValue('gauge-spo2-ring', 'gauge-spo2-value', vitals.spO2, 100, 0);
    // Temperature gauge (35-40°C range)
    this._setGaugeValue('gauge-temp-ring', 'gauge-temp-value', vitals.bodyTemp, 40, 35, 1);
    // Stress gauge (0-100)
    this._setGaugeValue('gauge-stress-ring', 'gauge-stress-value', vitals.stressLevel, 100, 0, 0);
  }

  _setGaugeValue(ringId, valueId, value, max, min = 0, decimals = 0) {
    const ring = document.getElementById(ringId);
    const valueEl = document.getElementById(valueId);
    if (!ring || !valueEl) return;

    const circumference = 2 * Math.PI * 52; // r=52 from SVG
    const percent = MathUtils.clamp((value - min) / (max - min), 0, 1);
    const offset = circumference * (1 - percent);

    ring.style.strokeDasharray = circumference;
    ring.style.strokeDashoffset = offset;
    valueEl.textContent = value.toFixed(decimals);
  }

  _updateVitalCards(vitals) {
    const hrEl = document.getElementById('vital-hr');
    const bpEl = document.getElementById('vital-bp');
    const respEl = document.getElementById('vital-resp');
    const tempEl = document.getElementById('vital-temp-card');

    if (hrEl) hrEl.innerHTML = `${Math.round(vitals.heartRate)} <small>BPM</small>`;
    if (bpEl) bpEl.innerHTML = `${Math.round(vitals.bloodPressureSys)}/${Math.round(vitals.bloodPressureDia)} <small>mmHg</small>`;
    if (respEl) respEl.innerHTML = `${Math.round(vitals.respirationRate)} <small>br/min</small>`;
    if (tempEl) tempEl.innerHTML = `${vitals.bodyTemp.toFixed(1)} <small>°C</small>`;
  }

  _updateSuitTelemetry(vitals) {
    this._updateSuitMetric('suit-pressure', 'suit-pressure-bar', vitals.suitPressure, 'psi', 5.0);
    this._updateSuitMetric('suit-o2', 'suit-o2-bar', vitals.suitO2, '%', 100);
    this._updateSuitMetric('suit-battery', 'suit-battery-bar', vitals.suitBattery, '%', 100);
    this._updateSuitMetric('suit-co2', 'suit-co2-bar', vitals.suitCO2Scrubber, '%', 100);

    const modeBadge = document.getElementById('suit-mode-badge');
    if (modeBadge) {
      const isEVA = vitals.activityLevel === 'eva';
      modeBadge.textContent = isEVA ? 'EVA ACTIVE' : 'STANDBY';
      modeBadge.className = `status-badge ${isEVA ? 'warning' : 'info'}`;
    }
  }

  _updateSuitMetric(valueId, barId, value, unit, max) {
    const valueEl = document.getElementById(valueId);
    const barEl = document.getElementById(barId);
    if (valueEl) valueEl.innerHTML = `${value.toFixed(1)} <small>${unit}</small>`;
    if (barEl) {
      const pct = MathUtils.clamp((value / max) * 100, 0, 100);
      barEl.style.width = pct + '%';
      // Change color based on level
      if (pct < 20) barEl.style.background = 'linear-gradient(90deg, #ef4444, #f59e0b)';
      else if (pct < 50) barEl.style.background = 'linear-gradient(90deg, #f59e0b, #10b981)';
    }
  }

  _updateStats(data, vitals) {
    const dayEl = document.getElementById('astro-mission-day');
    const radEl = document.getElementById('astro-rad-dose');
    const sleepEl = document.getElementById('astro-sleep');
    const actBadge = document.getElementById('astro-activity-badge');

    if (dayEl) dayEl.textContent = Math.floor(data.met / 86400);
    if (radEl) radEl.textContent = vitals.radiationDose.toFixed(2) + ' mSv';
    if (sleepEl) sleepEl.textContent = Math.round(vitals.sleepQuality) + '%';
    if (actBadge) {
      actBadge.textContent = vitals.activityLevel.toUpperCase();
      actBadge.className = `status-badge ${vitals.activityLevel === 'eva' ? 'warning' : 'nominal'}`;
    }
  }

  destroy() {
    if (this.gaugeAnimationFrame) cancelAnimationFrame(this.gaugeAnimationFrame);
  }
}

window.AstronautDashboard = AstronautDashboard;

/* ============================================================
   MISSION CONTROL DASHBOARD
   Primary flight controller view with subsystem overview,
   live telemetry charts, crew status, and communication log.
   ============================================================ */

class MissionControlDashboard {
  constructor(containerId, eventBus, telemetrySim) {
    this.container = document.getElementById(containerId);
    this.eventBus = eventBus;
    this.telemetry = telemetrySim;
    this.charts = {};
    this.commLogIndex = 0;
    this.commInterval = null;
    this.initialized = false;
  }

  init() {
    if (this.initialized) return;
    this.initialized = true;
    this._buildLayout();
    this._initCharts();
    this._startCommLog();

    // Listen for telemetry updates
    this.eventBus.on('telemetry:update', (data) => this._updateAll(data));
  }

  _buildLayout() {
    this.container.innerHTML = `
      <!-- Mission Control Header -->
      <div class="mc-header">
        <div class="mc-header-left">
          <h2 class="text-display">Mission Control</h2>
          <span class="mc-subtitle text-label">Flight Director Console — ISS Operations</span>
        </div>
        <div class="mc-header-right">
          <div class="mc-orbit-info">
            <span class="text-label">ORBIT</span>
            <span class="text-mono mc-orbit-number" id="mc-orbit-num">712</span>
          </div>
          <div class="mc-orbit-info">
            <span class="text-label">PHASE</span>
            <span class="text-mono mc-orbit-phase" id="mc-orbit-phase">
              <span class="status-dot nominal"></span> DAYLIGHT
            </span>
          </div>
          <div class="mc-orbit-info">
            <span class="text-label">ALTITUDE</span>
            <span class="text-mono" id="mc-altitude">408.2 km</span>
          </div>
        </div>
      </div>

      <!-- Subsystem Status Grid -->
      <div class="section-title">
        <h3 class="text-display">Subsystem Status</h3>
        <span class="text-label" id="mc-alert-summary">0 ALERTS</span>
      </div>
      <div class="subsystem-grid" id="mc-subsystem-grid"></div>

      <!-- Main Content: Charts + Sidebar -->
      <div class="mc-main-grid">
        <!-- Left: Telemetry Charts -->
        <div class="mc-charts-area">
          <div class="section-title">
            <h3 class="text-display">Live Telemetry</h3>
          </div>
          <div class="chart-grid">
            <div class="glass-card chart-container">
              <div class="glass-card-header">
                <span class="text-label">Atmosphere — Cabin Pressure & O₂</span>
                <span class="status-dot nominal"></span>
              </div>
              <div class="glass-card-body chart-canvas-wrapper">
                <canvas id="chart-atmosphere"></canvas>
              </div>
            </div>
            <div class="glass-card chart-container">
              <div class="glass-card-header">
                <span class="text-label">Electrical Power System</span>
                <span class="status-dot nominal"></span>
              </div>
              <div class="glass-card-body chart-canvas-wrapper">
                <canvas id="chart-power"></canvas>
              </div>
            </div>
            <div class="glass-card chart-container">
              <div class="glass-card-header">
                <span class="text-label">Environmental — Temperature & CO₂</span>
                <span class="status-dot nominal"></span>
              </div>
              <div class="glass-card-body chart-canvas-wrapper">
                <canvas id="chart-environment"></canvas>
              </div>
            </div>
            <div class="glass-card chart-container">
              <div class="glass-card-header">
                <span class="text-label">Communications Signal</span>
                <span class="status-dot nominal" id="chart-comm-status"></span>
              </div>
              <div class="glass-card-body chart-canvas-wrapper">
                <canvas id="chart-comms"></canvas>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Crew & Comms -->
        <div class="mc-sidebar-area">
          <!-- Crew Status -->
          <div class="section-title">
            <h3 class="text-display">Crew Status</h3>
            <span class="text-label">6 MEMBERS</span>
          </div>
          <div class="crew-grid" id="mc-crew-grid"></div>

          <!-- Communication Log -->
          <div class="section-title" style="margin-top: 20px;">
            <h3 class="text-display">CAPCOM Log</h3>
            <span class="text-label" id="mc-comm-status-label">LIVE</span>
          </div>
          <div class="glass-card comm-log-container">
            <div class="comm-log" id="mc-comm-log"></div>
          </div>

          <!-- Mission Timeline -->
          <div class="section-title" style="margin-top: 20px;">
            <h3 class="text-display">Mission Timeline</h3>
          </div>
          <div class="glass-card timeline-container">
            <div class="timeline" id="mc-timeline"></div>
          </div>
        </div>
      </div>
    `;

    // Build subsystem cards
    this._buildSubsystemGrid();
    // Build crew cards
    this._buildCrewGrid();
    // Build timeline
    this._buildTimeline();
  }

  _buildSubsystemGrid() {
    const grid = document.getElementById('mc-subsystem-grid');
    Object.entries(SUBSYSTEMS).forEach(([key, sys]) => {
      const card = DOM.create('div', {
        className: 'subsystem-card nominal',
        id: `subsystem-${key}`,
        html: `
          <div class="subsystem-card-top-border"></div>
          <div class="subsystem-card-content">
            <div class="subsystem-icon">${sys.icon}</div>
            <div class="subsystem-info">
              <div class="subsystem-name text-label">${sys.abbr}</div>
              <div class="subsystem-full-name">${sys.name}</div>
            </div>
            <div class="subsystem-metrics">
              <div class="subsystem-health">
                <span class="text-mono subsystem-health-value" id="health-${key}">98%</span>
              </div>
              <div class="subsystem-status-row">
                <span class="status-dot nominal" id="status-dot-${key}"></span>
                <span class="subsystem-status-text text-label" id="status-text-${key}">NOMINAL</span>
              </div>
            </div>
          </div>
        `,
        parent: grid
      });
    });
  }

  _buildCrewGrid() {
    const grid = document.getElementById('mc-crew-grid');
    CREW_DATA.forEach(member => {
      const card = DOM.create('div', {
        className: 'crew-card',
        id: `crew-${member.id}`,
        html: `
          <div class="crew-avatar" style="background-color: ${member.color}20; border-color: ${member.color}">
            <span class="crew-initials" style="color: ${member.color}">${member.initials}</span>
          </div>
          <div class="crew-info">
            <div class="crew-name">${member.name}</div>
            <div class="crew-role text-label">${member.role}</div>
          </div>
          <div class="crew-vitals-mini">
            <span class="vital-mini" id="crew-hr-${member.id}">
              <span class="vital-mini-icon">♥</span>
              <span class="vital-mini-value text-mono">72</span>
            </span>
            <span class="vital-mini" id="crew-spo2-${member.id}">
              <span class="vital-mini-icon">O₂</span>
              <span class="vital-mini-value text-mono">98%</span>
            </span>
          </div>
        `,
        parent: grid
      });

      card.addEventListener('click', () => {
        this.eventBus.emit('crew:select', member);
      });
    });
  }

  _buildTimeline() {
    const timeline = document.getElementById('mc-timeline');
    const events = [
      { time: -2, label: 'Crew Wake-up', status: 'completed' },
      { time: -1.5, label: 'Morning DPC', status: 'completed' },
      { time: -1, label: 'Science Block A', status: 'completed' },
      { time: -0.5, label: 'EVA Prep', status: 'completed' },
      { time: 0, label: 'EVA-47', status: 'current' },
      { time: 1, label: 'Post-EVA Review', status: 'upcoming' },
      { time: 2, label: 'Science Block B', status: 'upcoming' },
      { time: 3, label: 'Reboost Window', status: 'upcoming' },
      { time: 4, label: 'Crew Sleep', status: 'upcoming' }
    ];

    events.forEach((evt, i) => {
      const marker = DOM.create('div', {
        className: `timeline-event ${evt.status}`,
        html: `
          <div class="timeline-marker"></div>
          <div class="timeline-label ${i % 2 === 0 ? 'above' : 'below'}">
            <span class="timeline-event-name">${evt.label}</span>
            <span class="timeline-event-time text-mono">${evt.time >= 0 ? '+' : ''}${evt.time}h</span>
          </div>
        `,
        parent: timeline
      });
    });
  }

  _initCharts() {
    const chartDefaults = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#94a3b8',
            font: { family: "'Inter', sans-serif", size: 10 },
            boxWidth: 12,
            padding: 8
          }
        },
        tooltip: {
          backgroundColor: 'rgba(17, 24, 39, 0.9)',
          titleColor: '#f1f5f9',
          bodyColor: '#94a3b8',
          borderColor: 'rgba(0, 240, 255, 0.3)',
          borderWidth: 1,
          cornerRadius: 6,
          titleFont: { family: "'JetBrains Mono', monospace", size: 11 },
          bodyFont: { family: "'JetBrains Mono', monospace", size: 10 }
        }
      },
      scales: {
        x: {
          display: false,
          grid: { display: false }
        },
        y: {
          grid: {
            color: 'rgba(30, 41, 59, 0.5)',
            lineWidth: 0.5
          },
          ticks: {
            color: '#64748b',
            font: { family: "'JetBrains Mono', monospace", size: 9 },
            maxTicksLimit: 5
          }
        }
      }
    };

    // Atmosphere Chart
    this.charts.atmosphere = new Chart(document.getElementById('chart-atmosphere'), {
      type: 'line',
      data: {
        labels: Array(60).fill(''),
        datasets: [
          {
            label: 'Cabin Pressure (psi)',
            data: [],
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderWidth: 1.5,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            yAxisID: 'y'
          },
          {
            label: 'O₂ Partial (psi)',
            data: [],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            borderWidth: 1.5,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        ...chartDefaults,
        scales: {
          ...chartDefaults.scales,
          y: {
            ...chartDefaults.scales.y,
            min: 14.0,
            max: 15.2,
            position: 'left'
          },
          y1: {
            ...chartDefaults.scales.y,
            min: 2.7,
            max: 3.5,
            position: 'right',
            grid: { display: false }
          }
        }
      }
    });

    // Power Chart
    this.charts.power = new Chart(document.getElementById('chart-power'), {
      type: 'line',
      data: {
        labels: Array(60).fill(''),
        datasets: [
          {
            label: 'Solar Output (kW)',
            data: [],
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            borderWidth: 1.5,
            fill: true,
            tension: 0.4,
            pointRadius: 0
          },
          {
            label: 'Battery (%)',
            data: [],
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
            borderWidth: 1.5,
            fill: false,
            tension: 0.4,
            pointRadius: 0,
            yAxisID: 'y1'
          },
          {
            label: 'Total Load (kW)',
            data: [],
            borderColor: '#ef4444',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            borderWidth: 1,
            fill: false,
            tension: 0.4,
            pointRadius: 0,
            borderDash: [4, 4]
          }
        ]
      },
      options: {
        ...chartDefaults,
        scales: {
          ...chartDefaults.scales,
          y: {
            ...chartDefaults.scales.y,
            min: 0,
            max: 100
          },
          y1: {
            ...chartDefaults.scales.y,
            min: 0,
            max: 100,
            position: 'right',
            grid: { display: false }
          }
        }
      }
    });

    // Environment Chart
    this.charts.environment = new Chart(document.getElementById('chart-environment'), {
      type: 'line',
      data: {
        labels: Array(60).fill(''),
        datasets: [
          {
            label: 'Temperature (°C)',
            data: [],
            borderColor: '#f97316',
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            borderWidth: 1.5,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            yAxisID: 'y'
          },
          {
            label: 'CO₂ (mmHg)',
            data: [],
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            borderWidth: 1.5,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        ...chartDefaults,
        scales: {
          ...chartDefaults.scales,
          y: {
            ...chartDefaults.scales.y,
            min: 18,
            max: 28,
            position: 'left'
          },
          y1: {
            ...chartDefaults.scales.y,
            min: 0,
            max: 10,
            position: 'right',
            grid: { display: false }
          }
        }
      }
    });

    // Comms Chart
    this.charts.comms = new Chart(document.getElementById('chart-comms'), {
      type: 'line',
      data: {
        labels: Array(60).fill(''),
        datasets: [
          {
            label: 'Signal Strength (dBm)',
            data: [],
            borderColor: '#00f0ff',
            backgroundColor: 'rgba(0, 240, 255, 0.1)',
            borderWidth: 1.5,
            fill: true,
            tension: 0.4,
            pointRadius: 0
          }
        ]
      },
      options: {
        ...chartDefaults,
        scales: {
          ...chartDefaults.scales,
          y: {
            ...chartDefaults.scales.y,
            min: -120,
            max: -40
          }
        }
      }
    });
  }

  _startCommLog() {
    const log = document.getElementById('mc-comm-log');

    // Add initial entries
    for (let i = 0; i < 5; i++) {
      this._addCommEntry(log, i);
    }
    this.commLogIndex = 5;

    // Add new entries periodically
    this.commInterval = setInterval(() => {
      if (this.commLogIndex < COMM_MESSAGES.length) {
        this._addCommEntry(log, this.commLogIndex);
        this.commLogIndex++;
      } else {
        this.commLogIndex = 0; // Loop
      }
    }, 8000 + Math.random() * 7000);
  }

  _addCommEntry(log, index) {
    const msg = COMM_MESSAGES[index % COMM_MESSAGES.length];
    const now = new Date();
    const timeStr = Formatters.time(now);
    const senderColors = {
      'CAPCOM': '#3b82f6', 'CDR': '#00f0ff', 'PLT': '#8b5cf6',
      'MS1': '#10b981', 'MS2': '#f59e0b', 'MS3': '#ef4444',
      'MS4': '#f97316', 'FLIGHT': '#e11d48'
    };
    const color = senderColors[msg.sender] || '#94a3b8';

    const entry = DOM.create('div', {
      className: 'comm-entry animate-slide-up',
      html: `
        <span class="comm-time text-mono">${timeStr}</span>
        <span class="comm-sender" style="color: ${color}; border-color: ${color}40">${msg.sender}</span>
        <span class="comm-message">${msg.message}</span>
      `,
      parent: log
    });

    // Auto-scroll
    log.scrollTop = log.scrollHeight;

    // Keep only last 20 entries
    while (log.children.length > 20) {
      log.removeChild(log.firstChild);
    }
  }

  _updateAll(data) {
    this._updateSubsystems(data);
    this._updateCharts(data);
    this._updateCrewVitals(data);
    this._updateHeader(data);
  }

  _updateHeader(data) {
    const orbitNum = document.getElementById('mc-orbit-num');
    const orbitPhase = document.getElementById('mc-orbit-phase');
    const altitude = document.getElementById('mc-altitude');

    if (orbitNum) orbitNum.textContent = data.orbitNumber;
    if (orbitPhase) {
      const isDaylight = data.orbitPhase === 'daylight';
      orbitPhase.innerHTML = `
        <span class="status-dot ${isDaylight ? 'nominal' : 'warning'}"></span>
        ${isDaylight ? 'DAYLIGHT' : 'ECLIPSE'}
      `;
    }
    if (altitude) altitude.textContent = Formatters.altitude(data.orbital.altitude);
  }

  _updateSubsystems(data) {
    let totalAlerts = 0;
    Object.entries(data.subsystems).forEach(([key, sub]) => {
      const card = document.getElementById(`subsystem-${key}`);
      const healthEl = document.getElementById(`health-${key}`);
      const statusDot = document.getElementById(`status-dot-${key}`);
      const statusText = document.getElementById(`status-text-${key}`);

      if (!card) return;

      // Update classes
      card.className = `subsystem-card ${sub.status}`;
      if (healthEl) healthEl.textContent = Formatters.percent(sub.health, 0);
      if (statusDot) statusDot.className = `status-dot ${sub.status}`;
      if (statusText) statusText.textContent = sub.status.toUpperCase();

      totalAlerts += sub.alerts;
    });

    const alertSummary = document.getElementById('mc-alert-summary');
    if (alertSummary) {
      alertSummary.textContent = `${totalAlerts} ALERT${totalAlerts !== 1 ? 'S' : ''}`;
      alertSummary.style.color = totalAlerts > 0 ? (totalAlerts > 3 ? '#ef4444' : '#f59e0b') : '#10b981';
    }
  }

  _updateCharts(data) {
    const history = this.telemetry.getHistory();

    // Update Atmosphere chart
    if (this.charts.atmosphere) {
      this.charts.atmosphere.data.labels = history.timestamps.map(() => '');
      this.charts.atmosphere.data.datasets[0].data = [...history.cabinPressure];
      this.charts.atmosphere.data.datasets[1].data = [...history.o2Level];
      this.charts.atmosphere.update('none');
    }

    // Update Power chart
    if (this.charts.power) {
      this.charts.power.data.labels = history.timestamps.map(() => '');
      this.charts.power.data.datasets[0].data = [...history.solarOutput];
      this.charts.power.data.datasets[1].data = [...history.batteryCharge];
      this.charts.power.data.datasets[2].data = [...history.powerLoad];
      this.charts.power.update('none');
    }

    // Update Environment chart
    if (this.charts.environment) {
      this.charts.environment.data.labels = history.timestamps.map(() => '');
      this.charts.environment.data.datasets[0].data = [...history.temperature];
      this.charts.environment.data.datasets[1].data = [...history.co2Level];
      this.charts.environment.update('none');
    }

    // Update Comms chart
    if (this.charts.comms) {
      this.charts.comms.data.labels = history.timestamps.map(() => '');
      this.charts.comms.data.datasets[0].data = [...history.signalStrength];
      this.charts.comms.update('none');

      const commStatus = document.getElementById('chart-comm-status');
      if (commStatus) {
        commStatus.className = `status-dot ${data.comms.tdrsLink ? 'nominal' : 'critical'}`;
      }
    }
  }

  _updateCrewVitals(data) {
    CREW_DATA.forEach(member => {
      const vitals = data.crew[member.id];
      if (!vitals) return;

      const hrEl = document.querySelector(`#crew-hr-${member.id} .vital-mini-value`);
      const spo2El = document.querySelector(`#crew-spo2-${member.id} .vital-mini-value`);

      if (hrEl) hrEl.textContent = Math.round(vitals.heartRate);
      if (spo2El) spo2El.textContent = Formatters.percent(vitals.spO2, 0);
    });
  }

  destroy() {
    if (this.commInterval) clearInterval(this.commInterval);
    Object.values(this.charts).forEach(chart => chart.destroy());
    this.charts = {};
  }
}

window.MissionControlDashboard = MissionControlDashboard;

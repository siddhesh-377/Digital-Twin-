/* ============================================================
   APP.JS — Main Application Controller
   Initializes all modules, manages navigation, simulation clock,
   global state, and star field background animation.
   ============================================================ */

class App {
  constructor() {
    this.eventBus = new EventBus();
    this.telemetry = null;
    this.modules = {};
    this.currentView = 'mission-control';
    this.clockInterval = null;
    this.starCanvas = null;
    this.starCtx = null;
    this.stars = [];
  }

  async init() {
    console.log('%c🚀 Spacecraft Digital Twin Platform v1.0', 'color: #00f0ff; font-size: 16px; font-weight: bold;');
    console.log('%cInitializing systems...', 'color: #94a3b8;');

    // Initialize telemetry simulator
    this.telemetry = new TelemetrySimulator(this.eventBus);

    // Initialize toast manager
    window.toastManager = new ToastManager();

    // Initialize star field
    this._initStarField();

    // Initialize modules
    this.modules.missionControl = new MissionControlDashboard('view-mission-control', this.eventBus, this.telemetry);
    this.modules.astronaut = new AstronautDashboard('view-astronaut', this.eventBus, this.telemetry);
    this.modules.emergency = new EmergencyPanel('view-emergency', this.eventBus, this.telemetry);
    this.modules.training = new TrainingModule('view-training', this.eventBus, this.telemetry);

    // Store emergency panel reference for global access
    window.emergencyPanel = this.modules.emergency;

    // Initialize 3D viewer (conditionally — needs Three.js)
    if (window.THREE) {
      this.modules.spacecraft = new SpacecraftViewer('viewer-canvas-container', this.eventBus);
    }

    // Feed telemetry data to 3D viewer
    this.eventBus.on('telemetry:update', (data) => {
      if (this.modules.spacecraft && this.modules.spacecraft.initialized) {
        this.modules.spacecraft.update({
          altitude: data.orbital?.altitude,
          velocity: data.orbital?.velocity,
          solarPanelAngle: data.power?.solarPanelAngle,
          stationAttitude: {
            pitch: data.gnc?.pitch || 0,
            yaw: data.gnc?.yaw || 0,
            roll: data.gnc?.roll || 0
          },
          thrusterFiring: data.propulsion?.thrusterFiring,
          subsystems: data.subsystems || {}
        });
      }
    });

    // Initialize the default view
    this.modules.missionControl.init();

    // Setup navigation
    this._setupNavigation();

    // Setup status bar clock
    this._startClock();

    // Setup simulation controls
    this._setupSimControls();

    // Start telemetry
    this.telemetry.start();

    // Setup window resize handler
    window.addEventListener('resize', () => {
      if (this.modules.spacecraft && this.currentView === 'spacecraft') {
        this.modules.spacecraft.resize();
      }
      this._resizeStarField();
    });

    // Listen for module selection from 3D viewer
    this.eventBus.on('module:select', (data) => {
      window.toastManager.show(`Module: ${data.name} — Status: ${data.status || 'nominal'}`, 'info', 4000);
    });

    // Listen for crew selection to navigate
    this.eventBus.on('crew:select', (member) => {
      if (this.currentView !== 'astronaut') {
        this.navigateTo('astronaut');
      }
    });

    // Welcome toast
    setTimeout(() => {
      window.toastManager.show('Digital Twin Platform online. All systems nominal.', 'success', 4000);
    }, 1500);

    console.log('%c✓ All systems initialized', 'color: #10b981;');
  }

  navigateTo(viewName) {
    if (viewName === this.currentView) return;
    this.currentView = viewName;

    // Update nav items
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });

    // Hide all views, show target
    document.querySelectorAll('.view-panel').forEach(panel => {
      panel.classList.remove('active');
    });
    const targetPanel = document.getElementById(`panel-${viewName}`);
    if (targetPanel) {
      targetPanel.classList.add('active');
    }

    // Lazy-initialize modules
    switch (viewName) {
      case 'mission-control':
        this.modules.missionControl.init();
        break;
      case 'astronaut':
        this.modules.astronaut.init();
        break;
      case 'emergency':
        this.modules.emergency.init();
        break;
      case 'spacecraft':
        if (this.modules.spacecraft) {
          // Delay init so the panel is visible and has real dimensions
          setTimeout(() => {
            this.modules.spacecraft.init();
            // Double resize: one immediate, one after render
            setTimeout(() => this.modules.spacecraft.resize(), 50);
            setTimeout(() => this.modules.spacecraft.resize(), 300);
          }, 50);
        }
        break;
      case 'training':
        this.modules.training.init();
        break;
    }

    // Update view title in status bar
    const viewNames = {
      'mission-control': 'Mission Control',
      'astronaut': 'Astronaut Dashboard',
      'emergency': 'Emergency Scenarios',
      'spacecraft': '3D Spacecraft Viewer',
      'training': 'Training Module'
    };
    const viewTitle = document.getElementById('current-view-title');
    if (viewTitle) viewTitle.textContent = viewNames[viewName] || viewName;

    this.eventBus.emit('view:change', viewName);
  }

  _setupNavigation() {
    document.querySelectorAll('.sidebar-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        if (view) this.navigateTo(view);
      });
    });

    // Set initial active
    const defaultItem = document.querySelector('.sidebar-nav-item[data-view="mission-control"]');
    if (defaultItem) defaultItem.classList.add('active');
  }

  _startClock() {
    const metEl = document.getElementById('clock-met');
    const utcEl = document.getElementById('clock-utc');
    const simSpeedEl = document.getElementById('sim-speed-display');

    const updateClock = () => {
      const data = this.telemetry.getTelemetry();
      if (metEl) metEl.textContent = Formatters.met(data.met);
      if (utcEl) utcEl.textContent = Formatters.utc();
      if (simSpeedEl) simSpeedEl.textContent = this.telemetry.speed + 'x';
    };

    this.clockInterval = setInterval(updateClock, 250);
    updateClock();
  }

  _setupSimControls() {
    const speedSlider = document.getElementById('sim-speed-slider');
    const pauseBtn = document.getElementById('btn-pause-sim');
    const resetBtn = document.getElementById('btn-reset-sim');

    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        const speeds = [0.1, 0.25, 0.5, 1, 2, 5, 10];
        const speed = speeds[parseInt(e.target.value)] || 1;
        this.telemetry.setSpeed(speed);
        const display = document.getElementById('sim-speed-display');
        if (display) display.textContent = speed + 'x';
      });
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        if (this.telemetry.running) {
          this.telemetry.stop();
          pauseBtn.innerHTML = '<span class="btn-icon">▶</span>';
          pauseBtn.title = 'Resume Simulation';
        } else {
          this.telemetry.start();
          pauseBtn.innerHTML = '<span class="btn-icon">⏸</span>';
          pauseBtn.title = 'Pause Simulation';
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.telemetry.reset();
        this.telemetry.start();
        window.toastManager.show('Simulation reset to initial state.', 'info', 3000);
      });
    }
  }

  // ── Star Field Background ─────────────────────────────────
  _initStarField() {
    this.starCanvas = document.getElementById('star-canvas');
    if (!this.starCanvas) return;

    this.starCtx = this.starCanvas.getContext('2d');
    this._resizeStarField();

    // Generate stars
    this.stars = [];
    for (let i = 0; i < 400; i++) {
      this.stars.push({
        x: Math.random() * this.starCanvas.width,
        y: Math.random() * this.starCanvas.height,
        size: Math.random() * 1.8 + 0.2,
        opacity: Math.random() * 0.8 + 0.2,
        twinkleSpeed: Math.random() * 0.02 + 0.005,
        twinklePhase: Math.random() * Math.PI * 2
      });
    }

    this._animateStars();
  }

  _resizeStarField() {
    if (!this.starCanvas) return;
    this.starCanvas.width = window.innerWidth;
    this.starCanvas.height = window.innerHeight;
  }

  _animateStars() {
    if (!this.starCtx || !this.starCanvas) return;

    const ctx = this.starCtx;
    const time = performance.now() * 0.001;

    ctx.clearRect(0, 0, this.starCanvas.width, this.starCanvas.height);

    this.stars.forEach(star => {
      const twinkle = Math.sin(time * star.twinkleSpeed * 10 + star.twinklePhase);
      const opacity = star.opacity * (0.6 + 0.4 * twinkle);

      ctx.beginPath();
      ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200, 220, 255, ${opacity})`;
      ctx.fill();

      // Add glow to brighter stars
      if (star.size > 1.2) {
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 220, 255, ${opacity * 0.1})`;
        ctx.fill();
      }
    });

    requestAnimationFrame(() => this._animateStars());
  }
}

// ── Initialize on DOM ready ──────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  window.app = new App();
  window.app.init();
});

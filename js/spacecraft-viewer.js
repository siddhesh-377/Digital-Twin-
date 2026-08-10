/* ============================================================
   SPACECRAFT VIEWER — Three.js 3D Spacecraft Visualization
   Procedurally generated ISS-inspired spacecraft with interactive
   modules, telemetry-driven animations, and multiple view modes.
   ============================================================ */

class SpacecraftViewer {
  constructor(containerId, eventBus) {
    this.containerId = containerId;
    this.eventBus = eventBus;
    this.initialized = false;

    this.container = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.controls = null;
    this.clock = null;

    this.spacecraft = null;
    this.earth = null;
    this.clouds = null;
    this.solarPanels = [];
    this.solarRotatableGroup = null;
    this.moduleGroups = {};
    this.baseMaterials = new Map();
    this.labels = {};
    this.labelContainer = null;

    this.particles = null;
    this.thrustersActive = false;

    this.raycaster = null;
    this.mouse = new (window.THREE ? THREE.Vector2 : Object)();
    this.hoveredModule = null;

    this.currentMode = 'realistic';
    this.targetCameraPos = null;
    this.targetCameraLookAt = null;
    this.isCameraTransitioning = false;
    this.cameraPreset = 'orbit';

    this.telemetry = {
      solarPanelAngle: 0,
      stationAttitude: { pitch: 0, yaw: 0, roll: 0 },
      thrusterFiring: false,
      subsystems: {}
    };

    this._animationFrameId = null;
    this._boundAnimate = this._animate.bind(this);
    this._boundResize = this.resize.bind(this);
    this._boundMouseMove = this._onMouseMove.bind(this);
    this._boundClick = this._onClick.bind(this);
  }

  init() {
    if (this.initialized) return;

    if (!window.THREE) {
      console.error('SpacecraftViewer: Three.js not loaded.');
      this._showError('Three.js library failed to load.');
      return;
    }

    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      console.error(`SpacecraftViewer: Container #${this.containerId} not found.`);
      return;
    }

    // Ensure the mouse vector is a proper THREE.Vector2
    this.mouse = new THREE.Vector2(-9999, -9999);

    try {
      this._setupRenderer();
      this._setupScene();
      this._setupCamera();
      this._setupControls();
      this._setupLights();
      this._createEnvironment();
      this._createSpacecraft();
      this._createLabels();
      this._createThrusterParticles();
      this._setupHUDControls();

      // Attach events
      this.container.addEventListener('mousemove', this._boundMouseMove);
      this.container.addEventListener('click', this._boundClick);

      // Hide loading, show HUD
      const loading = document.getElementById('viewer-loading');
      if (loading) loading.style.display = 'none';
      const hud = document.getElementById('viewer-hud');
      if (hud) hud.style.display = '';

      this.initialized = true;

      // Start animation loop
      this._animate();

      console.log('%c✓ Spacecraft Viewer initialized', 'color: #10b981;');
    } catch (e) {
      console.error('SpacecraftViewer init failed:', e);
      this._showError('WebGL initialization failed: ' + e.message);
    }
  }

  _showError(msg) {
    const loading = document.getElementById('viewer-loading');
    if (loading) {
      loading.innerHTML = `
        <div style="color: #ef4444; font-size: 24px; margin-bottom: 16px;">⚠️</div>
        <span class="text-display" style="color: #ef4444; font-size: 14px;">${msg}</span>
        <span style="color: #94a3b8; font-size: 12px; margin-top: 8px;">Check browser console for details.</span>
      `;
    }
  }

  // ── SETUP ──────────────────────────────────────────────────

  _setupRenderer() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x020408, 1);
    this.renderer.shadowMap.enabled = false; // Keep perf high
    this.renderer.domElement.style.display = 'block';
    this.container.appendChild(this.renderer.domElement);
  }

  _setupScene() {
    this.scene = new THREE.Scene();
    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
  }

  _setupCamera() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 600;
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 5000);
    this.camera.position.set(60, 35, 70);
    this.camera.lookAt(0, 0, 0);
  }

  _setupControls() {
    const OrbitCtrl = THREE.OrbitControls || window.OrbitControls;
    if (!OrbitCtrl) {
      console.warn('SpacecraftViewer: OrbitControls not available. Camera will be static.');
      return;
    }

    this.controls = new OrbitCtrl(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 15;
    this.controls.maxDistance = 400;
    this.controls.target.set(0, 0, 0);
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.4;
  }

  _setupLights() {
    // Sun directional light
    const sun = new THREE.DirectionalLight(0xfff5e6, 2.0);
    sun.position.set(200, 100, 100);
    this.scene.add(sun);

    // Dim ambient fill
    const ambient = new THREE.AmbientLight(0x334466, 0.3);
    this.scene.add(ambient);

    // Subtle blue fill from Earth below
    const earthFill = new THREE.PointLight(0x3366cc, 0.4, 500);
    earthFill.position.set(0, -60, 0);
    this.scene.add(earthFill);
  }

  // ── ENVIRONMENT ────────────────────────────────────────────

  _createEnvironment() {
    // ── Earth ──
    const earthGroup = new THREE.Group();
    earthGroup.position.set(0, -250, 0);

    const earthGeo = new THREE.SphereGeometry(200, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      color: 0x1565c0,
      emissive: 0x0d47a1,
      emissiveIntensity: 0.15,
      specular: 0x222222,
      shininess: 15
    });
    this.earth = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(this.earth);

    // Cloud layer
    const cloudGeo = new THREE.SphereGeometry(202, 48, 48);
    const cloudMat = new THREE.MeshPhongMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    this.clouds = new THREE.Mesh(cloudGeo, cloudMat);
    earthGroup.add(this.clouds);

    this.scene.add(earthGroup);

    // ── Stars ──
    const starCount = 2500;
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
      const r = 600 + Math.random() * 1200;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      sizes[i] = 0.5 + Math.random() * 1.5;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xeeeeff,
      size: 1.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9
    });
    this.scene.add(new THREE.Points(starGeo, starMat));
  }

  // ── SPACECRAFT MODEL ───────────────────────────────────────

  _createSpacecraft() {
    this.spacecraft = new THREE.Group();
    this.scene.add(this.spacecraft);

    // Materials
    const moduleMat = new THREE.MeshStandardMaterial({ color: 0xb8b8c0, metalness: 0.6, roughness: 0.45 });
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x707080, metalness: 0.8, roughness: 0.5 });
    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x1a237e, metalness: 0.3, roughness: 0.4,
      emissive: 0xbb9900, emissiveIntensity: 0.08, side: THREE.DoubleSide
    });
    const radiatorMat = new THREE.MeshStandardMaterial({
      color: 0xe0e0e0, emissive: 0xffffff, emissiveIntensity: 0.05, metalness: 0.1, roughness: 0.8
    });

    // Helper to create a named module
    const addModule = (geo, mat, groupName, position, rotation) => {
      const mesh = new THREE.Mesh(geo, mat.clone());
      mesh.position.set(position[0], position[1], position[2]);
      if (rotation) {
        mesh.rotation.set(rotation[0] || 0, rotation[1] || 0, rotation[2] || 0);
      }
      mesh.userData = { isModule: true, moduleName: groupName };
      mesh.name = groupName;

      this.baseMaterials.set(mesh.uuid, mesh.material.clone());

      if (!this.moduleGroups[groupName]) {
        const g = new THREE.Group();
        g.name = groupName;
        this.spacecraft.add(g);
        this.moduleGroups[groupName] = g;
      }
      this.moduleGroups[groupName].add(mesh);
      return mesh;
    };

    // ── Central modules ──
    addModule(new THREE.BoxGeometry(8, 4, 4), moduleMat, 'laboratory', [0, 0, 0]);       // Destiny
    addModule(new THREE.BoxGeometry(6, 3.8, 3.8), moduleMat, 'laboratory', [0, 0, 7]);   // Columbus
    addModule(new THREE.BoxGeometry(10, 4, 4.2), moduleMat, 'laboratory', [0, 0, -8]);   // JEM/Kibo

    // ── Structural nodes ──
    addModule(new THREE.BoxGeometry(4, 4, 4), moduleMat, 'structural', [6, 0, 0]);        // Unity
    addModule(new THREE.BoxGeometry(4, 4, 4), moduleMat, 'structural', [-6, 0, 0]);       // Harmony

    // ── Truss backbone ──
    addModule(new THREE.CylinderGeometry(0.4, 0.4, 55, 8), trussMat, 'structural', [0, 4, 0], [0, 0, Math.PI / 2]);

    // ── Life Support module ──
    addModule(new THREE.BoxGeometry(3.5, 3.5, 3.5), moduleMat, 'life-support', [9.5, 0, 0]);

    // ── Navigation / Cupola ──
    addModule(new THREE.SphereGeometry(1.8, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), moduleMat, 'navigation', [6, -2.5, 0], [Math.PI, 0, 0]);

    // ── Propulsion ──
    addModule(new THREE.CylinderGeometry(0.8, 0.8, 2.5, 8), moduleMat, 'propulsion', [0, 4, 27], [Math.PI / 2, 0, 0]);
    addModule(new THREE.CylinderGeometry(0.8, 0.8, 2.5, 8), moduleMat, 'propulsion', [0, 4, -27], [Math.PI / 2, 0, 0]);

    // Thruster nozzles
    addModule(new THREE.ConeGeometry(0.6, 1.2, 8), trussMat, 'propulsion', [0, 4, 28.8], [Math.PI / 2, 0, 0]);
    addModule(new THREE.ConeGeometry(0.6, 1.2, 8), trussMat, 'propulsion', [0, 4, -28.8], [-Math.PI / 2, 0, 0]);

    // ── Communications antennas ──
    addModule(new THREE.CylinderGeometry(2.2, 0.1, 0.8, 12), moduleMat, 'communications', [3, 7, 0]);
    addModule(new THREE.CylinderGeometry(0.08, 0.08, 4, 6), trussMat, 'communications', [3, 5, 0]);
    addModule(new THREE.CylinderGeometry(1.4, 0.1, 0.6, 12), moduleMat, 'communications', [-4, 7, 5]);

    // ── Solar arrays (4 pairs) ──
    this.solarRotatableGroup = new THREE.Group();
    this.solarRotatableGroup.name = 'power_rotatable';
    if (!this.moduleGroups['power']) {
      const pg = new THREE.Group();
      pg.name = 'power';
      this.spacecraft.add(pg);
      this.moduleGroups['power'] = pg;
    }
    this.moduleGroups['power'].add(this.solarRotatableGroup);

    const solarGeo = new THREE.PlaneGeometry(34, 11, 8, 3);
    const zPositions = [14, 21, -14, -21];
    zPositions.forEach(z => {
      [-1, 1].forEach(side => {
        const panel = new THREE.Mesh(solarGeo, solarMat.clone());
        panel.position.set(side * 19, 4, z);
        panel.rotation.x = Math.PI / 2;
        panel.userData = { isModule: true, moduleName: 'power' };
        this.baseMaterials.set(panel.uuid, panel.material.clone());
        this.solarRotatableGroup.add(panel);
        this.solarPanels.push(panel);
      });
    });

    // Solar panel grid wireframe overlay
    const gridMat = new THREE.MeshBasicMaterial({
      color: 0x3344aa, wireframe: true, transparent: true, opacity: 0.15
    });
    this.solarPanels.forEach(panel => {
      const wireframe = new THREE.Mesh(solarGeo, gridMat);
      wireframe.position.copy(panel.position);
      wireframe.rotation.copy(panel.rotation);
      wireframe.position.y += 0.05;
      this.solarRotatableGroup.add(wireframe);
    });

    // ── Thermal radiator panels ──
    const radGeo = new THREE.PlaneGeometry(8, 14);
    addModule(radGeo, radiatorMat, 'thermal', [0, -3, 14], [0, Math.PI / 2, 0]);
    addModule(radGeo, radiatorMat, 'thermal', [0, -3, -14], [0, Math.PI / 2, 0]);

    // ── Docking ports (small cylinders) ──
    const dockGeo = new THREE.CylinderGeometry(0.8, 0.8, 1.5, 12);
    addModule(dockGeo, trussMat, 'structural', [11.5, 0, 0], [0, 0, Math.PI / 2]);
    addModule(dockGeo, trussMat, 'structural', [-8, 0, 0], [0, 0, Math.PI / 2]);
  }

  // ── LABELS ─────────────────────────────────────────────────

  _createLabels() {
    this.labelContainer = document.createElement('div');
    Object.assign(this.labelContainer.style, {
      position: 'absolute', top: '0', left: '0',
      width: '100%', height: '100%',
      pointerEvents: 'none', overflow: 'hidden', zIndex: '5'
    });
    this.container.appendChild(this.labelContainer);

    const subsystemNames = {
      'laboratory': 'LAB', 'structural': 'STR', 'life-support': 'ECLSS',
      'power': 'EPS', 'thermal': 'TCS', 'navigation': 'GNC',
      'propulsion': 'PROP', 'communications': 'COMM'
    };

    Object.keys(this.moduleGroups).forEach(name => {
      const el = document.createElement('div');
      el.className = 'module-label';
      el.innerHTML = `
        <div class="label-name">${subsystemNames[name] || name}</div>
        <div class="label-status"><span class="status-dot nominal"></span> NOMINAL</div>
      `;
      el.style.display = 'none';
      this.labelContainer.appendChild(el);
      this.labels[name] = { el, statusEl: el.querySelector('.label-status') };
    });
  }

  _updateLabels() {
    if (!this.camera || !this.labelContainer) return;
    const w2 = this.container.clientWidth / 2;
    const h2 = this.container.clientHeight / 2;
    if (w2 === 0 || h2 === 0) return;

    const tempV = new THREE.Vector3();

    Object.keys(this.moduleGroups).forEach(name => {
      const group = this.moduleGroups[name];
      const label = this.labels[name];
      if (!label || !group || group.children.length === 0) return;

      // Get center of group
      const box = new THREE.Box3().setFromObject(group);
      box.getCenter(tempV);
      tempV.project(this.camera);

      // Behind camera check
      if (tempV.z > 1) { label.el.style.display = 'none'; return; }

      const x = (tempV.x * w2) + w2;
      const y = -(tempV.y * h2) + h2;

      // Off-screen check
      if (x < -50 || x > this.container.clientWidth + 50 || y < -50 || y > this.container.clientHeight + 50) {
        label.el.style.display = 'none';
        return;
      }

      label.el.style.display = 'block';
      label.el.style.left = x + 'px';
      label.el.style.top = y + 'px';
    });
  }

  // ── THRUSTER PARTICLES ─────────────────────────────────────

  _createThrusterParticles() {
    const count = 150;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const velocities = [];
    const lifetimes = [];

    for (let i = 0; i < count; i++) {
      pos[i * 3] = 9999; pos[i * 3 + 1] = 9999; pos[i * 3 + 2] = 9999;
      velocities.push(new THREE.Vector3());
      lifetimes.push(0);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xffaa33, size: 1.2, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
    });
    this.particles = new THREE.Points(geo, mat);
    this.particles.visible = false;
    this.particles.userData = { velocities, lifetimes };
    this.scene.add(this.particles);
  }

  _updateParticles(dt) {
    if (!this.particles) return;
    const positions = this.particles.geometry.attributes.position.array;
    const { velocities, lifetimes } = this.particles.userData;

    const shouldShow = this.thrustersActive || lifetimes.some(l => l > 0);
    this.particles.visible = shouldShow;
    if (!shouldShow) return;

    const propGroup = this.moduleGroups['propulsion'];
    const origins = [];
    if (propGroup) {
      propGroup.children.forEach(c => {
        if (c.isMesh) {
          const p = new THREE.Vector3();
          c.getWorldPosition(p);
          origins.push(p);
        }
      });
    }
    if (origins.length === 0) return;

    for (let i = 0; i < velocities.length; i++) {
      const idx = i * 3;
      if (lifetimes[i] <= 0 && this.thrustersActive) {
        lifetimes[i] = 0.3 + Math.random() * 0.5;
        const origin = origins[i % origins.length];
        positions[idx] = origin.x + (Math.random() - 0.5) * 0.5;
        positions[idx + 1] = origin.y + (Math.random() - 0.5) * 0.5;
        positions[idx + 2] = origin.z + (origin.z > 0 ? 1.5 : -1.5);
        velocities[i].set(
          (Math.random() - 0.5) * 1.5,
          (Math.random() - 0.5) * 1.5,
          (origin.z > 0 ? 1 : -1) * (8 + Math.random() * 8)
        );
      } else if (lifetimes[i] > 0) {
        lifetimes[i] -= dt;
        positions[idx] += velocities[i].x * dt;
        positions[idx + 1] += velocities[i].y * dt;
        positions[idx + 2] += velocities[i].z * dt;
      } else {
        positions[idx] = 9999;
      }
    }
    this.particles.geometry.attributes.position.needsUpdate = true;
  }

  // ── HUD CONTROLS ───────────────────────────────────────────

  _setupHUDControls() {
    // View mode buttons
    document.querySelectorAll('.view-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.view-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.setViewMode(btn.dataset.mode);
      });
    });

    // Camera preset buttons
    document.querySelectorAll('.camera-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setCameraPreset(btn.dataset.preset);
      });
    });
  }

  // ── PUBLIC API ─────────────────────────────────────────────

  update(telemetryData) {
    if (!telemetryData || !this.initialized) return;

    if (telemetryData.solarPanelAngle !== undefined)
      this.telemetry.solarPanelAngle = telemetryData.solarPanelAngle;
    if (telemetryData.solarPanelEfficiency !== undefined)
      this.telemetry.solarPanelEfficiency = telemetryData.solarPanelEfficiency;
    if (telemetryData.stationAttitude)
      this.telemetry.stationAttitude = telemetryData.stationAttitude;
    if (telemetryData.thrusterFiring !== undefined)
      this.telemetry.thrusterFiring = telemetryData.thrusterFiring;
    if (telemetryData.subsystems)
      this.telemetry.subsystems = telemetryData.subsystems;

    this.thrustersActive = !!this.telemetry.thrusterFiring;

    // Update module status colors
    if (this.telemetry.subsystems) {
      Object.keys(this.telemetry.subsystems).forEach(sys => {
        this._updateModuleStatus(sys, this.telemetry.subsystems[sys].status);
      });
    }

    // Update HUD values
    const altEl = document.getElementById('hud-altitude');
    const velEl = document.getElementById('hud-velocity');
    const attEl = document.getElementById('hud-attitude');
    if (altEl && telemetryData.altitude) altEl.textContent = telemetryData.altitude.toFixed(1) + ' km';
    if (velEl && telemetryData.velocity) velEl.textContent = telemetryData.velocity.toFixed(3) + ' km/s';
    if (attEl && this.telemetry.stationAttitude) {
      const a = this.telemetry.stationAttitude;
      attEl.textContent = `P:${(a.pitch||0).toFixed(1)} Y:${(a.yaw||0).toFixed(1)} R:${(a.roll||0).toFixed(1)}`;
    }
  }

  setViewMode(mode) {
    this.currentMode = mode;
    Object.keys(this.moduleGroups).forEach(name => {
      const group = this.moduleGroups[name];
      group.traverse(child => {
        if (!child.isMesh || !child.userData.isModule) return;
        const baseMat = this.baseMaterials.get(child.uuid);
        if (!baseMat) return;

        switch (mode) {
          case 'realistic':
            child.material = baseMat.clone();
            child.material.transparent = false;
            child.material.opacity = 1;
            if (this.telemetry.subsystems && this.telemetry.subsystems[name]) {
              this._updateModuleStatus(name, this.telemetry.subsystems[name].status);
            }
            break;
          case 'wireframe':
            child.material = new THREE.MeshBasicMaterial({
              color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.5
            });
            break;
          case 'heatmap': {
            let temp = 22;
            if (this.telemetry.subsystems && this.telemetry.subsystems[name])
              temp = this.telemetry.subsystems[name].temp || 22;
            const t = Math.max(0, Math.min(1, (temp - 0) / 60));
            const h = Math.max(0, (1 - t) * 0.33);
            const color = new THREE.Color().setHSL(h, 1, 0.5);
            child.material = new THREE.MeshBasicMaterial({ color });
            break;
          }
          case 'xray':
            child.material = new THREE.MeshStandardMaterial({
              color: baseMat.color, transparent: true, opacity: 0.15,
              emissive: 0x00f0ff, emissiveIntensity: 0.1, depthWrite: false
            });
            break;
        }
      });
    });
  }

  setCameraPreset(preset) {
    this.cameraPreset = preset;
    this.isCameraTransitioning = true;

    const pos = new THREE.Vector3();
    const look = new THREE.Vector3(0, 0, 0);

    switch (preset) {
      case 'front': pos.set(60, 5, 0); break;
      case 'back':  pos.set(-60, 5, 0); break;
      case 'top':   pos.set(0, 70, 0); look.set(0, 0, 0); break;
      case 'side':  pos.set(0, 5, 65); break;
      case 'iso':   pos.set(45, 35, 45); break;
      case 'orbit': pos.copy(this.camera.position).normalize().multiplyScalar(80); break;
      default:      pos.set(60, 35, 70);
    }

    this.targetCameraPos = pos;
    this.targetCameraLookAt = look;

    if (this.controls) {
      this.controls.autoRotate = (preset === 'orbit');
    }
  }

  triggerEmergency(systemName) {
    if (this.telemetry.subsystems[systemName]) {
      this.telemetry.subsystems[systemName].status = 'critical';
    }
    this._updateModuleStatus(systemName, 'critical');
  }

  clearEmergency() {
    Object.keys(this.telemetry.subsystems).forEach(sys => {
      if (this.telemetry.subsystems[sys].status === 'critical') {
        this.telemetry.subsystems[sys].status = 'nominal';
        this._updateModuleStatus(sys, 'nominal');
      }
    });
  }

  resize() {
    if (!this.container || !this.camera || !this.renderer) return;
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (w === 0 || h === 0) return; // Panel is hidden
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose() {
    if (this._animationFrameId) cancelAnimationFrame(this._animationFrameId);
    this.container?.removeEventListener('mousemove', this._boundMouseMove);
    this.container?.removeEventListener('click', this._boundClick);
    if (this.renderer?.domElement?.parentNode)
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    if (this.labelContainer?.parentNode)
      this.labelContainer.parentNode.removeChild(this.labelContainer);
    this.renderer?.dispose();
  }

  // ── PRIVATE METHODS ────────────────────────────────────────

  _updateModuleStatus(name, status) {
    const group = this.moduleGroups[name];
    if (!group) return;

    // Update label
    const label = this.labels[name];
    if (label && label.statusEl) {
      const dotClass = status === 'critical' ? 'critical' : status === 'warning' ? 'warning' : 'nominal';
      label.statusEl.innerHTML = `<span class="status-dot ${dotClass}"></span> ${status.toUpperCase()}`;
    }

    // Update material emissive in realistic mode
    if (this.currentMode === 'realistic') {
      group.traverse(child => {
        if (!child.isMesh || !child.userData.isModule) return;
        const baseMat = this.baseMaterials.get(child.uuid);
        if (!baseMat) return;
        const mat = child.material;
        if (status === 'critical') {
          mat.emissive = new THREE.Color(0xff0000);
          mat.emissiveIntensity = 0.6;
        } else if (status === 'warning') {
          mat.emissive = new THREE.Color(0xff8800);
          mat.emissiveIntensity = 0.35;
        } else {
          mat.emissive = baseMat.emissive.clone();
          mat.emissiveIntensity = baseMat.emissiveIntensity;
          mat.color = baseMat.color.clone();
        }
      });
    }
  }

  _onMouseMove(event) {
    if (!this.renderer) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _onClick() {
    if (!this.spacecraft) return;
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObject(this.spacecraft, true);
    if (hits.length > 0) {
      const obj = hits[0].object;
      if (obj.userData?.isModule) {
        const name = obj.userData.moduleName;
        const status = this.telemetry.subsystems?.[name]?.status || 'nominal';
        this.eventBus.emit('module:select', { name, status });
      }
    }
  }

  // ── ANIMATION LOOP ─────────────────────────────────────────

  _animate() {
    this._animationFrameId = requestAnimationFrame(this._boundAnimate);

    const dt = this.clock.getDelta();
    const elapsed = this.clock.getElapsedTime();

    // Controls
    if (this.controls) this.controls.update();

    // Camera transition
    if (this.isCameraTransitioning && this.targetCameraPos) {
      this.camera.position.lerp(this.targetCameraPos, 0.04);
      if (this.controls) this.controls.target.lerp(this.targetCameraLookAt, 0.04);
      if (this.camera.position.distanceTo(this.targetCameraPos) < 0.5) {
        this.isCameraTransitioning = false;
      }
    }

    // Earth rotation
    if (this.earth) this.earth.rotation.y += 0.04 * dt;
    if (this.clouds) this.clouds.rotation.y += 0.05 * dt;

    // Solar panel angle (smooth LERP)
    if (this.solarRotatableGroup) {
      const targetRad = THREE.MathUtils.degToRad(this.telemetry.solarPanelAngle || 0);
      this.solarRotatableGroup.rotation.x = THREE.MathUtils.lerp(
        this.solarRotatableGroup.rotation.x, targetRad, 0.03
      );
    }

    // Station attitude (smooth SLERP)
    if (this.spacecraft) {
      const att = this.telemetry.stationAttitude;
      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(att.pitch || 0),
        THREE.MathUtils.degToRad(att.yaw || 0),
        THREE.MathUtils.degToRad(att.roll || 0), 'YXZ'
      );
      const targetQ = new THREE.Quaternion().setFromEuler(euler);
      this.spacecraft.quaternion.slerp(targetQ, 0.03);
    }

    // Critical module pulse effect
    if (this.currentMode === 'realistic' && this.telemetry.subsystems) {
      const pulseIntensity = (Math.sin(elapsed * 5) + 1) / 2 * 0.6 + 0.2;
      Object.keys(this.telemetry.subsystems).forEach(sys => {
        if (this.telemetry.subsystems[sys].status === 'critical') {
          const group = this.moduleGroups[sys];
          if (group) {
            group.traverse(child => {
              if (child.isMesh && child.userData.isModule) {
                child.material.emissiveIntensity = pulseIntensity;
              }
            });
          }
        }
      });
    }

    // Hover highlighting
    if (this.spacecraft && this.mouse.x !== -9999) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hits = this.raycaster.intersectObject(this.spacecraft, true);
      if (hits.length > 0 && hits[0].object.userData?.isModule) {
        const obj = hits[0].object;
        if (this.hoveredModule !== obj) {
          this._clearHover();
          this.hoveredModule = obj;
          if (this.currentMode === 'realistic') {
            obj.material.emissive = new THREE.Color(0x88ccff);
            obj.material.emissiveIntensity = 0.25;
          }
          this.renderer.domElement.style.cursor = 'pointer';
        }
      } else {
        this._clearHover();
        this.renderer.domElement.style.cursor = '';
      }
    }

    // Particles
    this._updateParticles(dt);

    // Labels
    this._updateLabels();

    // Render
    this.renderer.render(this.scene, this.camera);
  }

  _clearHover() {
    if (this.hoveredModule && this.currentMode === 'realistic') {
      const sys = this.hoveredModule.userData.moduleName;
      const status = this.telemetry.subsystems?.[sys]?.status || 'nominal';
      this._updateModuleStatus(sys, status);
    }
    this.hoveredModule = null;
  }
}

window.SpacecraftViewer = SpacecraftViewer;

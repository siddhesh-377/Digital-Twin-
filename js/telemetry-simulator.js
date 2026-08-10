/* ============================================================
   TELEMETRY SIMULATOR — Real-time Spacecraft Telemetry Engine
   Generates realistic spacecraft telemetry data with variance,
   drift patterns, and anomaly injection capabilities.
   ============================================================ */

class TelemetrySimulator {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.running = false;
    this.speed = 1;
    this.tickInterval = null;
    this.tickRate = 1000; // ms between updates
    this.missionElapsedTime = 45 * 86400 + 14 * 3600; // Day 45, 14:00:00
    this.anomalies = {};
    this.rng = new SeededRandom(Date.now());

    // ── Initialize all telemetry channels ──
    this._initTelemetry();
  }

  _initTelemetry() {
    this.data = {
      // ── Mission Clock ──
      met: this.missionElapsedTime,
      utc: new Date(),
      orbitNumber: 712,
      orbitPhase: 'daylight', // daylight | eclipse
      orbitPhaseProgress: 0.35, // 0-1 within current phase

      // ── Orbital Parameters ──
      orbital: {
        altitude: 408.2,        // km
        velocity: 7.66,         // km/s
        inclination: 51.6,      // degrees
        period: 92.68,          // minutes
        eccentricity: 0.0001,
        apogee: 410.1,
        perigee: 406.3,
        groundTrackLon: -74.5,  // degrees
        groundTrackLat: 28.5    // degrees
      },

      // ── Atmosphere / Life Support (ECLSS) ──
      atmosphere: {
        cabinPressure: 14.7,    // psi (nominal: 14.7 ± 0.2)
        o2Partial: 3.08,        // psi (nominal: 2.83-3.35)
        co2Partial: 3.8,        // mmHg (nominal: < 5.3)
        n2Partial: 11.4,        // psi
        humidity: 42,           // % (nominal: 25-75)
        temperature: 22.2,      // °C (nominal: 18.3-26.7)
        airflow: 0.15           // m/s
      },

      // ── Electrical Power System (EPS) ──
      power: {
        solarArrayOutput: 84.2,   // kW
        totalLoad: 31.5,          // kW
        batteryCharge: 92,        // % (4 battery packs)
        batteryVoltage: 32.8,     // V
        solarPanelAngle: 45,      // degrees (beta angle tracking)
        solarPanelEfficiency: 94, // %
        channel1A: 160.2,         // V
        channel2A: 160.1,         // V
        channel3A: 160.3,         // V
        channel4A: 159.8          // V
      },

      // ── Thermal Control System (TCS) ──
      thermal: {
        loopATemp: 4.4,          // °C (internal thermal loop A)
        loopBTemp: 4.5,          // °C (internal thermal loop B)
        radiatorATemp: -40,      // °C (external radiator)
        radiatorBTemp: -38,      // °C
        ammoniaPressure: 250,    // psi
        heatRejection: 35.2,    // kW
        moduleTemps: {
          destiny: 22.1,
          harmony: 21.8,
          columbus: 22.5,
          kibo: 22.0,
          unity: 21.5,
          cupola: 20.8
        }
      },

      // ── Communications ──
      comms: {
        tdrsLink: true,
        signalStrength: -68,   // dBm (nominal: -40 to -90)
        dataRate: 300,         // Mbps (S-band + Ku-band)
        uplinkActive: true,
        downlinkActive: true,
        nextLOS: 840,          // seconds until Loss of Signal
        nextAOS: 0,            // seconds until Acquisition of Signal
        groundStation: 'White Sands'
      },

      // ── Propulsion / RCS ──
      propulsion: {
        fuelRemaining: 78.5,   // % (hydrazine)
        oxidRemaining: 80.2,   // %
        rcsStatus: 'standby',  // standby | active | firing
        thrusterFiring: false,
        deltaVRemaining: 128,  // m/s
        lastBurnDuration: 0,
        tankPressure: 298,     // psi
        temperature: 21        // °C
      },

      // ── GN&C (Guidance, Navigation & Control) ──
      gnc: {
        attitudeMode: 'TEA',   // Torque Equilibrium Attitude
        pitch: 0.0,            // degrees
        yaw: 0.0,
        roll: 0.0,
        pitchRate: 0.001,      // deg/s
        yawRate: -0.002,
        rollRate: 0.0005,
        cmgSaturation: 12,     // % (Control Moment Gyros)
        gpsLock: true,
        starTrackerActive: true
      },

      // ── Crew Vitals ──
      crew: {},

      // ── Subsystem Status Summary ──
      subsystems: {
        'life-support': { status: 'nominal', health: 98, alerts: 0, temp: 22 },
        'power': { status: 'nominal', health: 96, alerts: 0, temp: 35 },
        'propulsion': { status: 'nominal', health: 99, alerts: 0, temp: 21 },
        'communications': { status: 'nominal', health: 95, alerts: 0, temp: 28 },
        'thermal': { status: 'nominal', health: 97, alerts: 0, temp: 4 },
        'navigation': { status: 'nominal', health: 99, alerts: 0, temp: 24 },
        'laboratory': { status: 'nominal', health: 100, alerts: 0, temp: 22 },
        'structural': { status: 'nominal', health: 100, alerts: 0, temp: 22 }
      }
    };

    // Initialize crew vitals
    CREW_DATA.forEach(member => {
      this.data.crew[member.id] = {
        heartRate: 68 + Math.random() * 12,
        bloodPressureSys: 118 + Math.random() * 8,
        bloodPressureDia: 76 + Math.random() * 6,
        spO2: 97 + Math.random() * 2,
        bodyTemp: 36.4 + Math.random() * 0.6,
        respirationRate: 14 + Math.random() * 4,
        activityLevel: 'nominal', // rest | nominal | exercise | eva
        stressLevel: 15 + Math.random() * 20, // 0-100
        sleepQuality: 75 + Math.random() * 20,
        radiationDose: 0.5 + Math.random() * 0.3, // mSv today
        suitPressure: 4.3,
        suitO2: 100,
        suitBattery: 100,
        suitCO2Scrubber: 100
      };
    });

    // ── Telemetry History (for charts) ──
    this.history = {
      timestamps: [],
      cabinPressure: [],
      o2Level: [],
      co2Level: [],
      temperature: [],
      humidity: [],
      solarOutput: [],
      batteryCharge: [],
      powerLoad: [],
      altitude: [],
      signalStrength: []
    };

    // Pre-fill with 60 data points
    for (let i = 60; i > 0; i--) {
      this.history.timestamps.push(this.missionElapsedTime - i);
      this.history.cabinPressure.push(14.7 + (Math.random() - 0.5) * 0.05);
      this.history.o2Level.push(3.08 + (Math.random() - 0.5) * 0.04);
      this.history.co2Level.push(3.8 + (Math.random() - 0.5) * 0.3);
      this.history.temperature.push(22.2 + (Math.random() - 0.5) * 0.3);
      this.history.humidity.push(42 + (Math.random() - 0.5) * 3);
      this.history.solarOutput.push(84 + (Math.random() - 0.5) * 4);
      this.history.batteryCharge.push(92 + (Math.random() - 0.5) * 2);
      this.history.powerLoad.push(31.5 + (Math.random() - 0.5) * 2);
      this.history.altitude.push(408.2 + (Math.random() - 0.5) * 0.4);
      this.history.signalStrength.push(-68 + (Math.random() - 0.5) * 6);
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.tickInterval = setInterval(() => this._tick(), this.tickRate / this.speed);
    this.eventBus.emit('sim:start');
  }

  stop() {
    this.running = false;
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = null;
    this.eventBus.emit('sim:stop');
  }

  reset() {
    this.stop();
    this.anomalies = {};
    this._initTelemetry();
    this.eventBus.emit('sim:reset');
  }

  setSpeed(multiplier) {
    this.speed = MathUtils.clamp(multiplier, 0.1, 10);
    if (this.running) {
      clearInterval(this.tickInterval);
      this.tickInterval = setInterval(() => this._tick(), this.tickRate / this.speed);
    }
    this.eventBus.emit('sim:speed', this.speed);
  }

  getTelemetry() {
    return this.data;
  }

  getHistory() {
    return this.history;
  }

  /** Inject an anomaly into a subsystem */
  injectAnomaly(type, severity = 'warning') {
    this.anomalies[type] = {
      severity,
      startTime: this.data.met,
      active: true
    };
    this.eventBus.emit('anomaly:inject', { type, severity });
    return this.anomalies[type];
  }

  /** Clear an anomaly */
  clearAnomaly(type) {
    if (this.anomalies[type]) {
      this.anomalies[type].active = false;
      this.eventBus.emit('anomaly:clear', { type });
    }
  }

  /** Clear all anomalies */
  clearAllAnomalies() {
    Object.keys(this.anomalies).forEach(type => this.clearAnomaly(type));
  }

  // ── Private: Main Simulation Tick ──────────────────────────
  _tick() {
    const dt = this.speed; // seconds per tick
    this.data.met += dt;
    this.data.utc = new Date();

    // ── Update Orbital Parameters ──
    this._updateOrbital(dt);

    // ── Update Atmosphere ──
    this._updateAtmosphere(dt);

    // ── Update Power ──
    this._updatePower(dt);

    // ── Update Thermal ──
    this._updateThermal(dt);

    // ── Update Communications ──
    this._updateComms(dt);

    // ── Update GN&C ──
    this._updateGNC(dt);

    // ── Update Crew Vitals ──
    this._updateCrew(dt);

    // ── Apply Anomalies ──
    this._applyAnomalies(dt);

    // ── Update Subsystem Health Summary ──
    this._updateSubsystemStatus();

    // ── Record History ──
    this._recordHistory();

    // ── Emit Telemetry Update ──
    this.eventBus.emit('telemetry:update', this.data);
  }

  _updateOrbital(dt) {
    const orb = this.data.orbital;
    // Simulate orbit progression
    const orbitalPeriodSec = orb.period * 60;
    const progress = (this.data.met % orbitalPeriodSec) / orbitalPeriodSec;

    // Ground track movement
    orb.groundTrackLon = ((orb.groundTrackLon - 0.004 * dt * this.speed) + 360) % 360 - 180;
    orb.groundTrackLat = orb.inclination * Math.sin(progress * 2 * Math.PI);

    // Altitude oscillation (eccentricity effect)
    orb.altitude = 408.2 + 1.9 * Math.sin(progress * 2 * Math.PI) + (Math.random() - 0.5) * 0.02;
    orb.velocity = 7.66 + 0.002 * Math.cos(progress * 2 * Math.PI);

    // Orbit phase (day/night)
    this.data.orbitPhaseProgress = progress;
    this.data.orbitPhase = (progress > 0.38 && progress < 0.62) ? 'eclipse' : 'daylight';
    this.data.orbitNumber = Math.floor(this.data.met / orbitalPeriodSec);
  }

  _updateAtmosphere(dt) {
    const atm = this.data.atmosphere;
    // Small random drift with mean reversion
    atm.cabinPressure = this._drift(atm.cabinPressure, 14.7, 0.005, 0.01);
    atm.o2Partial = this._drift(atm.o2Partial, 3.08, 0.003, 0.02);
    atm.co2Partial = this._drift(atm.co2Partial, 3.8, 0.02, 0.03);
    atm.humidity = this._drift(atm.humidity, 42, 0.2, 0.05);
    atm.temperature = this._drift(atm.temperature, 22.2, 0.03, 0.02);
    atm.n2Partial = 14.7 - atm.o2Partial - 0.22; // Derived
  }

  _updatePower(dt) {
    const pwr = this.data.power;
    const isEclipse = this.data.orbitPhase === 'eclipse';

    // Solar output drops to near-zero during eclipse
    const targetSolarOutput = isEclipse ? 2.5 : (84 + Math.random() * 4);
    pwr.solarArrayOutput = MathUtils.lerp(pwr.solarArrayOutput, targetSolarOutput, 0.05);

    // Battery charge/discharge
    if (isEclipse) {
      pwr.batteryCharge = Math.max(40, pwr.batteryCharge - 0.08 * dt);
    } else {
      pwr.batteryCharge = Math.min(100, pwr.batteryCharge + 0.03 * dt);
    }

    pwr.totalLoad = this._drift(pwr.totalLoad, 31.5, 0.3, 0.02);
    pwr.batteryVoltage = 28 + (pwr.batteryCharge / 100) * 5;
    pwr.solarPanelAngle = (pwr.solarPanelAngle + 0.1 * dt) % 360;
    pwr.solarPanelEfficiency = isEclipse ? 5 : this._drift(pwr.solarPanelEfficiency, 94, 0.5, 0.01);

    // Channel voltages
    pwr.channel1A = this._drift(pwr.channel1A, 160.2, 0.1, 0.005);
    pwr.channel2A = this._drift(pwr.channel2A, 160.1, 0.1, 0.005);
    pwr.channel3A = this._drift(pwr.channel3A, 160.3, 0.1, 0.005);
    pwr.channel4A = this._drift(pwr.channel4A, 159.8, 0.1, 0.005);
  }

  _updateThermal(dt) {
    const thm = this.data.thermal;
    thm.loopATemp = this._drift(thm.loopATemp, 4.4, 0.1, 0.03);
    thm.loopBTemp = this._drift(thm.loopBTemp, 4.5, 0.1, 0.03);

    const isEclipse = this.data.orbitPhase === 'eclipse';
    const radTarget = isEclipse ? -60 : -35;
    thm.radiatorATemp = MathUtils.lerp(thm.radiatorATemp, radTarget + Math.random() * 5, 0.02);
    thm.radiatorBTemp = MathUtils.lerp(thm.radiatorBTemp, radTarget + Math.random() * 5, 0.02);

    thm.ammoniaPressure = this._drift(thm.ammoniaPressure, 250, 0.5, 0.01);
    thm.heatRejection = this._drift(thm.heatRejection, 35.2, 0.3, 0.02);

    // Module temperatures
    Object.keys(thm.moduleTemps).forEach(mod => {
      thm.moduleTemps[mod] = this._drift(thm.moduleTemps[mod], 22, 0.05, 0.01);
    });
  }

  _updateComms(dt) {
    const com = this.data.comms;
    com.nextLOS = Math.max(0, com.nextLOS - dt);
    com.signalStrength = this._drift(com.signalStrength, -68, 1, 0.03);
    com.dataRate = this._drift(com.dataRate, 300, 5, 0.02);

    // Simulate LOS/AOS cycle
    if (com.nextLOS <= 0 && com.tdrsLink) {
      com.tdrsLink = false;
      com.nextAOS = 180 + Math.random() * 120; // 3-5 minutes LOS
      com.signalStrength = -110;
      com.dataRate = 0;
      this.eventBus.emit('comms:los');
    }

    if (!com.tdrsLink) {
      com.nextAOS = Math.max(0, com.nextAOS - dt);
      if (com.nextAOS <= 0) {
        com.tdrsLink = true;
        com.nextLOS = 1200 + Math.random() * 600; // 20-30 minutes
        com.signalStrength = -60 - Math.random() * 20;
        com.dataRate = 300;
        this.eventBus.emit('comms:aos');
      }
    }
  }

  _updateGNC(dt) {
    const gnc = this.data.gnc;
    // Small attitude drift
    gnc.pitch = this._drift(gnc.pitch, 0, 0.01, 0.1);
    gnc.yaw = this._drift(gnc.yaw, 0, 0.01, 0.1);
    gnc.roll = this._drift(gnc.roll, 0, 0.005, 0.1);

    gnc.pitchRate = this._drift(gnc.pitchRate, 0.001, 0.0005, 0.2);
    gnc.yawRate = this._drift(gnc.yawRate, -0.002, 0.0005, 0.2);
    gnc.rollRate = this._drift(gnc.rollRate, 0.0005, 0.0002, 0.2);

    gnc.cmgSaturation = this._drift(gnc.cmgSaturation, 12, 0.5, 0.02);
  }

  _updateCrew(dt) {
    CREW_DATA.forEach(member => {
      const vitals = this.data.crew[member.id];
      if (!vitals) return;

      // Heart rate varies by activity
      const hrTarget = vitals.activityLevel === 'exercise' ? 140 :
                        vitals.activityLevel === 'rest' ? 58 :
                        vitals.activityLevel === 'eva' ? 95 : 72;
      vitals.heartRate = this._drift(vitals.heartRate, hrTarget, 0.5, 0.05);
      vitals.bloodPressureSys = this._drift(vitals.bloodPressureSys, 120, 0.3, 0.02);
      vitals.bloodPressureDia = this._drift(vitals.bloodPressureDia, 78, 0.2, 0.02);
      vitals.spO2 = MathUtils.clamp(this._drift(vitals.spO2, 98, 0.1, 0.01), 90, 100);
      vitals.bodyTemp = this._drift(vitals.bodyTemp, 36.6, 0.02, 0.01);
      vitals.respirationRate = this._drift(vitals.respirationRate, 16, 0.3, 0.03);
      vitals.stressLevel = MathUtils.clamp(this._drift(vitals.stressLevel, 25, 0.5, 0.02), 0, 100);
      vitals.radiationDose += 0.00001 * dt;

      // EVA suit telemetry (only relevant during EVA)
      if (vitals.activityLevel === 'eva') {
        vitals.suitO2 = Math.max(0, vitals.suitO2 - 0.005 * dt);
        vitals.suitBattery = Math.max(0, vitals.suitBattery - 0.003 * dt);
        vitals.suitCO2Scrubber = Math.max(0, vitals.suitCO2Scrubber - 0.002 * dt);
      }
    });
  }

  _applyAnomalies(dt) {
    Object.entries(this.anomalies).forEach(([type, anomaly]) => {
      if (!anomaly.active) return;

      switch (type) {
        case 'cabin-depressurization':
          this.data.atmosphere.cabinPressure -= (anomaly.severity === 'critical' ? 0.05 : 0.015) * dt;
          this.data.subsystems['life-support'].status = anomaly.severity;
          break;

        case 'fire':
          this.data.atmosphere.co2Partial += 0.1 * dt;
          this.data.atmosphere.temperature += 0.3 * dt;
          this.data.subsystems['life-support'].status = 'critical';
          break;

        case 'power-failure':
          this.data.power.solarArrayOutput *= 0.95;
          this.data.power.batteryCharge -= 0.3 * dt;
          this.data.subsystems['power'].status = anomaly.severity;
          break;

        case 'medical-emergency':
          const crewId = CREW_DATA[0].id;
          if (this.data.crew[crewId]) {
            this.data.crew[crewId].heartRate += 0.5 * dt;
            this.data.crew[crewId].spO2 -= 0.05 * dt;
            this.data.crew[crewId].stressLevel = Math.min(100, this.data.crew[crewId].stressLevel + 0.5 * dt);
          }
          break;

        case 'debris-impact':
          this.data.atmosphere.cabinPressure -= 0.08 * dt;
          this.data.subsystems['structural'].status = 'critical';
          this.data.subsystems['life-support'].status = 'warning';
          break;

        case 'comm-blackout':
          this.data.comms.tdrsLink = false;
          this.data.comms.signalStrength = -120;
          this.data.comms.dataRate = 0;
          this.data.subsystems['communications'].status = 'critical';
          break;

        case 'coolant-leak':
          this.data.thermal.ammoniaPressure -= 0.5 * dt;
          this.data.thermal.loopATemp += 0.1 * dt;
          this.data.subsystems['thermal'].status = anomaly.severity;
          break;

        case 'cmg-failure':
          this.data.gnc.cmgSaturation += 0.8 * dt;
          this.data.gnc.pitchRate += 0.001 * dt;
          this.data.subsystems['navigation'].status = anomaly.severity;
          break;
      }
    });
  }

  _updateSubsystemStatus() {
    const ss = this.data.subsystems;

    // Life Support status from atmosphere
    if (!this.anomalies['cabin-depressurization']?.active && !this.anomalies['fire']?.active) {
      const atm = this.data.atmosphere;
      if (atm.cabinPressure < 13.5 || atm.co2Partial > 7) {
        ss['life-support'].status = 'critical';
      } else if (atm.cabinPressure < 14.0 || atm.co2Partial > 5.3) {
        ss['life-support'].status = 'warning';
      } else {
        ss['life-support'].status = 'nominal';
      }
    }
    ss['life-support'].temp = this.data.atmosphere.temperature;

    // Power status
    if (!this.anomalies['power-failure']?.active) {
      if (this.data.power.batteryCharge < 30) {
        ss['power'].status = 'critical';
      } else if (this.data.power.batteryCharge < 50) {
        ss['power'].status = 'warning';
      } else {
        ss['power'].status = 'nominal';
      }
    }
    ss['power'].temp = 35;

    // Communications status
    if (!this.anomalies['comm-blackout']?.active) {
      ss['communications'].status = this.data.comms.tdrsLink ? 'nominal' : 'warning';
    }

    // Navigation status
    if (!this.anomalies['cmg-failure']?.active) {
      if (this.data.gnc.cmgSaturation > 80) {
        ss['navigation'].status = 'critical';
      } else if (this.data.gnc.cmgSaturation > 50) {
        ss['navigation'].status = 'warning';
      } else {
        ss['navigation'].status = 'nominal';
      }
    }

    // Update health scores based on status
    Object.values(ss).forEach(sub => {
      const targetHealth = sub.status === 'nominal' ? 95 + Math.random() * 5 :
                           sub.status === 'warning' ? 60 + Math.random() * 20 :
                           20 + Math.random() * 20;
      sub.health = MathUtils.lerp(sub.health, targetHealth, 0.05);
      sub.alerts = sub.status === 'nominal' ? 0 : sub.status === 'warning' ? 1 : Math.floor(Math.random() * 3) + 2;
    });
  }

  _recordHistory() {
    const maxPoints = 120;
    this.history.timestamps.push(this.data.met);
    this.history.cabinPressure.push(this.data.atmosphere.cabinPressure);
    this.history.o2Level.push(this.data.atmosphere.o2Partial);
    this.history.co2Level.push(this.data.atmosphere.co2Partial);
    this.history.temperature.push(this.data.atmosphere.temperature);
    this.history.humidity.push(this.data.atmosphere.humidity);
    this.history.solarOutput.push(this.data.power.solarArrayOutput);
    this.history.batteryCharge.push(this.data.power.batteryCharge);
    this.history.powerLoad.push(this.data.power.totalLoad);
    this.history.altitude.push(this.data.orbital.altitude);
    this.history.signalStrength.push(this.data.comms.signalStrength);

    // Trim to maxPoints
    Object.keys(this.history).forEach(key => {
      if (this.history[key].length > maxPoints) {
        this.history[key] = this.history[key].slice(-maxPoints);
      }
    });
  }

  /** Utility: drift a value toward target with random noise and mean reversion */
  _drift(current, target, noise, reversion) {
    const r = (Math.random() - 0.5) * 2 * noise;
    const pull = (target - current) * reversion;
    return current + r + pull;
  }
}

window.TelemetrySimulator = TelemetrySimulator;

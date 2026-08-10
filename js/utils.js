/* ============================================================
   UTILS.JS — Core Utilities for Spacecraft Digital Twin Platform
   ============================================================ */

// ── Event Bus ────────────────────────────────────────────────
class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (!this._listeners[event]) return;
    this._listeners[event].forEach(cb => {
      try { cb(data); } catch (e) { console.error(`EventBus error on "${event}":`, e); }
    });
  }

  clear() {
    this._listeners = {};
  }
}

// ── Seeded Random Number Generator (Mulberry32) ──────────────
class SeededRandom {
  constructor(seed = 42) {
    this._seed = seed;
  }

  next() {
    let t = this._seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min, max) {
    return min + this.next() * (max - min);
  }

  intRange(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
}

// ── Data Formatters ──────────────────────────────────────────
const Formatters = {
  /** Format number with fixed decimals and optional unit */
  value(num, decimals = 1, unit = '') {
    if (num == null || isNaN(num)) return '—';
    return num.toFixed(decimals) + (unit ? ` ${unit}` : '');
  },

  /** Format percentage */
  percent(num, decimals = 1) {
    if (num == null || isNaN(num)) return '—';
    return num.toFixed(decimals) + '%';
  },

  /** Format Mission Elapsed Time from seconds */
  met(totalSeconds) {
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(days).padStart(3, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  },

  /** Format UTC timestamp */
  utc(date) {
    if (!date) date = new Date();
    return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  },

  /** Format time as HH:MM */
  time(date) {
    if (!date) date = new Date();
    return String(date.getUTCHours()).padStart(2, '0') + ':' + String(date.getUTCMinutes()).padStart(2, '0');
  },

  /** Format large numbers with K/M suffixes */
  compact(num) {
    if (num == null || isNaN(num)) return '—';
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1) + 'M';
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toFixed(0);
  },

  /** Format km/s velocity */
  velocity(kmPerSec, decimals = 3) {
    return kmPerSec.toFixed(decimals) + ' km/s';
  },

  /** Format altitude in km */
  altitude(km, decimals = 1) {
    return km.toFixed(decimals) + ' km';
  }
};

// ── Easing Functions ─────────────────────────────────────────
const Easing = {
  linear: t => t,
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  easeOutCubic: t => (--t) * t * t + 1,
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2
};

// ── Math Utilities ───────────────────────────────────────────
const MathUtils = {
  /** Linear interpolation */
  lerp(a, b, t) {
    return a + (b - a) * Math.max(0, Math.min(1, t));
  },

  /** Clamp value between min and max */
  clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  },

  /** Map value from one range to another */
  map(value, inMin, inMax, outMin, outMax) {
    return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
  },

  /** Generate gaussian random number (Box-Muller) */
  gaussianRandom(mean = 0, stddev = 1) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return mean + z * stddev;
  },

  /** Degrees to radians */
  degToRad(deg) {
    return deg * (Math.PI / 180);
  },

  /** Radians to degrees */
  radToDeg(rad) {
    return rad * (180 / Math.PI);
  },

  /** Smooth damp (spring-like smooth interpolation) */
  smoothDamp(current, target, velocity, smoothTime, deltaTime) {
    const omega = 2 / smoothTime;
    const x = omega * deltaTime;
    const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
    let change = current - target;
    const temp = (velocity + omega * change) * deltaTime;
    velocity = (velocity - omega * temp) * exp;
    let output = target + (change + temp) * exp;
    return { value: output, velocity };
  }
};

// ── DOM Helpers ──────────────────────────────────────────────
const DOM = {
  /** Create element with optional classes, attributes, and children */
  create(tag, options = {}) {
    const el = document.createElement(tag);
    if (options.className) el.className = options.className;
    if (options.id) el.id = options.id;
    if (options.text) el.textContent = options.text;
    if (options.html) el.innerHTML = options.html;
    if (options.attrs) {
      Object.entries(options.attrs).forEach(([k, v]) => el.setAttribute(k, v));
    }
    if (options.style) {
      Object.entries(options.style).forEach(([k, v]) => el.style[k] = v);
    }
    if (options.children) {
      options.children.forEach(child => {
        if (typeof child === 'string') el.appendChild(document.createTextNode(child));
        else el.appendChild(child);
      });
    }
    if (options.parent) options.parent.appendChild(el);
    return el;
  },

  /** Query selector shorthand */
  $(selector, parent = document) {
    return parent.querySelector(selector);
  },

  /** Query selector all shorthand */
  $$(selector, parent = document) {
    return Array.from(parent.querySelectorAll(selector));
  },

  /** Show element */
  show(el) {
    if (el) el.classList.add('active');
  },

  /** Hide element */
  hide(el) {
    if (el) el.classList.remove('active');
  },

  /** Toggle class */
  toggle(el, className) {
    if (el) el.classList.toggle(className);
  }
};

// ── Local Storage Helpers ────────────────────────────────────
const Storage = {
  prefix: 'sdt_',

  set(key, value) {
    try {
      localStorage.setItem(this.prefix + key, JSON.stringify(value));
    } catch (e) { /* quota exceeded */ }
  },

  get(key, defaultValue = null) {
    try {
      const item = localStorage.getItem(this.prefix + key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) { return defaultValue; }
  },

  remove(key) {
    localStorage.removeItem(this.prefix + key);
  }
};

// ── Color Utilities ──────────────────────────────────────────
const ColorUtils = {
  /** Interpolate between two hex colors */
  lerpColor(colorA, colorB, t) {
    const a = this.hexToRgb(colorA);
    const b = this.hexToRgb(colorB);
    const r = Math.round(MathUtils.lerp(a.r, b.r, t));
    const g = Math.round(MathUtils.lerp(a.g, b.g, t));
    const bl = Math.round(MathUtils.lerp(a.b, b.b, t));
    return `rgb(${r}, ${g}, ${bl})`;
  },

  hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 0, g: 0, b: 0 };
  },

  /** Get status color based on value and thresholds */
  statusColor(value, warningThreshold, criticalThreshold, inverted = false) {
    if (inverted) {
      if (value <= criticalThreshold) return '#ef4444';
      if (value <= warningThreshold) return '#f59e0b';
      return '#10b981';
    }
    if (value >= criticalThreshold) return '#ef4444';
    if (value >= warningThreshold) return '#f59e0b';
    return '#10b981';
  },

  /** Heatmap color (green -> yellow -> red) based on 0-1 value */
  heatmap(t) {
    t = MathUtils.clamp(t, 0, 1);
    if (t < 0.5) {
      return this.lerpColor('#10b981', '#f59e0b', t * 2);
    }
    return this.lerpColor('#f59e0b', '#ef4444', (t - 0.5) * 2);
  }
};

// ── Crew Data ────────────────────────────────────────────────
const CREW_DATA = [
  { id: 'cdr', name: 'CDR Sarah Chen', role: 'Commander', callsign: 'CDR', initials: 'SC', color: '#3b82f6' },
  { id: 'plt', name: 'PLT James Wilson', role: 'Pilot', callsign: 'PLT', initials: 'JW', color: '#8b5cf6' },
  { id: 'ms1', name: 'MS1 Yuki Tanaka', role: 'Mission Specialist 1', callsign: 'MS1', initials: 'YT', color: '#10b981' },
  { id: 'ms2', name: 'MS2 Alexei Volkov', role: 'Mission Specialist 2', callsign: 'MS2', initials: 'AV', color: '#f59e0b' },
  { id: 'ms3', name: 'MS3 Priya Sharma', role: 'Flight Engineer', callsign: 'MS3', initials: 'PS', color: '#ef4444' },
  { id: 'ms4', name: 'MS4 Marcus Johnson', role: 'Payload Specialist', callsign: 'MS4', initials: 'MJ', color: '#00f0ff' }
];

// ── Subsystem Definitions ────────────────────────────────────
const SUBSYSTEMS = {
  'life-support': { name: 'Life Support', icon: '🫁', abbr: 'ECLSS' },
  'power': { name: 'Electrical Power', icon: '⚡', abbr: 'EPS' },
  'propulsion': { name: 'Propulsion', icon: '🔥', abbr: 'PROP' },
  'communications': { name: 'Communications', icon: '📡', abbr: 'COMM' },
  'thermal': { name: 'Thermal Control', icon: '🌡️', abbr: 'TCS' },
  'navigation': { name: 'GN&C', icon: '🧭', abbr: 'GNC' },
  'laboratory': { name: 'Laboratory', icon: '🔬', abbr: 'LAB' },
  'structural': { name: 'Structural', icon: '🏗️', abbr: 'STR' }
};

// ── Toast Notification Manager ───────────────────────────────
class ToastManager {
  constructor(containerId = 'toast-container') {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      this.container = DOM.create('div', { id: containerId, className: 'toast-container' });
      document.body.appendChild(this.container);
    }
    this.toasts = [];
    this.maxToasts = 5;
  }

  show(message, type = 'info', duration = 5000) {
    const toast = DOM.create('div', {
      className: `toast toast-${type}`,
      html: `
        <div class="toast-icon">${this._getIcon(type)}</div>
        <div class="toast-content">
          <div class="toast-title">${this._getTitle(type)}</div>
          <div class="toast-message">${message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
      `
    });

    this.container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    // Remove oldest if exceeding max
    const toasts = this.container.querySelectorAll('.toast');
    if (toasts.length > this.maxToasts) {
      toasts[0].remove();
    }

    if (duration > 0) {
      setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
      }, duration);
    }

    return toast;
  }

  _getIcon(type) {
    const icons = { info: 'ℹ️', success: '✅', warning: '⚠️', critical: '🚨', error: '❌' };
    return icons[type] || icons.info;
  }

  _getTitle(type) {
    const titles = { info: 'INFO', success: 'SUCCESS', warning: 'WARNING', critical: 'CRITICAL', error: 'ERROR' };
    return titles[type] || 'NOTICE';
  }
}

// ── Communication Log ────────────────────────────────────────
const COMM_MESSAGES = [
  { sender: 'CAPCOM', message: 'Station, Houston. Comm check, over.' },
  { sender: 'CDR', message: 'Houston, Station. Loud and clear.' },
  { sender: 'CAPCOM', message: 'Copy. All systems nominal. You are GO for EVA prep.' },
  { sender: 'CDR', message: 'Roger. Beginning EVA suit checkout procedures.' },
  { sender: 'FLIGHT', message: 'CAPCOM, advise crew of upcoming TDRS handover in 12 minutes.' },
  { sender: 'CAPCOM', message: 'Station, be advised: TDRS handover at MET 045:14:22:00. Expect 30-second LOS.' },
  { sender: 'MS1', message: 'Copy, Houston. Securing loose items in the JEM module.' },
  { sender: 'CAPCOM', message: 'Station, ground confirms solar alpha joint rotation is nominal.' },
  { sender: 'PLT', message: 'Houston, Pilot. Noting slight vibration in the port SARJ. Monitoring.' },
  { sender: 'CAPCOM', message: 'Copy, Pilot. We see it in telemetry. Within nominal bounds.' },
  { sender: 'MS2', message: 'Houston, MS2. Fluid physics experiment rack powered up and running.' },
  { sender: 'CAPCOM', message: 'Good copy. Ground has data flow confirmed.' },
  { sender: 'MS3', message: 'Houston, MS3. ECLSS water recovery system filter swap complete.' },
  { sender: 'CAPCOM', message: 'Excellent. New filter data looks good from down here.' },
  { sender: 'CDR', message: 'Houston, CDR. Crew status: all six crew members in good health.' },
  { sender: 'CAPCOM', message: 'Great to hear, Station. You are GO for the afternoon science block.' },
  { sender: 'FLIGHT', message: 'All flight controllers, this is Flight. GO/NO-GO for EVA: we are GO.' },
  { sender: 'CAPCOM', message: 'Station, Houston. You are GO for EVA. Hatch open at MET 045:16:00:00.' },
  { sender: 'CDR', message: 'Roger, GO for EVA. CDR and MS1 suiting up.' },
  { sender: 'MS4', message: 'Houston, Payload Specialist. Crystal growth experiment showing excellent results.' }
];

// ── Export to global scope ───────────────────────────────────
window.EventBus = EventBus;
window.SeededRandom = SeededRandom;
window.Formatters = Formatters;
window.Easing = Easing;
window.MathUtils = MathUtils;
window.DOM = DOM;
window.Storage = Storage;
window.ColorUtils = ColorUtils;
window.CREW_DATA = CREW_DATA;
window.SUBSYSTEMS = SUBSYSTEMS;
window.ToastManager = ToastManager;
window.COMM_MESSAGES = COMM_MESSAGES;

import { lerpColor, paletteById, rgbCss, type Palette, type RGB } from "@/lib/flow/palettes";
import { makeNoise, type Noise3 } from "@/lib/flow/noise";
import type { FlowSettings } from "@/lib/flow/store";

const BINS = 24;
const MAX_PARTICLES = 8000;
const CELL = 30;

type Hooks = {
  onExported: (ok: boolean) => void;
};

function expLerp(a: number, b: number, t: number) {
  return Math.exp(Math.log(a) * (1 - t) + Math.log(b) * t);
}

export class FlowEngine {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private running = false;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private noise: Noise3 = makeNoise(1);
  private seed = -1;
  private palette: Palette = paletteById("tide");
  private speed = 0.46;
  private trail = 0.76;
  private scale = 0.36;
  private paused = false;
  private pointerOn = false;
  private z = 0;
  private zSpeed = 0.05;
  private orbit = 0.12;
  private orbitSign = 1;
  private freqMul = 1;
  private pendingSeed: number | null = null;
  private veil = 0;
  private exportRequest = 0;
  private count = 0;
  private readonly x = new Float32Array(MAX_PARTICLES);
  private readonly y = new Float32Array(MAX_PARTICLES);
  private readonly px = new Float32Array(MAX_PARTICLES);
  private readonly py = new Float32Array(MAX_PARTICLES);
  private readonly vx = new Float32Array(MAX_PARTICLES);
  private readonly vy = new Float32Array(MAX_PARTICLES);
  private readonly tint = new Float32Array(MAX_PARTICLES);
  private readonly jitter = new Float32Array(MAX_PARTICLES);
  private readonly age = new Float32Array(MAX_PARTICLES);
  private readonly maxAge = new Float32Array(MAX_PARTICLES);
  private readonly buckets: Int32Array[] = Array.from({ length: BINS }, () => new Int32Array(MAX_PARTICLES));
  private readonly binCount = new Int32Array(BINS);
  private binInk: string[] = [];
  private binGlow: string[] = [];
  private binCore: string[] = [];
  private cols = 0;
  private rows = 0;
  private field = new Float32Array(0);
  private pointerX = 0;
  private pointerY = 0;
  private pointerActive = false;
  private pointerVX = 0;
  private pointerVY = 0;
  private randState = 1;
  private ready = false;
  private readonly onResize: () => void;
  private readonly onPointerDown: (e: PointerEvent) => void;
  private readonly onPointerMove: (e: PointerEvent) => void;
  private readonly onPointerUp: (e: PointerEvent) => void;

  constructor(
    private canvas: HTMLCanvasElement,
    private hooks: Hooks,
  ) {
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("无法创建画布");
    this.ctx = ctx;
    this.onResize = () => this.resize();
    this.onPointerDown = (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      this.placePointer(e, true);
    };
    this.onPointerMove = (e) => {
      if (!this.pointerActive && e.buttons === 0) return;
      this.placePointer(e, this.pointerActive);
    };
    this.onPointerUp = (e) => {
      this.pointerActive = false;
      this.pointerVX = 0;
      this.pointerVY = 0;
      if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    };
  }

  start(initial: FlowSettings) {
    this.applySettings(initial, true);
    this.resize();
    window.addEventListener("resize", this.onResize);
    this.canvas.addEventListener("pointerdown", this.onPointerDown);
    this.canvas.addEventListener("pointermove", this.onPointerMove);
    this.canvas.addEventListener("pointerup", this.onPointerUp);
    this.canvas.addEventListener("pointercancel", this.onPointerUp);
    this.running = true;
    this.last = 0;
    this.raf = requestAnimationFrame(this.loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
  }

  sync(settings: FlowSettings, exportRequest: number) {
    if (!this.ready) return;
    this.applySettings(settings, false);
    if (exportRequest !== this.exportRequest) {
      this.exportRequest = exportRequest;
      this.exportPng();
    }
  }

  private applySettings(settings: FlowSettings, immediate: boolean) {
    this.speed = settings.speed;
    this.trail = settings.trail;
    this.scale = settings.scale;
    this.paused = settings.paused;
    this.pointerOn = settings.pointer;
    if (!this.pointerOn) this.pointerActive = false;
    if (settings.paletteId !== this.palette.id) {
      this.palette = paletteById(settings.paletteId);
      this.buildBins();
      if (this.w > 0) this.fillGround(this.ready ? 0.45 : 1);
    }
    if (settings.seed !== this.seed) {
      if (immediate || this.seed < 0) this.commitSeed(settings.seed);
      else if (this.pendingSeed !== settings.seed) {
        this.pendingSeed = settings.seed;
        this.veil = 0;
      }
    }
  }

  private rand() {
    this.randState = (this.randState + 0x6d2b79f5) | 0;
    let t = Math.imul(this.randState ^ (this.randState >>> 15), 1 | this.randState);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private commitSeed(seed: number) {
    this.seed = seed;
    this.noise = makeNoise(seed);
    this.randState = seed || 1;
    this.z = (seed % 997) * 0.017;
    this.zSpeed = 0.04 + (seed % 5) * 0.008;
    this.orbit = ((seed >> 4) % 6) * 0.045;
    this.orbitSign = seed & 2 ? -1 : 1;
    this.freqMul = 0.82 + ((seed >> 8) % 6) * 0.07;
    this.pendingSeed = null;
    this.veil = 0;
    this.palette = paletteById(this.palette.id);
    this.buildBins();
    if (this.w > 0) {
      this.spawnAll();
      this.fillGround(1);
      this.warm();
    }
    this.ready = true;
  }

  private buildBins() {
    const ink: string[] = [];
    const glow: string[] = [];
    const core: string[] = [];
    for (let i = 0; i < BINS; i++) {
      const t = (i + 0.5) / BINS;
      const c = lerpColor(this.palette.stops, t);
      ink.push(rgbCss(c, 1));
      glow.push(rgbCss(scaleRgb(c, 0.72), 1));
      core.push(rgbCss(mixRgb(c, [255, 248, 240], 0.28), 1));
    }
    this.binInk = ink;
    this.binGlow = glow;
    this.binCore = core;
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === this.w && h === this.h && dpr === this.dpr && this.canvas.width > 0) return;
    this.w = w;
    this.h = h;
    this.dpr = dpr;
    this.canvas.width = Math.floor(w * dpr);
    this.canvas.height = Math.floor(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ensureGrid();
    const target = particleTarget(w, h);
    const grew = target > this.count;
    this.count = target;
    if (this.seed > 0) {
      if (grew || this.x[0] === 0) this.spawnAll();
      else this.wrapAll();
      this.fillGround(1);
      this.warm();
    }
  }

  private ensureGrid() {
    this.cols = Math.ceil(this.w / CELL) + 2;
    this.rows = Math.ceil(this.h / CELL) + 2;
    const need = this.cols * this.rows * 2;
    if (this.field.length < need) this.field = new Float32Array(need);
  }

  private spawnAll() {
    for (let i = 0; i < this.count; i++) this.respawn(i, true);
  }

  private wrapAll() {
    for (let i = 0; i < this.count; i++) {
      if (this.x[i]! < -20 || this.x[i]! > this.w + 20 || this.y[i]! < -20 || this.y[i]! > this.h + 20) {
        this.respawn(i, true);
      }
    }
  }

  private respawn(i: number, fresh: boolean) {
    const x = this.rand() * this.w;
    const y = this.rand() * this.h;
    this.x[i] = x;
    this.y[i] = y;
    this.px[i] = x;
    this.py[i] = y;
    const n = this.noise.noise3(x * 0.0017, y * 0.0017, this.seed * 0.001 + 4);
    const t = n * 0.5 + 0.5;
    this.tint[i] = t * t * (3 - 2 * t);
    this.jitter[i] = 0.78 + this.rand() * 0.48;
    this.age[i] = fresh ? this.rand() * 8 : 0;
    this.maxAge[i] = 14 + this.rand() * 18;
    this.vx[i] = 0;
    this.vy[i] = 0;
  }

  private freq() {
    return expLerp(0.00095, 0.0058, this.scale) * this.freqMul;
  }

  private potential(sx: number, sy: number, z: number) {
    let n = this.noise.noise3(sx, sy, z);
    n += 0.5 * this.noise.noise3(sx * 1.97 + 19.2, sy * 1.97 - 7.4, z * 0.82);
    return n;
  }

  private rebuildField() {
    const freq = this.freq();
    const z = this.z;
    const cols = this.cols;
    const rows = this.rows;
    const field = this.field;
    const eps = 0.16;
    const cx = this.w * 0.5;
    const cy = this.h * 0.5;
    const orbit = this.orbit;
    const sign = this.orbitSign;
    const usePointer = this.pointerOn && this.pointerActive;
    const px = this.pointerX;
    const py = this.pointerY;
    const pvx = this.pointerVX;
    const pvy = this.pointerVY;

    for (let gy = 0; gy < rows; gy++) {
      const y = (gy - 0.5) * CELL;
      for (let gx = 0; gx < cols; gx++) {
        const x = (gx - 0.5) * CELL;
        const sx = x * freq;
        const sy = y * freq;
        const dx = this.potential(sx + eps, sy, z) - this.potential(sx - eps, sy, z);
        const dy = this.potential(sx, sy + eps, z) - this.potential(sx, sy - eps, z);
        let vx = dy;
        let vy = -dx;
        let mag = Math.hypot(vx, vy);
        if (mag < 1e-5) {
          vx = 1;
          vy = 0;
          mag = 1;
        }
        vx /= mag;
        vy /= mag;
        if (orbit > 0) {
          const ox = x - cx;
          const oy = y - cy;
          const od = Math.hypot(ox, oy) || 1;
          const fall = 1 - Math.min(1, od / (Math.max(this.w, this.h) * 0.72));
          const amount = orbit * (0.35 + fall * 0.65);
          vx = vx * (1 - amount) + (-oy / od) * sign * amount;
          vy = vy * (1 - amount) + (ox / od) * sign * amount;
          const m2 = Math.hypot(vx, vy) || 1;
          vx /= m2;
          vy /= m2;
        }
        if (usePointer) {
          const ddx = x - px;
          const ddy = y - py;
          const d2 = ddx * ddx + ddy * ddy;
          const radius = 210;
          if (d2 < radius * radius) {
            const d = Math.sqrt(d2) || 1;
            const fall = (1 - d / radius) ** 2;
            vx += (-ddy / d) * fall * 1.8 + (pvx / 140) * fall;
            vy += (ddx / d) * fall * 1.8 + (pvy / 140) * fall;
            const m3 = Math.hypot(vx, vy) || 1;
            vx /= m3;
            vy /= m3;
          }
        }
        const i = (gy * cols + gx) * 2;
        field[i] = vx;
        field[i + 1] = vy;
      }
    }
  }

  private sample(x: number, y: number) {
    const gx = x / CELL + 0.5;
    const gy = y / CELL + 0.5;
    const x0 = Math.max(0, Math.min(this.cols - 2, Math.floor(gx)));
    const y0 = Math.max(0, Math.min(this.rows - 2, Math.floor(gy)));
    const tx = gx - x0;
    const ty = gy - y0;
    const cols = this.cols;
    const field = this.field;
    const i00 = (y0 * cols + x0) * 2;
    const i10 = i00 + 2;
    const i01 = i00 + cols * 2;
    const i11 = i01 + 2;
    const a = (1 - tx) * (1 - ty);
    const b = tx * (1 - ty);
    const c = (1 - tx) * ty;
    const d = tx * ty;
    return {
      vx: field[i00]! * a + field[i10]! * b + field[i01]! * c + field[i11]! * d,
      vy: field[i00 + 1]! * a + field[i10 + 1]! * b + field[i01 + 1]! * c + field[i11 + 1]! * d,
    };
  }

  private step(dt: number, rebuild = true) {
    this.z += dt * this.zSpeed;
    if (rebuild) this.rebuildField();
    const steer = 1 - Math.exp(-dt * 3.2);
    const pps = expLerp(28, 168, this.speed) * dt;
    const w = this.w;
    const h = this.h;
    const n = this.count;
    for (let i = 0; i < n; i++) {
      this.age[i] = this.age[i]! + dt;
      if (this.age[i]! > this.maxAge[i]!) {
        this.respawn(i, false);
        continue;
      }
      const s = this.sample(this.x[i]!, this.y[i]!);
      let vx = this.vx[i]! + (s.vx - this.vx[i]!) * steer;
      let vy = this.vy[i]! + (s.vy - this.vy[i]!) * steer;
      const mag = Math.hypot(vx, vy) || 1;
      vx /= mag;
      vy /= mag;
      this.vx[i] = vx;
      this.vy[i] = vy;
      const stepLen = pps * this.jitter[i]!;
      const nx = this.x[i]! + vx * stepLen;
      const ny = this.y[i]! + vy * stepLen;
      this.px[i] = this.x[i]!;
      this.py[i] = this.y[i]!;
      if (nx < -12 || nx > w + 12 || ny < -12 || ny > h + 12) {
        const wx = ((nx % w) + w) % w;
        const wy = ((ny % h) + h) % h;
        this.x[i] = wx;
        this.y[i] = wy;
        this.px[i] = wx;
        this.py[i] = wy;
      } else {
        this.x[i] = nx;
        this.y[i] = ny;
      }
    }
  }

  private fadeAmount() {
    const base = expLerp(0.2, 0.0065, this.trail);
    return Math.min(0.85, base + this.veil * 0.55);
  }

  private fillGround(alpha: number) {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = rgbCss(this.palette.ground, alpha);
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  private draw() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = rgbCss(this.palette.ground, this.fadeAmount());
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();

    const binCount = this.binCount;
    binCount.fill(0);
    const glow = this.palette.glow;
    const n = this.count;
    const buckets = this.buckets;
    const maxSeg = 64 * 64;
    for (let i = 0; i < n; i++) {
      const dx = this.x[i]! - this.px[i]!;
      const dy = this.y[i]! - this.py[i]!;
      const d2 = dx * dx + dy * dy;
      if (d2 < 0.04 || d2 > maxSeg) continue;
      let t = this.tint[i]!;
      if (glow) t += Math.sin(this.z * 1.4 + t * 14) * 0.045;
      const b = Math.max(0, Math.min(BINS - 1, Math.floor(t * BINS)));
      buckets[b]![binCount[b]!] = i;
      binCount[b]! += 1;
    }

    ctx.lineCap = "round";
    ctx.globalCompositeOperation = glow ? "lighter" : "source-over";
    const alpha = (glow ? 0.15 : 0.38) * (1 - this.trail * 0.5);
    const width = glow ? 2.4 : 1.15;
    const coreWidth = glow ? 0.85 : 1.15;

    for (let b = 0; b < BINS; b++) {
      const c = binCount[b]!;
      if (c === 0) continue;
      ctx.beginPath();
      const bucket = buckets[b]!;
      for (let k = 0; k < c; k++) {
        const i = bucket[k]!;
        ctx.moveTo(this.px[i]!, this.py[i]!);
        ctx.lineTo(this.x[i]!, this.y[i]!);
      }
      if (glow) {
        ctx.globalAlpha = alpha * 0.85;
        ctx.strokeStyle = this.binGlow[b]!;
        ctx.lineWidth = width;
        ctx.stroke();
        ctx.globalAlpha = alpha * 1.25;
        ctx.strokeStyle = this.binCore[b]!;
        ctx.lineWidth = coreWidth;
        ctx.stroke();
      } else {
        ctx.globalAlpha = alpha;
        ctx.strokeStyle = this.binInk[b]!;
        ctx.lineWidth = width;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  private warm() {
    const steps = 70;
    const dt = 1 / 60;
    const saved = this.trail;
    this.trail = Math.max(this.trail, 0.7);
    for (let i = 0; i < steps; i++) {
      this.step(dt, i % 4 === 0);
      if (i > 20 && i % 2 === 0) this.draw();
    }
    this.trail = saved;
  }

  private loop = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    if (this.w < 2 || this.h < 2) return;
    if (!this.last) this.last = now;
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt <= 0) return;
    if (document.hidden) return;

    if (this.pendingSeed != null) {
      this.veil = Math.min(1, this.veil + dt / 0.42);
      this.draw();
      if (this.veil >= 1) this.commitSeed(this.pendingSeed);
      return;
    }
    if (this.paused) return;
    this.step(dt);
    this.draw();
  };

  private placePointer(e: PointerEvent, active: boolean) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (this.pointerActive) {
      this.pointerVX = x - this.pointerX;
      this.pointerVY = y - this.pointerY;
    }
    this.pointerX = x;
    this.pointerY = y;
    this.pointerActive = active && this.pointerOn;
  }

  private exportPng() {
    try {
      const url = this.canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `liulan-${this.seed}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      this.hooks.onExported(true);
    } catch {
      this.hooks.onExported(false);
    }
  }
}

function particleTarget(w: number, h: number) {
  const target = Math.round((w * h) / 340);
  return Math.max(1400, Math.min(MAX_PARTICLES, target));
}

function scaleRgb(c: RGB, k: number): RGB {
  return [c[0] * k, c[1] * k, c[2] * k];
}

function mixRgb(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

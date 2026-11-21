import { create } from "zustand";
import { PALETTES } from "@/lib/flow/palettes";

const KEY = "liulan-flow-v1";

export type FlowSettings = {
  speed: number;
  trail: number;
  scale: number;
  paletteId: string;
  seed: number;
  paused: boolean;
  pointer: boolean;
  chrome: boolean;
};

type FlowState = FlowSettings & {
  notice: string;
  exportRequest: number;
  setSpeed: (n: number) => void;
  setTrail: (n: number) => void;
  setScale: (n: number) => void;
  setPalette: (id: string) => void;
  randomizeSeed: () => void;
  togglePaused: () => void;
  togglePointer: () => void;
  toggleChrome: () => void;
  setNotice: (s: string) => void;
  requestExport: () => void;
  hydrate: () => void;
};

export const DEFAULT_SETTINGS: FlowSettings = {
  speed: 0.46,
  trail: 0.76,
  scale: 0.36,
  paletteId: "tide",
  seed: 240813,
  paused: false,
  pointer: false,
  chrome: true,
};

function clamp01(n: unknown, fallback: number) {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : fallback;
}

function load(): Partial<FlowSettings> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Partial<FlowSettings>;
    const paletteId =
      typeof data.paletteId === "string" && PALETTES.some((p) => p.id === data.paletteId)
        ? data.paletteId
        : DEFAULT_SETTINGS.paletteId;
    const seed =
      typeof data.seed === "number" && Number.isFinite(data.seed)
        ? Math.floor(Math.abs(data.seed)) % 1000000 || DEFAULT_SETTINGS.seed
        : DEFAULT_SETTINGS.seed;
    return {
      speed: clamp01(data.speed, DEFAULT_SETTINGS.speed),
      trail: clamp01(data.trail, DEFAULT_SETTINGS.trail),
      scale: clamp01(data.scale, DEFAULT_SETTINGS.scale),
      paletteId,
      seed,
      pointer: typeof data.pointer === "boolean" ? data.pointer : DEFAULT_SETTINGS.pointer,
      chrome: typeof data.chrome === "boolean" ? data.chrome : DEFAULT_SETTINGS.chrome,
    };
  } catch {
    return {};
  }
}

export function randomSeed() {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0]! % 900000) + 100000;
}

export const useFlowStore = create<FlowState>((set) => ({
  ...DEFAULT_SETTINGS,
  notice: "",
  exportRequest: 0,
  setSpeed: (speed) => set({ speed: clamp01(speed, 0) }),
  setTrail: (trail) => set({ trail: clamp01(trail, 0) }),
  setScale: (scale) => set({ scale: clamp01(scale, 0) }),
  setPalette: (paletteId) => set({ paletteId }),
  randomizeSeed: () => set({ seed: randomSeed(), paused: false }),
  togglePaused: () => set((s) => ({ paused: !s.paused })),
  togglePointer: () => set((s) => ({ pointer: !s.pointer })),
  toggleChrome: () => set((s) => ({ chrome: !s.chrome })),
  setNotice: (notice) => set({ notice }),
  requestExport: () => set((s) => ({ exportRequest: s.exportRequest + 1 })),
  hydrate: () => {
    if (typeof window === "undefined") return;
    set(load());
  },
}));

export function persistFlowSettings(state: FlowState) {
  try {
    const payload: FlowSettings = {
      speed: state.speed,
      trail: state.trail,
      scale: state.scale,
      paletteId: state.paletteId,
      seed: state.seed,
      paused: false,
      pointer: state.pointer,
      chrome: state.chrome,
    };
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
}

import { ChevronDown, ChevronUp, Download, MousePointer2, Pause, Play, Shuffle } from "lucide-react";
import { hex, PALETTES } from "@/lib/flow/palettes";
import { useFlowStore } from "@/lib/flow/store";

export function ControlDock() {
  const speed = useFlowStore((s) => s.speed);
  const trail = useFlowStore((s) => s.trail);
  const scale = useFlowStore((s) => s.scale);
  const paletteId = useFlowStore((s) => s.paletteId);
  const seed = useFlowStore((s) => s.seed);
  const paused = useFlowStore((s) => s.paused);
  const pointer = useFlowStore((s) => s.pointer);
  const chrome = useFlowStore((s) => s.chrome);
  const notice = useFlowStore((s) => s.notice);
  const setSpeed = useFlowStore((s) => s.setSpeed);
  const setTrail = useFlowStore((s) => s.setTrail);
  const setScale = useFlowStore((s) => s.setScale);
  const setPalette = useFlowStore((s) => s.setPalette);
  const randomizeSeed = useFlowStore((s) => s.randomizeSeed);
  const togglePaused = useFlowStore((s) => s.togglePaused);
  const togglePointer = useFlowStore((s) => s.togglePointer);
  const toggleChrome = useFlowStore((s) => s.toggleChrome);
  const requestExport = useFlowStore((s) => s.requestExport);

  const palette = PALETTES.find((p) => p.id === paletteId) ?? PALETTES[1]!;

  if (!chrome) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          className="pointer-events-auto inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-medium text-fg shadow-none"
          onClick={toggleChrome}
        >
          <ChevronUp className="size-4" aria-hidden="true" />
          显示控制
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-6">
      <section
        className="pointer-events-auto dock-shadow w-full max-w-3xl rounded-xl border border-border bg-surface/95 p-4 text-fg"
        aria-label="流场控制"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-display text-lg leading-tight tracking-display">流澜</h1>
            <p className="mt-1 text-xs tracking-label text-muted">FLOW FIELD</p>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-right text-xs text-muted">
              <span className="block tracking-label">种子</span>
              <span className="mt-0.5 block font-medium text-fg tabular-nums">{seed}</span>
            </p>
            <button
              type="button"
              className="grid size-11 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
              onClick={toggleChrome}
              aria-label="隐藏控制"
            >
              <ChevronDown className="size-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        <div className="mb-4 flex flex-wrap items-center gap-1" role="radiogroup" aria-label="配色方案">
          {PALETTES.map((item) => {
            const active = item.id === palette.id;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={item.name}
                title={item.name}
                className="grid size-11 place-items-center rounded-full"
                onClick={() => setPalette(item.id)}
              >
                <span
                  className={
                    active
                      ? "size-5 rounded-full ring-2 ring-fg ring-offset-2 ring-offset-surface"
                      : "size-5 rounded-full ring-1 ring-border"
                  }
                  style={{
                    background: `linear-gradient(140deg, ${item.stops.map((c) => hex(c)).join(", ")})`,
                  }}
                />
              </button>
            );
          })}
          <span className="ml-1 text-sm text-muted">{palette.name}</span>
          {paused ? <span className="text-sm text-fg">已暂停</span> : null}
          {notice ? <span className="text-sm text-fg">{notice}</span> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          <Slider label="速度" value={speed} onChange={setSpeed} />
          <Slider label="轨迹" value={trail} onChange={setTrail} />
          <Slider label="尺度" value={scale} onChange={setScale} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
            onClick={randomizeSeed}
          >
            <Shuffle className="size-4" aria-hidden="true" />
            新种子
          </button>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface-2 px-4 text-sm font-medium text-fg"
            onClick={togglePaused}
            aria-pressed={paused}
          >
            {paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
            {paused ? "继续" : "暂停"}
          </button>
          <button
            type="button"
            className="inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface-2 px-4 text-sm font-medium text-fg"
            onClick={requestExport}
          >
            <Download className="size-4" aria-hidden="true" />
            导出
          </button>
          <button
            type="button"
            className={
              pointer
                ? "inline-flex h-11 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
                : "inline-flex h-11 items-center gap-2 rounded-md border border-border bg-surface-2 px-4 text-sm font-medium text-fg"
            }
            onClick={togglePointer}
            aria-pressed={pointer}
          >
            <MousePointer2 className="size-4" aria-hidden="true" />
            指针
          </button>
        </div>
        <p className="mt-3 hidden text-xs text-subtle sm:block">空格暂停 · N 新种子 · E 导出 · H 隐藏控制</p>
        {pointer ? <p className="mt-2 text-xs text-muted">在画面上拖动，搅动附近的流。</p> : null}
      </section>
    </div>
  );
}

function Slider({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="grid gap-2 py-1">
      <span className="text-xs text-muted">{label}</span>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(value * 1000)}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value) / 1000)}
      />
    </label>
  );
}

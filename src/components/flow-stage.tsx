import { useEffect, useRef } from "react";
import { FlowEngine } from "@/lib/flow/engine";
import { paletteById } from "@/lib/flow/palettes";
import { persistFlowSettings, useFlowStore } from "@/lib/flow/store";
import { ControlDock } from "@/components/control-dock";

export function FlowStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paletteId = useFlowStore((s) => s.paletteId);
  const ground = paletteById(paletteId).ground;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const store = useFlowStore;
    store.getState().hydrate();
    let noticeTimer = 0;
    const engine = new FlowEngine(canvas, {
      onExported: (ok) => {
        store.getState().setNotice(ok ? "已导出 PNG" : "导出失败");
        window.clearTimeout(noticeTimer);
        noticeTimer = window.setTimeout(() => store.getState().setNotice(""), 2200);
      },
    });
    const snap = store.getState();
    engine.start(snap);
    engine.sync(snap, snap.exportRequest);
    const unsub = store.subscribe((state) => {
      engine.sync(state, state.exportRequest);
      persistFlowSettings(state);
    });
    const onKey = (e: KeyboardEvent) => {
      const target = e.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
      if (e.repeat) return;
      if (e.code === "Space") {
        e.preventDefault();
        store.getState().togglePaused();
      } else if (e.code === "KeyN") {
        store.getState().randomizeSeed();
      } else if (e.code === "KeyE") {
        store.getState().requestExport();
      } else if (e.code === "KeyH") {
        store.getState().toggleChrome();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(noticeTimer);
      unsub();
      window.removeEventListener("keydown", onKey);
      engine.stop();
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-bg text-fg">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        style={{ backgroundColor: `rgb(${ground[0]}, ${ground[1]}, ${ground[2]})` }}
        aria-label="流场画布"
      />
      <ControlDock />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { getSoundSettings, setSoundSettings } from "@/lib/sound";

export function SoundControl() {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState(getSoundSettings());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  function update(next: Partial<typeof s>) {
    const merged = { ...s, ...next };
    setS(merged);
    setSoundSettings(merged);
  }

  const icon = s.muted && s.musicMuted ? "🔇" : "🔊";

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="px-1.5 py-1 rounded-lg text-white text-sm hover:bg-white/15 transition"
        title="Som"
      >
        {icon}
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl bg-purple-950/95 border-2 border-purple-400/50 shadow-2xl p-3 text-white space-y-3">
          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span>🔊 Efeitos</span>
              <button
                onClick={() => update({ muted: !s.muted })}
                className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${s.muted ? "bg-red-500" : "bg-green-500"}`}
              >
                {s.muted ? "OFF" : "ON"}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.volume}
              onChange={(e) => update({ volume: parseFloat(e.target.value) })}
              className="w-full accent-yellow-400"
            />
          </div>
          <div>
            <div className="flex items-center justify-between text-xs font-bold mb-1">
              <span>🎵 Música</span>
              <button
                onClick={() => update({ musicMuted: !s.musicMuted })}
                className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${s.musicMuted ? "bg-red-500" : "bg-green-500"}`}
              >
                {s.musicMuted ? "OFF" : "ON"}
              </button>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.musicVolume}
              onChange={(e) => update({ musicVolume: parseFloat(e.target.value) })}
              className="w-full accent-yellow-400"
            />
          </div>
        </div>
      )}
    </div>
  );
}

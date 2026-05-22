import { useEffect, useState } from "react";
import { SPECIES, ELEMENT_COLORS, RARITY_INFO } from "@/lib/game-data";

type Props = {
  hatching: boolean;
  reveal: string[] | null;
  onOpen: () => void;
  onDone: () => void;
};

export function WelcomeChestModal({ hatching, reveal, onOpen, onDone }: Props) {
  // Fases: "intro" -> "shaking" (durante hatching) -> "exploded" -> revela pets 1 a 1
  const [phase, setPhase] = useState<"intro" | "shaking" | "exploded">("intro");
  const [revealed, setRevealed] = useState(0);

  // Quando o usuário clica em Abrir
  function handleOpen() {
    if (phase !== "intro") return;
    setPhase("shaking");
    onOpen();
  }

  // Quando o reveal chega do backend, mostra explosão e revela os pets em sequência
  useEffect(() => {
    if (!reveal) return;
    setPhase("exploded");
    setRevealed(0);
    const timers: ReturnType<typeof setTimeout>[] = [];
    reveal.forEach((_, idx) => {
      timers.push(setTimeout(() => setRevealed((r) => Math.max(r, idx + 1)), 700 + idx * 900));
    });
    return () => timers.forEach(clearTimeout);
  }, [reveal]);

  const allRevealed = reveal && revealed >= reveal.length;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in overflow-hidden">
      {/* raios de luz quando o baú abre */}
      {phase === "exploded" && (
        <div
          className="absolute inset-0 opacity-60 pointer-events-none animate-spin"
          style={{
            background:
              "conic-gradient(from 0deg, transparent 0deg, rgba(255,215,100,0.45) 8deg, transparent 16deg, transparent 30deg, rgba(255,215,100,0.45) 38deg, transparent 46deg, transparent 60deg, rgba(255,215,100,0.45) 68deg, transparent 76deg, transparent 90deg, rgba(255,215,100,0.45) 98deg, transparent 106deg, transparent 360deg)",
            animationDuration: "16s",
          }}
        />
      )}

      <div className="relative max-w-2xl w-full rounded-3xl bg-gradient-to-br from-purple-900 via-fuchsia-900 to-amber-900 border-4 border-yellow-300 shadow-2xl p-6 text-center text-white animate-in zoom-in">
        {phase !== "exploded" ? (
          <>
            <div
              className={`text-[120px] leading-none mb-2 inline-block drop-shadow-2xl ${
                phase === "shaking" ? "animate-bounce" : "animate-pulse"
              }`}
              style={{
                animationDuration: phase === "shaking" ? "0.25s" : "1.5s",
                filter: phase === "shaking"
                  ? "drop-shadow(0 0 30px rgba(253,224,71,1))"
                  : "drop-shadow(0 0 14px rgba(253,224,71,0.6))",
                transform: phase === "shaking" ? "rotate(-4deg)" : "none",
              }}
            >
              🎁
            </div>
            <h2 className="text-3xl font-black drop-shadow-lg">
              {phase === "shaking" ? "Abrindo seu baú..." : "Baú de Boas-Vindas!"}
            </h2>
            <p className="text-white/90 mt-2 text-sm">
              Bem-vindo à <b>ARENA PET</b>! Abra seu baú de cadastro e ganhe<br />
              <b>2 bichinhos comuns</b> + <b>1 raro</b> totalmente aleatórios.
            </p>
            <button
              onClick={handleOpen}
              disabled={hatching || phase === "shaking"}
              className="mt-5 px-8 py-4 rounded-2xl bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-600 text-yellow-950 font-black text-xl shadow-2xl hover:scale-105 transition disabled:opacity-60 disabled:cursor-wait border-4 border-yellow-200"
            >
              {phase === "shaking" ? "✨ Abrindo..." : "🎁 Abrir Baú"}
            </button>
            <p className="text-[11px] opacity-70 mt-3">⚠️ Apenas 1 baú por conta</p>
          </>
        ) : (
          <>
            <div className="text-5xl mb-1 animate-bounce">✨🎉✨</div>
            <div className="text-xs font-extrabold tracking-[0.3em] text-yellow-200 opacity-90">VOCÊ GANHOU</div>
            <h2 className="text-2xl font-black drop-shadow-lg mt-1">Seus 3 primeiros pets!</h2>

            <div className="grid grid-cols-3 gap-3 mt-4 min-h-[180px]">
              {reveal!.map((id, idx) => {
                const sp = SPECIES[id];
                const shown = revealed > idx;
                return (
                  <div
                    key={id + idx}
                    className={`rounded-2xl overflow-hidden border-2 transition-all duration-500 ${
                      shown
                        ? `border-white/40 bg-gradient-to-br ${ELEMENT_COLORS[sp.element]} shadow-2xl scale-100 opacity-100`
                        : "border-white/10 bg-black/40 scale-75 opacity-30"
                    }`}
                    style={{
                      transform: shown ? "scale(1) rotate(0deg)" : "scale(0.7) rotate(-8deg)",
                      filter: shown ? "drop-shadow(0 0 20px rgba(253,224,71,0.6))" : "none",
                    }}
                  >
                    <div className="aspect-square flex items-center justify-center p-2 relative">
                      {shown ? (
                        <img
                          src={sp.image}
                          alt={sp.name}
                          className="h-full w-auto drop-shadow-2xl animate-in zoom-in duration-500"
                        />
                      ) : (
                        <span className="text-4xl opacity-70 animate-pulse">❓</span>
                      )}
                    </div>
                    <div className="bg-card/95 p-2 text-center">
                      {shown ? (
                        <>
                          <div className="font-extrabold text-xs truncate text-foreground">
                            {sp.emoji} {sp.name}
                          </div>
                          <span
                            className={`inline-block mt-1 px-1.5 py-0.5 rounded-full ${RARITY_INFO[sp.rarity].color} text-[9px] font-extrabold`}
                          >
                            {RARITY_INFO[sp.rarity].emoji} {RARITY_INFO[sp.rarity].name}
                          </span>
                        </>
                      ) : (
                        <div className="h-6" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={onDone}
              disabled={!allRevealed}
              className="mt-5 px-6 py-3 rounded-xl bg-yellow-300 text-yellow-950 font-extrabold hover:bg-yellow-200 transition shadow-lg disabled:opacity-50 disabled:cursor-wait"
            >
              {allRevealed ? "Vamos lá! 🚀" : "Revelando..."}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

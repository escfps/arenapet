import { useEffect, useState } from "react";

type Props = {
  badgeEmoji: string;
  typeName: string;
  typeColor: string;
  typeEmoji: string;
  becameLeader: boolean;
  onClose: () => void;
};

/**
 * Animação celebrativa exibida quando o jogador conquista a insígnia de um ginásio.
 */
export function BadgeCelebration({
  badgeEmoji,
  typeName,
  typeColor,
  typeEmoji,
  becameLeader,
  onClose,
}: Props) {
  const [reveal, setReveal] = useState(false);
  const [burst, setBurst] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setReveal(true), 400);
    const t2 = setTimeout(() => setBurst(true), 700);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4 overflow-y-auto">
      {/* fundo com brilho do tipo */}
      <div className={`absolute inset-0 bg-gradient-to-b from-black/90 via-black/80 to-black/90 backdrop-blur-md`} />
      <div
        className="absolute inset-0 opacity-40 animate-spin"
        style={{
          background:
            "conic-gradient(from 0deg, transparent 0deg, rgba(253,224,71,0.5) 8deg, transparent 16deg, transparent 30deg, rgba(253,224,71,0.5) 38deg, transparent 46deg, transparent 60deg, rgba(253,224,71,0.5) 68deg, transparent 76deg, transparent 90deg, rgba(253,224,71,0.5) 98deg, transparent 106deg, transparent 360deg)",
          animationDuration: "16s",
        }}
      />

      {/* confetes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 28 }).map((_, i) => (
          <span
            key={i}
            className="absolute block w-2 h-3 rounded-sm animate-bounce"
            style={{
              left: `${(i * 3.7) % 100}%`,
              top: `${(i * 5.3) % 88}%`,
              background: ["#fde047", "#f59e0b", "#fff", "#facc15", "#fb923c", "#fbbf24"][i % 6],
              animationDelay: `${(i % 9) * 0.12}s`,
              animationDuration: `${1.1 + (i % 5) * 0.22}s`,
              transform: `rotate(${(i * 41) % 360}deg)`,
            }}
          />
        ))}
      </div>

      <div className="relative w-full max-w-sm rounded-3xl bg-gradient-to-b from-amber-50 to-yellow-100 border-4 border-yellow-300 shadow-2xl p-6 text-center animate-scale-in">
        {/* Insígnia central com brilho */}
        <div className="relative flex justify-center my-4">
          <div
            className={`text-[120px] leading-none transition-all duration-700 ${
              reveal ? "scale-100" : "scale-0 rotate-180"
            }`}
            style={{
              filter: reveal
                ? "drop-shadow(0 0 32px rgba(253,224,71,0.95)) drop-shadow(0 0 12px rgba(251,191,36,0.7))"
                : "none",
            }}
          >
            {badgeEmoji}
          </div>

          {/* burst rings */}
          {burst && (
            <>
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-4 border-yellow-300/70 animate-[ping_1.4s_ease-out]" />
              <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border-4 border-amber-400/50 animate-[ping_1.8s_ease-out]" />
            </>
          )}

          {/* sparkles ao redor */}
          {burst &&
            Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const r = 70;
              const x = Math.cos(angle) * r;
              const y = Math.sin(angle) * r;
              return (
                <span
                  key={i}
                  className="absolute top-1/2 left-1/2 text-2xl animate-bounce"
                  style={{
                    transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                    animationDelay: `${i * 0.08}s`,
                  }}
                >
                  ✨
                </span>
              );
            })}
        </div>

        {reveal && (
          <div className="animate-fade-in">
            <div className="text-xs font-extrabold tracking-[0.3em] text-amber-700">
              INSÍGNIA CONQUISTADA
            </div>
            <div className="text-3xl font-black text-amber-900 leading-tight mt-1">
              {typeEmoji} {typeName}
            </div>

            {becameLeader ? (
              <div className="mt-3 rounded-2xl bg-gradient-to-r from-yellow-400 to-amber-500 border-2 border-yellow-300 p-3 animate-scale-in">
                <div className="text-4xl">👑</div>
                <div className="text-lg font-black text-yellow-950 leading-tight">
                  VOCÊ É O NOVO LÍDER!
                </div>
                <div className="text-xs font-bold text-yellow-900 mt-0.5">
                  Receba 💎 50 a cada 24h enquanto defender o ginásio.
                </div>
              </div>
            ) : (
              <div className="mt-3 text-sm font-bold text-amber-800">
                Continue conquistando insígnias para desafiar ginásios avançados! 🎖️
              </div>
            )}

            <button
              onClick={onClose}
              className="mt-5 w-full px-5 py-3 rounded-xl bg-gradient-to-b from-amber-500 to-orange-600 text-white font-black tracking-wider border-2 border-yellow-300 shadow-lg hover:scale-[1.02] transition"
            >
              RECEBER E CONTINUAR
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

type Step = {
  emoji: string;
  title: string;
  body: string;
  goTo?: string;
  goLabel?: string;
};

const STEPS: Step[] = [
  {
    emoji: "🎉",
    title: "Bem-vindo à ARENA PET!",
    body: "Você acabou de ganhar seus 3 primeiros bichinhos. Bora dar um tour rápido pra você não se perder no jogo.",
  },
  {
    emoji: "🏠",
    title: "Pátio (sua casa)",
    body: "Aqui você vê todos os seus pets, alimenta, dá energia e monta seu TIME de 3 pets pra batalhar. Use os 3 slots no topo (Frente, Meio, Trás) pra escolher a posição de cada um.",
  },
  {
    emoji: "💪",
    title: "Treinar pets — DEIXA ELES FORTES!",
    body: "Clique em qualquer pet no Pátio pra abrir os detalhes. Lá tem a aba TREINAR onde você gasta moedas + energia pra aumentar ATK, DEF, SPD, HP e INT PERMANENTEMENTE. É a forma principal de evoluir seus bichinhos — treine bastante antes de cada batalha!",
  },
  {
    emoji: "⚔️",
    title: "Arena — onde rola a batalha",
    body: "Na aba ARENA você procura adversários e luta automaticamente. Vencer dá moedas, XP e pontos de rank. Cada batalha gasta energia do pet.",
    goTo: "/arena",
    goLabel: "Ver Arena",
  },
  {
    emoji: "🏆",
    title: "Ranking",
    body: "Veja os melhores treinadores do servidor. Suba seus pontos de arena pra escalar tiers (Bronze, Prata, Ouro, Platina...) e aparecer no topo.",
    goTo: "/ranking",
    goLabel: "Ver Ranking",
  },
  {
    emoji: "🔨",
    title: "Forja — upa suas cartas",
    body: "Na FORJA você evolui seus pets de rank. Quanto maior o rank, mais fortes ficam HP, ATK, DEF e SPD. Custa moedas e materiais.",
    goTo: "/forge",
    goLabel: "Ver Forja",
  },
  {
    emoji: "🛒",
    title: "Loja — onde compra baús",
    body: "Na LOJA você compra ovos (baús) com moedas 🪙 ou gemas 💎. Ovo Comum sai por moedas, Ovo Raro/Épico precisa de gemas e tem chance de pets raros, lendários e até míticos!",
    goTo: "/shop",
    goLabel: "Ver Loja",
  },
  {
    emoji: "🗺️",
    title: "Expedições",
    body: "Mande um pet em expedição: ele fica fora por um tempo e volta com moedas, XP e itens. Ótimo pra ganhar recursos sem batalhar.",
    goTo: "/expeditions",
    goLabel: "Ver Expedições",
  },
  {
    emoji: "📖",
    title: "Coleção",
    body: "Veja o catálogo completo de pets do jogo e quais você já tem. Bom pra saber o que ainda falta.",
    goTo: "/collection",
    goLabel: "Ver Coleção",
  },
  {
    emoji: "🔄",
    title: "Trocas",
    body: "Troque pets com outros jogadores. Bom pra completar a coleção ou se livrar de duplicatas.",
    goTo: "/trade",
    goLabel: "Ver Trocas",
  },
  {
    emoji: "🚀",
    title: "Pronto pra jogar!",
    body: "Dica: comece colocando seus 3 melhores pets no time, vá pra Arena e ganhe moedas pra comprar baús na Loja. Boa sorte, treinador!",
  },
];

export function TutorialOverlay({ userId, onClose }: { userId: string; onClose: () => void }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function finish() {
    localStorage.setItem(`tutorial_done_${userId}`, "1");
    onClose();
  }

  function skip() {
    localStorage.setItem(`tutorial_done_${userId}`, "1");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="max-w-lg w-full rounded-3xl bg-gradient-to-br from-indigo-900 via-purple-900 to-fuchsia-900 border-4 border-yellow-300 shadow-2xl p-6 text-white animate-in zoom-in">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold opacity-80">
            Passo {step + 1} de {STEPS.length}
          </span>
          <button
            onClick={skip}
            className="text-xs px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 transition"
          >
            Pular tutorial
          </button>
        </div>

        {/* progress bar */}
        <div className="h-1.5 w-full bg-white/15 rounded-full overflow-hidden mb-5">
          <div
            className="h-full bg-gradient-to-r from-yellow-300 to-amber-400 transition-all"
            style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
          />
        </div>

        <div className="text-center">
          <div className="text-6xl mb-2 animate-bounce">{s.emoji}</div>
          <h2 className="text-2xl font-black drop-shadow-lg">{s.title}</h2>
          <p className="text-white/90 mt-3 text-sm leading-relaxed">{s.body}</p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => setStep((p) => Math.max(0, p - 1))}
            disabled={step === 0}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            ← Voltar
          </button>

          <div className="flex gap-2">
            {s.goTo && (
              <button
                onClick={() => {
                  finish();
                  navigate({ to: s.goTo! });
                }}
                className="px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 font-bold text-sm transition border border-white/30"
              >
                {s.goLabel ?? "Ir agora"}
              </button>
            )}
            {isLast ? (
              <button
                onClick={finish}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-b from-yellow-300 to-amber-500 text-yellow-950 font-extrabold text-sm shadow-lg hover:scale-105 transition"
              >
                Começar a jogar 🚀
              </button>
            ) : (
              <button
                onClick={() => setStep((p) => Math.min(STEPS.length - 1, p + 1))}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-b from-yellow-300 to-amber-500 text-yellow-950 font-extrabold text-sm shadow-lg hover:scale-105 transition"
              >
                Próximo →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";

type Step = {
  emoji: string;
  title: string;
  body: string;
  hint?: string; // dica destacada do "o que clicar" quando chegar lá
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
    body: "Clique em qualquer pet pra abrir os detalhes, vai na aba TREINAR e gaste moedas + energia pra aumentar ATK, DEF, SPD, HP e INT permanentemente.",
    hint: "👉 Quando chegar lá, clique no botão verde 💪 UP em qualquer pet — depois na aba 💪 Treinar e escolha um atributo (ex.: ATK).",
    goTo: "/",
    goLabel: "💪 Treinar um pet agora",
  },
  {
    emoji: "⚔️",
    title: "Arena — onde rola a batalha",
    body: "Na ARENA você procura adversários e luta automaticamente. Vencer dá moedas, XP e pontos de rank. Cada batalha gasta energia do pet.",
    hint: "👉 Lá dentro, clique no botão 🎯 Buscar oponente pra iniciar sua primeira batalha.",
    goTo: "/arena",
    goLabel: "⚔️ Ir pra Arena agora",
  },
  {
    emoji: "🏆",
    title: "Ranking",
    body: "Veja os melhores treinadores do servidor. Suba seus pontos de arena pra escalar tiers (Bronze, Prata, Ouro, Platina...) e aparecer no topo.",
    goTo: "/ranking",
    goLabel: "🏆 Ver o Ranking",
  },
  {
    emoji: "⭐",
    title: "Elevar — upa suas cartas",
    body: "Em ELEVAR você evolui seus pets de rank (⭐). Quanto maior o rank, mais fortes ficam HP, ATK, DEF e SPD. Custa moedas e materiais.",
    goTo: "/forge",
    goLabel: "⭐ Ver Elevar",
  },
  {
    emoji: "🛒",
    title: "Loja — onde compra baús",
    body: "Na LOJA você compra ovos (baús) com moedas 🪙 ou gemas 💎. Ovo Comum sai por moedas, Ovo Raro/Épico precisa de gemas e tem chance de pets raros, lendários e até míticos!",
    hint: "👉 Lá dentro, toque em um baú e depois em ABRIR pra ver o que vem dentro.",
    goTo: "/shop",
    goLabel: "🛒 Ir pra Loja",
  },
  {
    emoji: "🗺️",
    title: "Expedições",
    body: "Mande um pet em expedição: ele fica fora por um tempo e volta com moedas, XP e itens. Ótimo pra ganhar recursos sem batalhar.",
    goTo: "/expeditions",
    goLabel: "🗺️ Ver Expedições",
  },
  {
    emoji: "📖",
    title: "Coleção",
    body: "Veja o catálogo completo de pets do jogo e quais você já tem. Bom pra saber o que ainda falta.",
    goTo: "/collection",
    goLabel: "📖 Ver Coleção",
  },
  {
    emoji: "🔄",
    title: "Trocas",
    body: "Troque pets com outros jogadores. Bom pra completar a coleção ou se livrar de duplicatas.",
    goTo: "/trade",
    goLabel: "🔄 Ver Trocas",
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

          {s.hint && (
            <div className="mt-3 rounded-xl border-2 border-yellow-300/70 bg-yellow-300/10 p-3 text-left text-[12px] leading-snug font-bold text-yellow-100 animate-pulse">
              {s.hint}
            </div>
          )}

          {s.goTo && (
            <button
              onClick={() => {
                finish();
                navigate({ to: s.goTo! });
              }}
              className="mt-4 w-full px-5 py-3 rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-white font-black text-base shadow-lg border-2 border-emerald-200 hover:scale-[1.02] transition"
            >
              {s.goLabel ?? "Ir agora"}
            </button>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <button
            onClick={() => setStep((p) => Math.max(0, p - 1))}
            disabled={step === 0}
            className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 font-bold text-sm disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            ← Voltar
          </button>

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
              {s.goTo ? "Pular esse →" : "Próximo →"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

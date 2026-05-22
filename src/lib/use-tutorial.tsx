import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type TutorialStep = {
  id: string;
  /** CSS selector pra encontrar o elemento alvo. Vazio = sem spotlight (modal centralizado) */
  target: string;
  title: string;
  body: string;
  /** Como esse passo avança */
  advance: "click" | "event" | "manual";
  /** Nome do evento custom que dispara o avanço (quando advance = "event") */
  eventName?: string;
  /** Rota onde o passo precisa rolar. Se diferente, mostra CTA pra navegar. */
  requiredRoute?: string | RegExp;
  /** Texto do botão "ir pra rota" quando estiver na rota errada */
  goLabel?: string;
};

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "team",
    target: '[data-tutorial="team-slot"]',
    title: "1/9 — Monte seu time",
    body:
      "Toque em qualquer slot pra trocar/posicionar seus pets.\n\n🛡️ Frente = tanques (absorvem dano)\n⚔️ Meio = DPS e suporte\n🏹 Trás = magos e healers",
    advance: "click",
    requiredRoute: "/",
    goLabel: "🏠 Ir pro Pátio",
  },
  {
    id: "train",
    target: '[data-tutorial="train-pet"]',
    title: "2/9 — Treine um pet",
    body:
      "Treinar deixa seus pets MUITO mais fortes! Toque no botão 💪 UP de qualquer pet pra abrir a tela de treino.",
    advance: "click",
    requiredRoute: "/",
    goLabel: "🏠 Voltar ao Pátio",
  },
  {
    id: "train-stat",
    target: '[data-tutorial="train-stat"]',
    title: "3/9 — Suba um atributo",
    body:
      "Toque em qualquer botão de Treinar (ATK, DEF, SPD, HP ou INT) pra gastar moedas e melhorar o seu pet. Você precisa fazer pelo menos UM treino pra continuar!",
    advance: "event",
    eventName: "tutorial:trained",
    requiredRoute: /^\/monster\//,
    goLabel: "💪 Voltar pra tela de treino",
  },
  {
    id: "arena-nav",
    target: '[data-tutorial-nav="/arena"]',
    title: "4/9 — Hora da batalha!",
    body: "Toque em ⚔️ Arena pra ir lutar contra outros treinadores.",
    advance: "click",
  },
  {
    id: "battle",
    target: '[data-tutorial="find-opponent"]',
    title: "5/9 — Sua primeira luta",
    body:
      "Toque em 🎯 Buscar oponente, depois em ⚔️ BATALHAR! pra fazer sua primeira batalha. Eu te espero aqui!",
    advance: "event",
    eventName: "tutorial:battle-finished",
    requiredRoute: "/arena",
    goLabel: "⚔️ Ir pra Arena",
  },
  {
    id: "ranking-nav",
    target: '[data-tutorial-nav="/ranking"]',
    title: "6/9 — Veja o Ranking",
    body: "Toque em 📊 Ranking pra ver onde você está entre os melhores treinadores.",
    advance: "click",
  },
  {
    id: "collection-nav",
    target: '[data-tutorial-nav="/collection"]',
    title: "7/9 — Sua Coleção",
    body: "Toque em 🎒 Coleção pra ver todos os pets do jogo e quais você já tem.",
    advance: "click",
  },
  {
    id: "open-menu",
    target: '[data-tutorial="open-menu"]',
    title: "8/9 — Abra o menu",
    body: "A Loja fica no menu lateral. Toque no ícone ☰ no canto superior esquerdo pra abrir o menu.",
    advance: "click",
  },
  {
    id: "shop-nav",
    target: '[data-tutorial-nav="/shop"]',
    title: "9/9 — A Loja de Baús",
    body: "Toque em 🏪 Loja pra comprar ovos (baús) e tentar conseguir pets raros, lendários e até míticos!",
    advance: "click",
  },
  {
    id: "reward",
    target: "",
    title: "🎉 Tutorial concluído!",
    body:
      "Você aprendeu o essencial! Como recompensa, ganhou um 🥈 Baú de Prata totalmente grátis. Boa sorte na arena, treinador!",
    advance: "manual",
  },
];

type TutorialState = {
  active: boolean;
  step: number;
  /** Avança um passo. Se already past último, finaliza. */
  next: () => void;
  /** Inicia o tutorial do começo */
  start: () => void;
  /** Cancela o tutorial */
  skip: () => void;
  /** Termina o tutorial (chamado quando reward é entregue) */
  finish: () => void;
  current: TutorialStep | null;
};

const Ctx = createContext<TutorialState | null>(null);

function storageKey(userId: string | null) {
  return userId ? `tutorial_v2_${userId}` : null;
}

export function TutorialProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);

  // Hidrata do localStorage quando userId aparece
  useEffect(() => {
    if (!userId) {
      setActive(false);
      setStep(0);
      return;
    }
    const key = storageKey(userId)!;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as { active: boolean; step: number };
        setActive(!!parsed.active);
        setStep(Math.max(0, Math.min(TUTORIAL_STEPS.length - 1, parsed.step | 0)));
      }
    } catch { /* ignore */ }
  }, [userId]);

  // Persiste
  useEffect(() => {
    if (!userId) return;
    const key = storageKey(userId)!;
    try { localStorage.setItem(key, JSON.stringify({ active, step })); } catch { /* ignore */ }
  }, [userId, active, step]);

  const start = useCallback(() => {
    setStep(0);
    setActive(true);
  }, []);

  const next = useCallback(() => {
    setStep((s) => Math.min(TUTORIAL_STEPS.length - 1, s + 1));
  }, []);

  const skip = useCallback(() => {
    setActive(false);
  }, []);

  const finish = useCallback(() => {
    setActive(false);
    setStep(0);
    if (userId) {
      try { localStorage.setItem(storageKey(userId)!, JSON.stringify({ active: false, step: TUTORIAL_STEPS.length })); } catch { /* */ }
    }
  }, [userId]);

  const value = useMemo<TutorialState>(() => ({
    active,
    step,
    next,
    start,
    skip,
    finish,
    current: active ? TUTORIAL_STEPS[step] ?? null : null,
  }), [active, step, next, start, skip, finish]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTutorial() {
  const v = useContext(Ctx);
  if (!v) {
    // Fallback no-op pra evitar crash em testes/SSR
    return {
      active: false,
      step: 0,
      next: () => {},
      start: () => {},
      skip: () => {},
      finish: () => {},
      current: null as TutorialStep | null,
    };
  }
  return v;
}

/** Hook utilitário pra disparar avanço quando uma condição (ex.: batalha finalizada) acontece */
export function dispatchTutorialEvent(eventName: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(eventName));
}

/** Util pra detectar o rect de um elemento via selector, atualizando em layout changes */
export function useElementRect(selector: string, deps: unknown[] = []): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!selector || typeof window === "undefined") {
      setRect(null);
      return;
    }
    let cancelled = false;

    function measure() {
      if (cancelled) return;
      const el = document.querySelector(selector);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect((prev) => {
          if (
            prev &&
            Math.abs(prev.x - r.x) < 0.5 &&
            Math.abs(prev.y - r.y) < 0.5 &&
            Math.abs(prev.width - r.width) < 0.5 &&
            Math.abs(prev.height - r.height) < 0.5
          ) return prev;
          return r;
        });
      } else {
        setRect(null);
      }
      rafRef.current = window.setTimeout(measure, 200) as unknown as number;
    }
    measure();

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelled = true;
      if (rafRef.current) clearTimeout(rafRef.current);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selector, ...deps]);

  return rect;
}

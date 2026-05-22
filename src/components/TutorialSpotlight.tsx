import { useEffect, useRef, useState } from "react";
import { useRouterState, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useTutorial, useElementRect, TUTORIAL_STEPS } from "@/lib/use-tutorial";
import { ChestRewardPopup, type PendingChest } from "@/components/ChestRewardPopup";
import { claimTutorialReward } from "@/lib/tutorial.functions";
import { toast } from "sonner";

const PADDING = 8;

export function TutorialSpotlight() {
  const { active, current, next, skip, finish, step } = useTutorial();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const claim = useServerFn(claimTutorialReward);

  const onRequiredRoute = (() => {
    if (!current?.requiredRoute) return true;
    if (typeof current.requiredRoute === "string") return pathname === current.requiredRoute;
    return current.requiredRoute.test(pathname);
  })();

  // Só procura o elemento alvo se já estamos na rota certa
  const targetSelector = current && onRequiredRoute ? current.target : "";
  const rect = useElementRect(targetSelector, [step]);

  // Listener pra avanço por clique no elemento alvo
  useEffect(() => {
    if (!active || !current || current.advance !== "click" || !current.target || !onRequiredRoute) return;
    function onClick(e: MouseEvent) {
      const targetEl = document.querySelector(current!.target);
      if (!targetEl) return;
      const path = e.composedPath();
      const hit = path.some((n) => n instanceof Element && (n === targetEl || targetEl.contains(n)));
      if (hit) {
        // Pequeno delay pra deixar a ação real acontecer (navegação, abrir picker, etc)
        setTimeout(() => next(), 150);
      }
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [active, current, onRequiredRoute, next]);

  // Listener pra avanço por evento custom
  useEffect(() => {
    if (!active || !current || current.advance !== "event" || !current.eventName) return;
    const name = current.eventName;
    function onEvt() { next(); }
    window.addEventListener(name, onEvt);
    return () => window.removeEventListener(name, onEvt);
  }, [active, current, next]);

  // Estado de "esconder temporariamente" — usado pela arena pra sumir com o overlay
  // durante a animação da batalha.
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    function onHide() { setHidden(true); }
    function onShow() { setHidden(false); }
    window.addEventListener("tutorial:hide", onHide);
    window.addEventListener("tutorial:show", onShow);
    return () => {
      window.removeEventListener("tutorial:hide", onHide);
      window.removeEventListener("tutorial:show", onShow);
    };
  }, []);

  // Estado da reward final
  const [rewardQueue, setRewardQueue] = useState<PendingChest[]>([]);
  const [showFarewell, setShowFarewell] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const claimedRef = useRef(false);

  if (rewardQueue.length > 0) {
    return (
      <ChestRewardPopup
        queue={rewardQueue}
        defaultOpened
        onConsume={(id) => {
          setRewardQueue((q) => q.filter((c) => c.id !== id));
          setShowFarewell(true);
        }}
      />
    );
  }

  if (showFarewell) {
    return (
      <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
        <div className="max-w-md w-full rounded-3xl bg-gradient-to-br from-indigo-900 via-purple-900 to-fuchsia-900 border-4 border-yellow-300 shadow-2xl p-6 text-center text-white animate-in zoom-in">
          <div className="text-6xl mb-3 animate-bounce">🎮</div>
          <h2 className="text-2xl font-black drop-shadow-lg text-yellow-200">Bom jogo!</h2>
          <p className="text-white/95 mt-4 text-sm leading-relaxed">
            Você tá pronto pra dominar a arena! ⚔️
          </p>
          <p className="text-white/90 mt-3 text-sm leading-relaxed">
            Qualquer dúvida, é só abrir o <b>menu</b> no canto e ir em <b className="text-yellow-300">💡 Dicas</b> — tem estratégias, sinergias e comps prontas pra você.
          </p>
          <p className="text-white/80 mt-3 text-xs italic">
            Boa sorte, treinador! 🐲✨
          </p>
          <button
            onClick={() => { setShowFarewell(false); finish(); }}
            className="mt-5 w-full px-6 py-4 rounded-2xl bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-600 text-yellow-950 font-black text-lg shadow-2xl hover:scale-105 transition border-4 border-yellow-200"
          >
            🚀 Jogar agora
          </button>
        </div>
      </div>
    );
  }

  if (!active || !current) return null;

  if (hidden) return null;

  // Passo final: pede pro user clicar pra abrir o baú
  if (current.advance === "manual" && current.id === "reward") {
    async function doClaim() {
      if (claiming || claimedRef.current) return;
      setClaiming(true);
      try {
        const result = await claim({});
        if (result.alreadyClaimed) {
          toast.info("Você já recebeu sua recompensa do tutorial.");
          window.dispatchEvent(new Event("profile:reload"));
          finish();
        } else {
          claimedRef.current = true;
          setRewardQueue([
            {
              id: `tutorial-reward-${Date.now()}`,
              tier: result.tier,
              label: "Recompensa do tutorial",
              reward: result.reward,
            },
          ]);
          window.dispatchEvent(new Event("profile:reload"));
          finish();
        }
      } catch (err) {
        console.error(err);
        toast.error("Erro ao receber recompensa: " + (err as Error).message);
      } finally {
        setClaiming(false);
      }
    }

    return (
      <div className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
        <div className="max-w-md w-full rounded-3xl bg-gradient-to-br from-indigo-900 via-purple-900 to-fuchsia-900 border-4 border-yellow-300 shadow-2xl p-6 text-center text-white animate-in zoom-in">
          <div className="text-6xl mb-2 animate-bounce">🎉</div>
          <h2 className="text-2xl font-black drop-shadow-lg">{current.title}</h2>
          <p className="text-white/90 mt-3 text-sm leading-relaxed whitespace-pre-line">{current.body}</p>
          <div className="my-5 text-7xl animate-pulse">🥈</div>
          <button
            onClick={doClaim}
            disabled={claiming}
            className="w-full px-6 py-4 rounded-2xl bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-600 text-yellow-950 font-black text-xl shadow-2xl hover:scale-105 transition disabled:opacity-60 disabled:cursor-wait border-4 border-yellow-200"
          >
            {claiming ? "Abrindo baú…" : "🎁 Receber Baú de Prata"}
          </button>
        </div>
      </div>
    );
  }

  // Passos com spotlight
  const inWrongRoute = !onRequiredRoute && current.requiredRoute;

  return (
    <div className="fixed inset-0 z-[95] pointer-events-none">
      {/* Backdrop escuro com furo no elemento alvo */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto" style={{ pointerEvents: rect ? "none" : "auto" }}>
        <defs>
          <mask id="tutorial-mask">
            <rect width="100%" height="100%" fill="white" />
            {rect && (
              <rect
                x={rect.x - PADDING}
                y={rect.y - PADDING}
                width={rect.width + PADDING * 2}
                height={rect.height + PADDING * 2}
                rx="14"
                ry="14"
                fill="black"
              />
            )}
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.78)"
          mask="url(#tutorial-mask)"
        />
      </svg>

      {/* Ring dourado pulsante em volta do alvo */}
      {rect && (
        <div
          className="absolute pointer-events-none rounded-2xl border-4 border-yellow-300 animate-pulse"
          style={{
            left: rect.x - PADDING,
            top: rect.y - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            boxShadow: "0 0 32px rgba(253,224,71,0.85), inset 0 0 16px rgba(253,224,71,0.45)",
          }}
        />
      )}

      {/* Tooltip — embaixo da tela pra mobile (não cobre o alvo) */}
      <div
        className="absolute left-1/2 -translate-x-1/2 w-[92%] max-w-md pointer-events-auto"
        style={{
          // Se o alvo está na metade de cima, tooltip vai pra parte de baixo, e vice-versa
          ...(rect && rect.y < window.innerHeight / 2
            ? { bottom: "calc(env(safe-area-inset-bottom, 0px) + 88px)" }
            : { top: "calc(env(safe-area-inset-top, 0px) + 16px)" }),
        }}
      >
        <div className="rounded-2xl bg-gradient-to-br from-indigo-900 via-purple-900 to-fuchsia-900 border-2 border-yellow-300 shadow-2xl p-4 text-white animate-in slide-in-from-bottom-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-base font-black text-yellow-200 drop-shadow">{current.title}</h3>
            <button
              onClick={() => {
                if (confirm("Pular o tutorial? Você perderá o baú de recompensa.")) skip();
              }}
              className="text-[10px] px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 font-bold shrink-0"
            >
              Pular
            </button>
          </div>
          <p className="text-sm leading-relaxed whitespace-pre-line text-white/95">{current.body}</p>

          {inWrongRoute && (
            <button
              onClick={() => {
                const to = typeof current.requiredRoute === "string" ? current.requiredRoute : "/";
                navigate({ to });
              }}
              className="mt-3 w-full px-4 py-3 rounded-xl bg-gradient-to-b from-emerald-400 to-emerald-600 hover:from-emerald-300 hover:to-emerald-500 text-white font-black text-sm shadow-lg border-2 border-emerald-200"
            >
              {current.goLabel ?? "Ir agora"}
            </button>
          )}

          {!inWrongRoute && !rect && (
            <p className="mt-3 text-[11px] text-yellow-200/80 italic">
              ⏳ Procurando o elemento na tela...
            </p>
          )}

          {!inWrongRoute && rect && (
            <p className="mt-3 text-[11px] text-yellow-200/80 italic flex items-center gap-1">
              👆 Toque no elemento iluminado pra continuar
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

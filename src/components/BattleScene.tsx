import { useEffect, useMemo, useState } from "react";
import type { BattleLogEntry } from "@/lib/battle";
import { SPECIES, ELEMENT_COLORS, RARITY_INFO, MAX_RANK, skinFilter, totalStats, getSkill } from "@/lib/game-data";
import type { MonsterRow } from "./MonsterCard";
import grassBg from "@/assets/battle-grass-bg.jpg";

type Team = (MonsterRow & { owner_id: string })[];
type HpMap = Map<string, { cur: number; max: number }>;
type ShieldMap = Map<string, number>;
type SkillFxKind = "heal" | "bite" | "explosion" | "lightning" | "fire" | "shield" | "slash" | "skull" | "fury" | "silence" | "magic" | "revive" | "true";
type Fx = { actor: string | null; target: string | null; dmg: number | null; crit: boolean; skillFx: SkillFxKind | null; targets: string[] };
type StatusKind = "burn" | "silence" | "rage" | "shield";
type StatusMap = Map<string, Set<StatusKind>>;
type EffectBanner = {
  id: number;
  emoji: string;
  label: string;
  detail?: string;
  color: string; // tailwind gradient classes
} | null;

// Detecta o tipo de efeito a partir da mensagem do log
function detectEffect(entry: BattleLogEntry): EffectBanner {
  const m = entry.message;
  const mkId = entry.turn * 10000 + Math.floor(Math.random() * 9999);
  if (m.includes("EXECUÇÃO") || m.includes("executado"))
    return { id: mkId, emoji: "☠️", label: "EXECUÇÃO!", detail: "Alvo abaixo de 30% HP — dano triplicado", color: "from-rose-600 to-red-900" };
  if (m.includes("VERDADEIRO") || m.includes("reduzido a pó"))
    return { id: mkId, emoji: "💥", label: "DANO VERDADEIRO", detail: "Ignora DEF e elemento", color: "from-fuchsia-600 to-purple-900" };
  if (m.includes("ressuscitado"))
    return { id: mkId, emoji: "✨", label: "RESSURREIÇÃO", detail: "Aliado caído voltou à batalha", color: "from-emerald-400 to-teal-700" };
  if (m.includes("salto"))
    return { id: mkId, emoji: "⚡", label: "CORRENTE ELÉTRICA", detail: "Raio salta entre os inimigos", color: "from-sky-400 to-indigo-700" };
  if (m.includes("queimando") && m.includes("turnos"))
    return { id: mkId, emoji: "🔥", label: "QUEIMADURA", detail: "Dano por 3 turnos aplicado", color: "from-orange-500 to-red-700" };
  if (m.includes("sofreu") && m.includes("queimadura"))
    return { id: mkId, emoji: "🔥", label: "DoT", detail: `Queimadura: ${entry.damage} de dano`, color: "from-amber-500 to-orange-700" };
  if (m.includes("silenciou") || m.includes("silencia"))
    return { id: mkId, emoji: "🤐", label: "SILÊNCIO", detail: "Próxima skill do alvo anulada", color: "from-violet-600 to-purple-900" };
  if (m.includes("roubou"))
    return { id: mkId, emoji: "🩸", label: "ROUBO DE VIDA", detail: "Cura proporcional ao dano", color: "from-rose-500 to-red-800" };
  if (m.includes("golpe ") && m.includes("/2"))
    return { id: mkId, emoji: "⚡⚡", label: "GOLPE DUPLO", detail: "Dois ataques no alvo mais forte", color: "from-yellow-400 to-amber-700" };
  if (m.includes("fúria") || m.includes("ATK e -"))
    return { id: mkId, emoji: "😡", label: "FÚRIA", detail: "+ATK / -DEF por 3 turnos", color: "from-red-600 to-rose-900" };
  if (m.includes("escudo") && m.includes("DEF por"))
    return { id: mkId, emoji: "🛡️", label: "ESCUDO ALIADO", detail: "Aliado protegido e blindado", color: "from-cyan-500 to-blue-800" };
  if (m.includes("Provocou") && m.includes("escudo"))
    return { id: mkId, emoji: "🛡️", label: "PROVOCAR", detail: "Inimigos forçados a atacar o tank", color: "from-amber-500 to-yellow-800" };
  if (m.includes("Curou todos"))
    return { id: mkId, emoji: "💚", label: "CURA EM ÁREA", detail: "Time inteiro recuperou HP", color: "from-emerald-400 to-green-700" };
  if (m.includes("dano arcano") || m.includes("dano em CADA"))
    return { id: mkId, emoji: "🔮", label: "DANO MÁGICO EM ÁREA", color: "from-fuchsia-500 to-purple-800" };
  return null;
}

// Detecta status persistentes pela mensagem
function statusFromMessage(msg: string): StatusKind | null {
  if (msg.includes("queimando") && msg.includes("turnos")) return "burn";
  if (msg.includes("silenciou") || msg.includes("silencia próxima")) return "silence";
  if (msg.includes("fúria") || msg.includes("ATK por 3 turnos")) return "rage";
  if (msg.includes("DEF por") && msg.includes("escudo")) return "shield";
  return null;
}

export function BattleScene({
  teamA,
  teamB,
  log,
  step,
  playerAName,
  playerATier,
  playerBName,
  playerBTier,
}: {
  teamA: Team;
  teamB: Team;
  log: BattleLogEntry[];
  step: number;
  playerAName?: string;
  playerATier?: string;
  playerBName?: string;
  playerBTier?: string;
}) {
  const initialHp = useMemo<HpMap>(() => {
    const map: HpMap = new Map();
    const bonusOf = (m: any) => ({ hp: m.hp ?? 0, atk: m.atk ?? 0, def: m.def ?? 0, spd: m.spd ?? 0, int: m.int ?? 0 });
    for (const m of teamA) {
      const max = totalStats(m.species, m.rank ?? 1, bonusOf(m)).hp;
      map.set(`a:${m.name}`, { cur: max, max });
    }
    for (const m of teamB) {
      const max = totalStats(m.species, m.rank ?? 1, bonusOf(m)).hp;
      map.set(`b:${m.name}`, { cur: max, max });
    }
    return map;
  }, [teamA, teamB]);

  const [hp, setHp] = useState<HpMap>(initialHp);
  const [shields, setShields] = useState<ShieldMap>(new Map());
  const [fx, setFx] = useState<Fx>({ actor: null, target: null, dmg: null, crit: false, skillFx: null, targets: [] });
  const [banner, setBanner] = useState<EffectBanner>(null);
  const [statuses, setStatuses] = useState<StatusMap>(new Map());

  useEffect(() => {
    setHp(new Map(initialHp));
    setShields(new Map());
    setFx({ actor: null, target: null, dmg: null, crit: false, skillFx: null, targets: [] });
    setBanner(null);
    setStatuses(new Map());
  }, [initialHp]);

  useEffect(() => {
    if (step <= 0 || step > log.length) return;
    const entry = log[step - 1];
    const actorSide: "a" | "b" = entry.actor === "team_a" ? "a" : "b";
    const actorKey = `a:${entry.actorName}`.replace(/^a:/, `${actorSide}:`);

    // Determine target side
    const isSelfOrAlly = entry.damage < 0 || entry.targetName === entry.actorName;
    const targetSide: "a" | "b" = isSelfOrAlly ? actorSide : actorSide === "a" ? "b" : "a";
    const targetKey =
      entry.targetName === "todos os aliados" ? null : `${targetSide}:${entry.targetName}`;

    setHp((prev) => {
      const next = new Map(prev);
      if (entry.targetName === "todos os aliados") {
        const allies = actorSide === "a" ? teamA : teamB;
        const healAmt = -entry.damage;
        for (const m of allies) {
          const k = `${actorSide}:${m.name}`;
          const cur = next.get(k);
          if (cur && cur.cur > 0) next.set(k, { ...cur, cur: Math.min(cur.max, cur.cur + healAmt) });
        }
      } else if (targetKey) {
        const cur = next.get(targetKey);
        if (cur) {
          if (entry.damage > 0) {
            next.set(targetKey, { ...cur, cur: Math.max(0, entry.remainingHp) });
          } else if (entry.damage < 0) {
            next.set(targetKey, { ...cur, cur: Math.min(cur.max, cur.cur + -entry.damage) });
          }
        }
      }
      return next;
    });

    if (entry.targetShield !== undefined && targetKey) {
      setShields((prev) => {
        const next = new Map(prev);
        next.set(targetKey, entry.targetShield!);
        return next;
      });
    }

    // ===== Determinar tipo de animação de skill =====
    const actorMon = (actorSide === "a" ? teamA : teamB).find((m) => m.name === entry.actorName);
    const skillKind = actorMon ? getSkill(actorMon.species).kind : null;
    const msg = entry.message;
    let skillFx: SkillFxKind | null = null;
    let targets: string[] = targetKey ? [targetKey] : [];
    // Cura (dano negativo) sempre mostra cruzes verdes
    if (entry.damage < 0 || msg.includes("Curou todos") || msg.includes("curou")) {
      skillFx = "heal";
      if (entry.targetName === "todos os aliados") {
        const allies = actorSide === "a" ? teamA : teamB;
        targets = allies.filter((m) => (hp.get(`${actorSide}:${m.name}`)?.cur ?? 0) >= 0).map((m) => `${actorSide}:${m.name}`);
      }
    } else if (msg.includes("ressuscitado")) {
      skillFx = "revive";
    } else if (msg.includes("VERDADEIRO") || msg.includes("reduzido a pó")) {
      skillFx = "true";
    } else if (msg.includes("EXECUÇÃO") || msg.includes("executado") || skillKind === "execute") {
      skillFx = "skull";
    } else if (msg.includes("salto") || skillKind === "chain_lightning") {
      skillFx = "lightning";
      // tenta marcar todos do lado oposto como salto
      const enemies = (actorSide === "a" ? teamB : teamA);
      targets = enemies.map((m) => `${actorSide === "a" ? "b" : "a"}:${m.name}`);
    } else if (msg.includes("queimando") || msg.includes("queimadura") || skillKind === "burn_dot") {
      skillFx = "fire";
    } else if (msg.includes("silenciou") || msg.includes("silencia") || skillKind === "silence_disable") {
      skillFx = "silence";
    } else if (msg.includes("roubou") || skillKind === "lifesteal_strike") {
      skillFx = "bite";
    } else if (msg.includes("escudo") || msg.includes("Provocou") || skillKind === "shield_taunt" || skillKind === "shield_ally") {
      skillFx = "shield";
    } else if (msg.includes("fúria") || msg.includes("ATK e -") || skillKind === "berserker_rage") {
      skillFx = "fury";
    } else if (msg.includes("golpe ") && msg.includes("/2") || skillKind === "double_strike") {
      skillFx = "slash";
    } else if (msg.includes("dano arcano") || msg.includes("dano em CADA") || skillKind === "aoe_magic") {
      skillFx = "explosion";
      const enemies = (actorSide === "a" ? teamB : teamA);
      targets = enemies.map((m) => `${actorSide === "a" ? "b" : "a"}:${m.name}`);
    } else if (skillKind === "heavy_strike" || skillKind === "guaranteed_crit" || entry.crit) {
      skillFx = "bite";
    } else if (skillKind === "true_damage_nuke") {
      skillFx = "magic";
    }

    setFx({ actor: actorKey, target: targetKey, dmg: entry.damage, crit: entry.crit, skillFx, targets });

    // ===== Banner de efeito especial =====
    const eff = detectEffect(entry);
    if (eff) setBanner(eff);

    // ===== Status persistentes no alvo =====
    const st = statusFromMessage(entry.message);
    if (st) {
      const key = st === "rage" ? actorKey : (targetKey ?? actorKey);
      setStatuses((prev) => {
        const next = new Map(prev);
        const cur = new Set(next.get(key) ?? []);
        cur.add(st);
        next.set(key, cur);
        return next;
      });
      // expira após algumas etapas
      const stepsToClear = st === "silence" ? 2 : 3;
      const clearTimer = setTimeout(() => {
        setStatuses((prev) => {
          const next = new Map(prev);
          const cur = new Set(next.get(key) ?? []);
          cur.delete(st);
          if (cur.size === 0) next.delete(key);
          else next.set(key, cur);
          return next;
        });
      }, 650 * stepsToClear);
      // não retornamos esse timer pra não atrapalhar o cleanup principal
      void clearTimer;
    }

    const t = setTimeout(
      () => setFx({ actor: null, target: null, dmg: null, crit: false, skillFx: null, targets: [] }),
      900
    );
    const tb = setTimeout(() => setBanner(null), 1100);
    return () => {
      clearTimeout(t);
      clearTimeout(tb);
    };
  }, [step, log, teamA, teamB]);

  return (
    <div
      className="relative rounded-2xl border-2 border-white/30 overflow-hidden shadow-2xl"
      style={{
        backgroundImage: `url(${grassBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        imageRendering: "pixelated",
      }}
    >
      {/* Vinheta escura nas bordas pra contraste */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-black/10 via-transparent to-black/40" />

      {/* === Faixa de nicks dos jogadores === */}
      {(playerAName || playerBName) && (
        <div className="relative px-4 pt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <div className="flex flex-col items-start">
            <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-white font-extrabold text-sm shadow-lg truncate max-w-full">
              {playerAName ?? "Você"}
            </div>
            {playerATier && (
              <div className="mt-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black text-[10px] font-extrabold shadow">
                🏆 {playerATier}
              </div>
            )}
          </div>
          <div className="text-white font-black text-lg drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">VS</div>
          <div className="flex flex-col items-end">
            <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-white font-extrabold text-sm shadow-lg truncate max-w-full">
              {playerBName ?? "Oponente"}
            </div>
            {playerBTier && (
              <div className="mt-1 px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-black text-[10px] font-extrabold shadow">
                🏆 {playerBTier}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === Cards (status) em cima === */}
      <div className="relative px-4 pt-3 pb-2 bg-gradient-to-b from-black/50 to-transparent">
        <div className="grid grid-cols-2 gap-3">
          <SideColumn team={teamA} side="a" hp={hp} shields={shields} fx={fx} statuses={statuses} />
          <SideColumn team={teamB} side="b" hp={hp} shields={shields} fx={fx} statuses={statuses} mirrored />
        </div>
      </div>

      {/* === ARENA: pets na grama embaixo === */}
      <div className="relative px-4 pt-6 pb-6">
        <div className="grid grid-cols-2 gap-3 items-end min-h-[140px]">
          <ArenaLineup team={teamA} side="a" hp={hp} fx={fx} />
          <ArenaLineup team={teamB} side="b" hp={hp} fx={fx} mirrored />
        </div>
      </div>

      {/* Overlay central de efeito */}
      {banner && (
        <div
          key={banner.id}
          className="pointer-events-none absolute inset-0 flex items-center justify-center z-30 animate-fade-in"
        >
          <div
            className={`px-5 py-3 rounded-2xl bg-gradient-to-br ${banner.color} border-2 border-white/40 shadow-2xl text-white text-center animate-scale-in`}
            style={{ textShadow: "0 2px 6px rgba(0,0,0,0.7)" }}
          >
            <div className="text-4xl leading-none">{banner.emoji}</div>
            <div className="text-base font-extrabold tracking-wide mt-1">{banner.label}</div>
            {banner.detail && (
              <div className="text-[10px] opacity-90 font-semibold mt-0.5 max-w-[200px]">{banner.detail}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// === Linha dos 3 pets no cenário (apenas sprite) ===
function ArenaLineup({
  team,
  side,
  hp,
  fx,
  mirrored,
}: {
  team: Team;
  side: "a" | "b";
  hp: HpMap;
  fx: Fx;
  mirrored?: boolean;
}) {
  return (
    <div className={`flex ${mirrored ? "justify-end flex-row-reverse" : "justify-start"} items-end gap-3 sm:gap-5`}>
      {[...team].sort((a, b) => (b.team_position ?? 0) - (a.team_position ?? 0)).map((m) => {


        const sp = SPECIES[m.species];
        if (!sp) return null;
        const key = `${side}:${m.name}`;
        const h = hp.get(key) ?? { cur: 0, max: 1 };
        const dead = h.cur <= 0;
        const isActor = fx.actor === key && !dead;
        const isTarget = fx.target === key;
        const hasSkillFx = fx.skillFx && (fx.targets.includes(key) || (isActor && (fx.skillFx === "fury" || fx.skillFx === "shield")));
        // Algum pet está em foco nesta cena?
        const sceneHasFocus = fx.actor !== null || fx.target !== null;
        const isFocused = isActor || isTarget;
        // Avança em direção ao inimigo
        const lunge = isActor ? (mirrored ? "-translate-x-6 -translate-y-2" : "translate-x-6 -translate-y-2") : "";
        // Modo câmera: ator cresce muito, alvo cresce um pouco, resto encolhe e desfoca
        const cameraZoom = isActor
          ? "scale-[1.35] z-30"
          : isTarget
          ? "scale-110 z-20"
          : sceneHasFocus
          ? "scale-90 opacity-60 blur-[1px] z-0"
          : "";
        return (
          <div
            key={m.id}
            className={`relative transition-all duration-300 ease-out ${cameraZoom} ${lunge} ${
              dead ? "opacity-20 grayscale rotate-90" : ""
            } ${isTarget ? "animate-battle-shake" : ""}`}
          >
            {/* Plataforma circular */}
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-16 h-3 rounded-full bg-black/40 blur-sm" />
            <img
              src={sp.image}
              alt={m.name}
              loading="lazy"
              className={`relative h-40 w-40 sm:h-44 sm:w-44 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] ${
                isActor ? "ring-4 ring-yellow-300/80 rounded-full" : ""
              } ${isTarget ? "ring-4 ring-red-400/80 rounded-full" : ""}`}
              style={{
                filter: skinFilter(m.skin),
                transform: mirrored ? "scaleX(-1)" : undefined,
              }}
            />
            {hasSkillFx && fx.skillFx && (
              <SkillFxOverlay kind={fx.skillFx} keyId={`${fx.actor}-${key}-${fx.dmg}`} />
            )}
            {isTarget && fx.dmg !== null && fx.dmg !== 0 && (
              <div
                key={`arena-${fx.actor}-${fx.target}-${fx.dmg}`}
                className={`absolute -top-3 left-1/2 -translate-x-1/2 font-extrabold text-2xl pointer-events-none animate-battle-float ${
                  fx.dmg < 0 ? "text-green-300" : fx.crit ? "text-yellow-300" : "text-red-300"
                }`}
                style={{ textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}
              >
                {fx.dmg < 0 ? `+${-fx.dmg}` : `-${fx.dmg}`}
                {fx.crit ? "!" : ""}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// === Animação visual da skill sobre o pet ===
function SkillFxOverlay({ kind, keyId }: { kind: SkillFxKind; keyId: string }) {
  return (
    <div
      key={keyId}
      className="pointer-events-none absolute inset-0 z-20 overflow-visible"
    >
      {kind === "heal" && (
        <>
          <div className="absolute inset-0 rounded-full bg-emerald-400/30 animate-skill-aura-green" />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 text-3xl font-black text-emerald-300 animate-skill-heal-cross"
              style={{
                textShadow: "0 0 12px rgba(34,197,94,0.9)",
                animationDelay: `${i * 0.18}s`,
                transform: `translate(calc(-50% + ${(i - 1) * 18}px), -50%)`,
              }}
            >
              ✚
            </div>
          ))}
          {[...Array(6)].map((_, i) => (
            <span
              key={`s${i}`}
              className="absolute left-1/2 top-1/2 text-xs animate-skill-sparkle"
              style={{
                animationDelay: `${i * 0.08}s`,
                transform: `translate(-50%, -50%) rotate(${i * 60}deg) translateY(-30px)`,
              }}
            >
              ✨
            </span>
          ))}
        </>
      )}

      {kind === "magic" && (
        <>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-4 border-fuchsia-400 animate-skill-rune" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full border-2 border-violet-300 animate-skill-rune-reverse" />
          <div
            className="absolute left-1/2 text-4xl animate-skill-meteor"
            style={{ transform: "translateX(-50%)" }}
          >
            🔮
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl animate-skill-explode">
            💜
          </div>
        </>
      )}

      {kind === "explosion" && (
        <>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-orange-400/70 animate-skill-shockwave" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl animate-skill-explode">
            💥
          </div>
          {[...Array(8)].map((_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 text-xl animate-skill-shard"
              style={{
                transform: `translate(-50%, -50%) rotate(${i * 45}deg)`,
                animationDelay: `${i * 0.02}s`,
              }}
            >
              ✦
            </span>
          ))}
        </>
      )}

      {kind === "lightning" && (
        <>
          <div className="absolute inset-0 bg-yellow-200/40 animate-skill-flash" />
          <div
            className="absolute left-1/2 -top-16 text-7xl animate-skill-bolt"
            style={{ transform: "translateX(-50%)", textShadow: "0 0 20px rgba(250,204,21,1)" }}
          >
            ⚡
          </div>
          {[...Array(5)].map((_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 text-sm text-yellow-200 animate-skill-shard"
              style={{
                transform: `translate(-50%, -50%) rotate(${i * 72}deg)`,
                animationDelay: `${0.2 + i * 0.04}s`,
              }}
            >
              ⚡
            </span>
          ))}
        </>
      )}

      {kind === "fire" && (
        <>
          <div
            className="absolute left-1/2 -top-14 text-5xl animate-skill-meteor"
            style={{ transform: "translateX(-50%)" }}
          >
            🔥
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl animate-skill-explode">
            🔥
          </div>
          {[...Array(5)].map((_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 text-base animate-skill-ember"
              style={{
                animationDelay: `${0.3 + i * 0.1}s`,
                transform: `translate(calc(-50% + ${(i - 2) * 14}px), 0)`,
              }}
            >
              🔥
            </span>
          ))}
        </>
      )}

      {kind === "shield" && (
        <>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-4 border-cyan-300 animate-skill-shield-ring" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-cyan-400/30 animate-skill-aura-cyan" />
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl animate-skill-shield"
            style={{ textShadow: "0 0 14px rgba(56,189,248,0.9)" }}
          >
            🛡️
          </div>
        </>
      )}

      {kind === "slash" && (
        <>
          {[-30, 0, 30].map((deg, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-white to-transparent animate-skill-slash-line"
              style={{
                transform: `translate(-50%, -50%) rotate(${deg}deg)`,
                animationDelay: `${i * 0.08}s`,
                boxShadow: "0 0 8px rgba(255,255,255,0.9)",
              }}
            />
          ))}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl animate-skill-slash">
            ⚔️
          </div>
        </>
      )}

      {kind === "bite" && (
        <>
          <div
            className="absolute left-1/2 -top-2 text-4xl animate-skill-bite-top"
            style={{ transform: "translateX(-50%)" }}
          >
            🦷
          </div>
          <div
            className="absolute left-1/2 -bottom-2 text-4xl animate-skill-bite-bottom"
            style={{ transform: "translateX(-50%) rotate(180deg)" }}
          >
            🦷
          </div>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl animate-skill-explode">
            💢
          </div>
        </>
      )}

      {kind === "skull" && (
        <>
          <div className="absolute inset-0 bg-black/40 animate-skill-flash" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-6xl animate-skill-pop">
            💀
          </div>
          {[...Array(4)].map((_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 text-2xl text-purple-300 animate-skill-ember"
              style={{
                animationDelay: `${i * 0.12}s`,
                transform: `translate(calc(-50% + ${(i - 1.5) * 16}px), 0)`,
              }}
            >
              ☠️
            </span>
          ))}
        </>
      )}

      {kind === "fury" && (
        <>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full bg-red-500/40 animate-skill-aura-red" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl animate-skill-pop">
            😡
          </div>
          {[...Array(4)].map((_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 text-xl animate-skill-shard"
              style={{
                transform: `translate(-50%, -50%) rotate(${i * 90 + 45}deg)`,
                animationDelay: `${i * 0.05}s`,
              }}
            >
              💢
            </span>
          ))}
        </>
      )}

      {kind === "silence" && (
        <>
          <div className="absolute inset-0 bg-slate-900/40 animate-skill-flash" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl animate-skill-pop">
            🤐
          </div>
        </>
      )}

      {kind === "revive" && (
        <>
          <div
            className="absolute left-1/2 -top-20 w-3 h-32 bg-gradient-to-b from-yellow-200 via-yellow-300/80 to-transparent animate-skill-beam"
            style={{ transform: "translateX(-50%)", boxShadow: "0 0 24px rgba(253,224,71,0.9)" }}
          />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-5xl animate-skill-heal" style={{ color: "#fde68a" }}>
            ✨
          </div>
          {[...Array(8)].map((_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 text-sm text-yellow-200 animate-skill-sparkle"
              style={{
                animationDelay: `${i * 0.05}s`,
                transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-36px)`,
              }}
            >
              ✦
            </span>
          ))}
        </>
      )}

      {kind === "true" && (
        <>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 rounded-full border-4 border-fuchsia-400 animate-skill-shockwave" />
          <div
            className="absolute left-1/2 top-1/2 text-6xl animate-skill-pierce"
            style={{ transform: "translate(-50%, -50%)", color: "#f0abfc", textShadow: "0 0 16px rgba(217,70,239,0.9)" }}
          >
            💢
          </div>
          {[...Array(6)].map((_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 text-base text-fuchsia-300 animate-skill-shard"
              style={{
                transform: `translate(-50%, -50%) rotate(${i * 60}deg)`,
                animationDelay: `${i * 0.04}s`,
              }}
            >
              ✦
            </span>
          ))}
        </>
      )}
    </div>
  );
}

function SideColumn({
  team,
  side,
  hp,
  shields,
  fx,
  statuses,
  mirrored,
}: {
  team: Team;
  side: "a" | "b";
  hp: HpMap;
  shields: ShieldMap;
  fx: Fx;
  statuses: StatusMap;
  mirrored?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-2 ${mirrored ? "items-end" : "items-start"}`}>
      {[...team].sort((a, b) => (b.team_position ?? 0) - (a.team_position ?? 0)).map((m) => {

        const sp = SPECIES[m.species];
        if (!sp) return null;
        const key = `${side}:${m.name}`;
        const h = hp.get(key) ?? { cur: 0, max: 1 };
        const pct = Math.max(0, Math.min(100, (h.cur / h.max) * 100));
        const shield = shields.get(key) ?? 0;
        const shieldPct = Math.max(0, Math.min(100, (shield / h.max) * 100));
        const dead = h.cur <= 0;
        const isActor = fx.actor === key && !dead;
        const isTarget = fx.target === key;
        const lunge = isActor ? (mirrored ? "-translate-x-3" : "translate-x-3") : "";
        const hpColor =
          pct > 50
            ? "from-green-400 to-emerald-500"
            : pct > 25
            ? "from-yellow-400 to-orange-500"
            : "from-red-500 to-rose-600";
        const st = statuses.get(key);
        return (
          <div
            key={m.id}
            className={`relative w-full max-w-[130px] sm:max-w-[200px] transition-all duration-200 ${
              dead ? "opacity-30 grayscale" : ""
            } ${lunge} ${isTarget ? "animate-battle-shake" : ""}`}
          >
            <div
              className={`flex items-center gap-1.5 sm:gap-2 p-1 sm:p-2 rounded-lg bg-gradient-to-r ${
                ELEMENT_COLORS[sp.element]
              } ring-2 ${RARITY_INFO[sp.rarity].ringColor} ${
                (m.rank ?? 1) >= MAX_RANK ? "rank-max-glow" : ""
              } ${isTarget ? "ring-4 ring-red-400" : ""} ${
                isActor ? "ring-4 ring-yellow-300" : ""
              } transition-all`}
            >
              <img
                src={sp.image}
                alt=""
                className="h-8 w-8 sm:h-12 sm:w-12 object-contain drop-shadow-lg shrink-0"
                style={{ filter: skinFilter(m.skin) }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-[10px] sm:text-xs text-white truncate leading-tight">{m.name}</div>
                <div className="h-1.5 sm:h-2 rounded-full bg-black/40 overflow-hidden mt-0.5 sm:mt-1">
                  <div
                    className={`h-full bg-gradient-to-r ${hpColor} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {shield > 0 && (
                  <div className="h-1 sm:h-1.5 rounded-full bg-black/40 overflow-hidden mt-0.5 ring-1 ring-cyan-300/50">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-500 shadow-[0_0_6px_rgba(56,189,248,0.8)]"
                      style={{ width: `${shieldPct}%` }}
                    />
                  </div>
                )}
                <div className="text-[8px] sm:text-[10px] text-white/90 font-bold flex items-center gap-1 flex-wrap leading-tight">
                  <span>{Math.round(h.cur)}/{h.max}</span>
                  {shield > 0 && (
                    <span className="text-cyan-300">🛡 {Math.round(shield)}</span>
                  )}
                  {st?.has("burn") && <span className="px-1 rounded bg-orange-500/80 animate-pulse" title="Queimando">🔥</span>}
                  {st?.has("silence") && <span className="px-1 rounded bg-violet-500/80 animate-pulse" title="Silenciado">🤐</span>}
                  {st?.has("rage") && <span className="px-1 rounded bg-red-600/80 animate-pulse" title="Em fúria">😡</span>}
                  {st?.has("shield") && <span className="px-1 rounded bg-cyan-500/80 animate-pulse" title="Buff de DEF">✨</span>}
                </div>
              </div>
            </div>
            {isTarget && fx.dmg !== null && fx.dmg !== 0 && (
              <div
                key={`${fx.actor}-${fx.target}-${fx.dmg}`}
                className={`absolute -top-1 ${
                  mirrored ? "left-2" : "right-2"
                } font-extrabold text-xl pointer-events-none animate-battle-float ${
                  fx.dmg < 0
                    ? "text-green-300"
                    : fx.crit
                    ? "text-yellow-300"
                    : "text-red-300"
                }`}
                style={{ textShadow: "0 2px 4px rgba(0,0,0,0.9)" }}
              >
                {fx.dmg < 0 ? `+${-fx.dmg}` : `-${fx.dmg}`}
                {fx.crit ? "!" : ""}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

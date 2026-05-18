import { useEffect, useMemo, useState } from "react";
import type { BattleLogEntry } from "@/lib/battle";
import { SPECIES, ELEMENT_COLORS, RARITY_INFO, MAX_RANK, skinFilter, totalStats } from "@/lib/game-data";
import type { MonsterRow } from "./MonsterCard";
import grassBg from "@/assets/battle-grass-bg.jpg";

type Team = (MonsterRow & { owner_id: string })[];
type HpMap = Map<string, { cur: number; max: number }>;
type ShieldMap = Map<string, number>;
type Fx = { actor: string | null; target: string | null; dmg: number | null; crit: boolean };
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
}: {
  teamA: Team;
  teamB: Team;
  log: BattleLogEntry[];
  step: number;
}) {
  const initialHp = useMemo<HpMap>(() => {
    const map: HpMap = new Map();
    for (const m of teamA) {
      const max = totalStats(m.species, m.rank ?? 1).hp;
      map.set(`a:${m.name}`, { cur: max, max });
    }
    for (const m of teamB) {
      const max = totalStats(m.species, m.rank ?? 1).hp;
      map.set(`b:${m.name}`, { cur: max, max });
    }
    return map;
  }, [teamA, teamB]);

  const [hp, setHp] = useState<HpMap>(initialHp);
  const [shields, setShields] = useState<ShieldMap>(new Map());
  const [fx, setFx] = useState<Fx>({ actor: null, target: null, dmg: null, crit: false });
  const [banner, setBanner] = useState<EffectBanner>(null);
  const [statuses, setStatuses] = useState<StatusMap>(new Map());

  useEffect(() => {
    setHp(new Map(initialHp));
    setShields(new Map());
    setFx({ actor: null, target: null, dmg: null, crit: false });
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

    setFx({ actor: actorKey, target: targetKey, dmg: entry.damage, crit: entry.crit });

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
      () => setFx({ actor: null, target: null, dmg: null, crit: false }),
      650
    );
    const tb = setTimeout(() => setBanner(null), 1100);
    return () => {
      clearTimeout(t);
      clearTimeout(tb);
    };
  }, [step, log, teamA, teamB]);

  return (
    <div className="relative rounded-2xl bg-gradient-to-b from-slate-900/70 to-indigo-950/70 backdrop-blur-md border border-white/20 p-4 overflow-hidden">
      <div className="grid grid-cols-2 gap-3">
        <SideColumn team={teamA} side="a" hp={hp} shields={shields} fx={fx} statuses={statuses} />
        <SideColumn team={teamB} side="b" hp={hp} shields={shields} fx={fx} statuses={statuses} mirrored />
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
      {team.map((m) => {
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
            className={`relative w-full max-w-[200px] transition-all duration-200 ${
              dead ? "opacity-30 grayscale" : ""
            } ${lunge} ${isTarget ? "animate-battle-shake" : ""}`}
          >
            <div
              className={`flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r ${
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
                className="h-12 w-12 object-contain drop-shadow-lg"
                style={{ filter: skinFilter(m.skin) }}
              />
              <div className="flex-1 min-w-0">
                <div className="font-bold text-xs text-white truncate">{m.name}</div>
                <div className="h-2 rounded-full bg-black/40 overflow-hidden mt-1">
                  <div
                    className={`h-full bg-gradient-to-r ${hpColor} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {shield > 0 && (
                  <div className="h-1.5 rounded-full bg-black/40 overflow-hidden mt-0.5 ring-1 ring-cyan-300/50">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-blue-500 transition-all duration-500 shadow-[0_0_6px_rgba(56,189,248,0.8)]"
                      style={{ width: `${shieldPct}%` }}
                    />
                  </div>
                )}
                <div className="text-[10px] text-white/90 font-bold flex items-center gap-1 flex-wrap">
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

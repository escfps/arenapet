import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TYPE_INFO, type PokeType } from "@/lib/moves";

type LeaderMap = Record<string, PokeType[]>;

let cache: LeaderMap | null = null;
let inflight: Promise<LeaderMap> | null = null;
const subs = new Set<(m: LeaderMap) => void>();

async function loadLeaders(): Promise<LeaderMap> {
  if (cache) return cache;
  if (inflight) return inflight;
  inflight = (async () => {
    const { data } = await supabase.from("gyms").select("type, leader_id");
    const map: LeaderMap = {};
    for (const g of (data ?? []) as Array<{ type: string; leader_id: string | null }>) {
      if (!g.leader_id) continue;
      (map[g.leader_id] ||= []).push(g.type as PokeType);
    }
    cache = map;
    inflight = null;
    subs.forEach((s) => s(map));
    return map;
  })();
  return inflight;
}

/** Mapa userId -> tipos de ginásio que ele lidera. */
export function useGymLeaders(): LeaderMap {
  const [map, setMap] = useState<LeaderMap>(cache ?? {});
  useEffect(() => {
    subs.add(setMap);
    void loadLeaders().then(setMap).catch(() => {});
    return () => { subs.delete(setMap); };
  }, []);
  return map;
}

/** Título "LÍDER DE GINÁSIO" com a insígnia do tipo dominado. */
export function GymLeaderTitle({
  types,
  compact = false,
}: {
  types?: PokeType[] | null;
  compact?: boolean;
}) {
  if (!types || types.length === 0) return null;
  const main = types[0];
  const info = TYPE_INFO[main];
  if (!info) return null;
  const label = types.length > 1 ? `LÍDER ×${types.length}` : "LÍDER DE GINÁSIO";
  return (
    <span
      title={`Líder de Ginásio ${types.map((t) => TYPE_INFO[t]?.name ?? t).join(", ")}`}
      className={`inline-flex items-center gap-1 rounded-full font-extrabold uppercase tracking-wide shadow ring-1 ring-white/40 ${info.color} ${
        compact ? "px-1.5 py-0.5 text-[8px]" : "px-2 py-0.5 text-[9px]"
      }`}
    >
      <span className="leading-none">{info.emoji}</span>
      <span className="leading-none">{compact ? "LÍDER" : label}</span>
    </span>
  );
}

/** Nome + título de líder, para listas. */
export function NameWithGymTitle({
  name,
  userId,
  compact,
  className,
}: {
  name: string;
  userId?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const leaders = useGymLeaders();
  return (
    <span className={`inline-flex items-center gap-1 min-w-0 ${className ?? ""}`}>
      <span className="truncate">{name}</span>
      <GymLeaderTitle types={userId ? leaders[userId] : null} compact={compact} />
    </span>
  );
}

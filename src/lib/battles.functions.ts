import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const getPlayerBattles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      limit: z.number().int().min(1).max(50).default(30),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const { data: battles } = await supabaseAdmin
      .from("battles")
      .select("id, attacker_id, defender_id, winner_id, coins_reward, xp_reward, created_at, log, attacker_points_delta, defender_points_delta")
      .or(`attacker_id.eq.${data.userId},defender_id.eq.${data.userId}`)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    const rows = battles ?? [];
    const ids = new Set<string>();
    rows.forEach((b) => { ids.add(b.attacker_id); ids.add(b.defender_id); });
    const opponents: Record<string, { username: string; level: number }> = {};
    if (ids.size > 0) {
      const { data: profs } = await supabaseAdmin
        .from("profiles")
        .select("id, username, level")
        .in("id", Array.from(ids));
      (profs ?? []).forEach((p) => { opponents[p.id] = { username: p.username, level: p.level }; });
    }
    return { battles: rows, opponents };
  });

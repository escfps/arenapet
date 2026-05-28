import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const Schema = z.object({
  confirm: z.literal("EXCLUIR"),
});

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Schema.parse(input))
  .handler(async ({ context }) => {
    const { userId } = context;

    // Limpa dados em todas as tabelas que referenciam o usuário.
    // Ordem: dependentes primeiro, profiles por último, auth no fim.
    const cleanups = [
      supabaseAdmin.from("monsters").delete().eq("owner_id", userId).then(),
      supabaseAdmin.from("expeditions").delete().eq("user_id", userId).then(),
      supabaseAdmin.from("inventory").delete().eq("user_id", userId).then(),
      supabaseAdmin.from("skins_owned").delete().eq("user_id", userId).then(),
      supabaseAdmin.from("iap_transactions").delete().eq("user_id", userId).then(),
      supabaseAdmin.from("gem_purchases").delete().eq("user_id", userId).then(),
      supabaseAdmin.from("season_trophies").delete().eq("user_id", userId).then(),
      supabaseAdmin.from("tournament_entries").delete().eq("user_id", userId).then(),
      supabaseAdmin.from("friend_messages").delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).then(),
      supabaseAdmin.from("friend_gifts").delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).then(),
      supabaseAdmin.from("friend_challenges").delete().or(`challenger_id.eq.${userId},target_id.eq.${userId}`).then(),
      supabaseAdmin.from("friendships").delete().or(`user_a.eq.${userId},user_b.eq.${userId}`).then(),
      supabaseAdmin.from("trades").delete().or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`).then(),
      supabaseAdmin.from("battles").delete().or(`attacker_id.eq.${userId},defender_id.eq.${userId}`).then(),
    ];
    await Promise.allSettled(cleanups);

    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // Remove o usuário do Auth (invalida sessão)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });

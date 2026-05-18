import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const NICK_CHANGE_COST_GEMS = 30;

const Schema = z.object({
  newUsername: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_.-]+$/, "Use só letras, números, _ . -"),
});

export const changeUsername = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const newName = data.newUsername.trim();

    const { data: me } = await supabaseAdmin
      .from("profiles")
      .select("id, username, gems, nick_changes")
      .eq("id", userId)
      .single();
    if (!me) throw new Error("Perfil não encontrado");

    if (newName.toLowerCase() === me.username.toLowerCase()) {
      throw new Error("Esse já é o seu nick");
    }

    // check uniqueness (case-insensitive)
    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("username", newName)
      .neq("id", userId)
      .maybeSingle();
    if (taken) throw new Error("Esse nick já está em uso");

    const isFree = (me.nick_changes ?? 0) === 0;
    if (!isFree && (me.gems ?? 0) < NICK_CHANGE_COST_GEMS) {
      throw new Error(`Você precisa de ${NICK_CHANGE_COST_GEMS} gemas pra trocar o nick`);
    }

    const update: { username: string; nick_changes: number; gems?: number } = {
      username: newName,
      nick_changes: (me.nick_changes ?? 0) + 1,
    };
    if (!isFree) update.gems = me.gems - NICK_CHANGE_COST_GEMS;

    const { error } = await supabaseAdmin.from("profiles").update(update).eq("id", userId);
    if (error) throw new Error(error.message);

    return { ok: true, free: isFree, newUsername: newName };
  });

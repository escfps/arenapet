import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { ProfileRow } from "@/components/HUD";

export function useProfile() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { navigate({ to: "/login" }); return; }
      if (mounted) setUserId(data.session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/login" });
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [navigate]);

  const reload = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (data) setProfile(data as ProfileRow);
    setLoading(false);
  }, [userId]);

  useEffect(() => { if (userId) reload(); }, [userId, reload]);

  const patch = useCallback(async (updates: Partial<ProfileRow>) => {
    if (!profile) return;
    const merged = { ...profile, ...updates };
    setProfile(merged);
    await supabase.from("profiles").update(updates).eq("id", profile.id);
  }, [profile]);

  return { userId, profile, loading, reload, patch };
}

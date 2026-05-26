import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "Redefinir senha — Arena Pet" }] }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // O Supabase processa o hash de recovery e cria a sessão automaticamente.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (password.length < 6) { setErr("A senha precisa ter no mínimo 6 caracteres."); return; }
    if (password !== confirm) { setErr("As senhas não coincidem."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      try { localStorage.removeItem("arenapet:remember"); } catch {}
      toast.success("Senha redefinida! Você já está logado 🎉");
      navigate({ to: "/" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao redefinir senha");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-[oklch(0.25_0.12_290)] via-[oklch(0.18_0.10_310)] to-[oklch(0.22_0.14_260)]">
      <div className="w-full max-w-sm rounded-3xl bg-[oklch(0.18_0.06_290)]/90 backdrop-blur-xl border-2 border-fuchsia-400/30 p-6 shadow-2xl">
        <h1 className="text-2xl font-extrabold text-white mb-1 flex items-center gap-2">🔑 Nova senha</h1>
        <p className="text-white/60 text-xs mb-5">Defina uma nova senha para sua conta.</p>

        {!ready ? (
          <p className="text-white/70 text-sm text-center py-6">Validando link de redefinição...</p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {err && (
              <div className="rounded-xl border-2 border-red-400/60 bg-red-500/15 px-3 py-2 text-xs font-semibold text-red-100">⚠️ {err}</div>
            )}
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
              <input
                type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Nova senha (mín. 6)"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/40 border-2 border-white/10 text-white placeholder:text-white/40 focus:border-fuchsia-400 outline-none transition"
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
              <input
                type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)}
                placeholder="Confirme a nova senha"
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/40 border-2 border-white/10 text-white placeholder:text-white/40 focus:border-fuchsia-400 outline-none transition"
              />
            </div>
            <button
              type="submit" disabled={busy}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 text-white font-extrabold shadow-lg transition disabled:opacity-50"
            >
              {busy ? "Salvando..." : "✨ Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

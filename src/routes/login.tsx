import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Entrar — Arena Pet" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username: username || email.split("@")[0] },
          },
        });
        if (error) throw error;
        toast.success("Conta criada! Verifique seu email para confirmar.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro");
    } finally {
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) {
      toast.error("Falha no login Google");
      setBusy(false);
    }
  }

  return (
    <main className="relative min-h-screen flex items-center justify-center p-4 overflow-hidden bg-gradient-to-br from-[oklch(0.25_0.12_290)] via-[oklch(0.18_0.10_310)] to-[oklch(0.22_0.14_260)]">
      {/* Glow orbs */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-fuchsia-500/30 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-[28rem] h-[28rem] rounded-full bg-cyan-400/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] rounded-full bg-amber-400/10 blur-3xl" />

      {/* Floating pet emojis */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden text-3xl opacity-30">
        <span className="absolute top-[12%] left-[8%] animate-bounce" style={{ animationDuration: "3s" }}>🐉</span>
        <span className="absolute top-[20%] right-[12%] animate-bounce" style={{ animationDuration: "4s", animationDelay: "0.5s" }}>🔥</span>
        <span className="absolute bottom-[18%] left-[14%] animate-bounce" style={{ animationDuration: "3.5s", animationDelay: "1s" }}>⚡</span>
        <span className="absolute bottom-[25%] right-[10%] animate-bounce" style={{ animationDuration: "4.5s", animationDelay: "1.5s" }}>🦁</span>
        <span className="absolute top-[45%] left-[5%] animate-bounce text-2xl" style={{ animationDuration: "5s", animationDelay: "0.8s" }}>💎</span>
        <span className="absolute top-[50%] right-[6%] animate-bounce text-2xl" style={{ animationDuration: "3.8s", animationDelay: "2s" }}>🐆</span>
      </div>

      {/* Card */}
      <div className="relative w-full max-w-md">
        {/* Glow ring */}
        <div className="absolute -inset-1 rounded-3xl bg-gradient-to-br from-fuchsia-500 via-amber-400 to-cyan-400 opacity-70 blur-md" />

        <div className="relative rounded-3xl bg-[oklch(0.18_0.06_290)]/90 backdrop-blur-xl border border-white/10 shadow-2xl overflow-hidden">
          {/* Top banner */}
          <div className="relative bg-gradient-to-br from-fuchsia-600 via-purple-600 to-indigo-700 p-6 text-center overflow-hidden">
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 70% 60%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
            <div className="relative">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/30 shadow-xl mb-3 text-5xl rotate-3 hover:rotate-0 transition-transform">
                🐉
              </div>
              <h1 className="text-3xl font-black text-white tracking-wider drop-shadow-lg">ARENA PET</h1>
              <p className="text-white/80 text-xs mt-1 font-medium">Colecione · Treine · Batalhe</p>
            </div>
          </div>

          <div className="p-6">
            {/* Tabs */}
            <div className="flex gap-1 mb-5 bg-black/30 rounded-xl p-1 border border-white/5">
              <button
                onClick={() => setMode("signin")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  mode === "signin"
                    ? "bg-gradient-to-b from-fuchsia-500 to-purple-600 text-white shadow-lg shadow-fuchsia-500/30"
                    : "text-white/60 hover:text-white/90"
                }`}
              >Entrar</button>
              <button
                onClick={() => setMode("signup")}
                className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  mode === "signup"
                    ? "bg-gradient-to-b from-amber-400 to-orange-500 text-amber-950 shadow-lg shadow-amber-500/30"
                    : "text-white/60 hover:text-white/90"
                }`}
              >Criar conta</button>
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🎮</span>
                  <input
                    value={username} onChange={(e) => setUsername(e.target.value)}
                    placeholder="Nome do treinador"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/40 border-2 border-white/10 text-white placeholder:text-white/40 focus:border-fuchsia-400 focus:bg-black/60 outline-none transition"
                  />
                </div>
              )}
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">📧</span>
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/40 border-2 border-white/10 text-white placeholder:text-white/40 focus:border-fuchsia-400 focus:bg-black/60 outline-none transition"
                />
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
                <input
                  type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="Senha (mín. 6 caracteres)"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/40 border-2 border-white/10 text-white placeholder:text-white/40 focus:border-fuchsia-400 focus:bg-black/60 outline-none transition"
                />
              </div>
              <button
                type="submit" disabled={busy}
                className="w-full py-3.5 mt-2 rounded-xl bg-gradient-to-b from-fuchsia-500 via-purple-600 to-indigo-700 text-white font-black tracking-wide text-base shadow-[0_6px_0_oklch(0.35_0.18_290)] hover:translate-y-[2px] hover:shadow-[0_4px_0_oklch(0.35_0.18_290)] active:translate-y-[6px] active:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "⏳ AGUARDE..." : mode === "signin" ? "⚔️ ENTRAR NA ARENA" : "✨ COMEÇAR JORNADA"}
              </button>
            </form>

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              <span className="text-[10px] font-bold tracking-widest text-white/40">OU</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>

            <button
              onClick={googleSignIn} disabled={busy}
              className="w-full py-3 bg-white text-gray-800 rounded-xl font-bold hover:bg-gray-100 flex items-center justify-center gap-3 shadow-lg disabled:opacity-50 transition"
            >
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Entrar com Google
            </button>

            <p className="text-center text-white/40 text-[11px] mt-5">
              Ao entrar você concorda em domar pets fofos 💜
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

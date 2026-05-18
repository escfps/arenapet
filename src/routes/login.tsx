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
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md panel-wood rounded-2xl p-1">
        <div className="bg-card rounded-xl p-8">
          <div className="text-center mb-6">
            <div className="text-6xl mb-2">🌻</div>
            <h1 className="text-3xl font-extrabold text-foreground">Colheita Feliz</h1>
            <p className="text-muted-foreground text-sm mt-1">Plante, colhe e cuide da sua fazenda</p>
          </div>

          <div className="flex gap-2 mb-5 bg-muted rounded-lg p-1">
            <button
              onClick={() => setMode("signin")}
              className={`flex-1 py-2 rounded-md text-sm font-bold transition ${mode === "signin" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"}`}
            >Entrar</button>
            <button
              onClick={() => setMode("signup")}
              className={`flex-1 py-2 rounded-md text-sm font-bold transition ${mode === "signup" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground"}`}
            >Criar conta</button>
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <input
                value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="Nome do fazendeiro"
                className="w-full px-4 py-3 rounded-lg bg-muted border-2 border-border focus:border-primary outline-none"
              />
            )}
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full px-4 py-3 rounded-lg bg-muted border-2 border-border focus:border-primary outline-none"
            />
            <input
              type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha (mín. 6 caracteres)"
              className="w-full px-4 py-3 rounded-lg bg-muted border-2 border-border focus:border-primary outline-none"
            />
            <button
              type="submit" disabled={busy}
              className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-bold btn-pop shadow-[0_4px_0_oklch(0.45_0.15_145)] hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "..." : mode === "signin" ? "Entrar" : "Criar conta"}
            </button>
          </form>

          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <button
            onClick={googleSignIn} disabled={busy}
            className="w-full py-3 bg-card border-2 border-border rounded-lg font-bold btn-pop hover:bg-muted flex items-center justify-center gap-2"
          >
            <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            Entrar com Google
          </button>
        </div>
      </div>
    </main>
  );
}

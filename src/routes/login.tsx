import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

import charizardImg from "@/assets/monsters/charizard.png";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({
    meta: [{ title: "Entrar — Duelo Pokemon" }],
    links: [
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:wght@400;500;600;700;800&display=swap",
      },
    ],
  }),
});

const REMEMBER_KEY = "arenapet:remember";

// Paleta travada: Fogo & Pokébola
const C = {
  bg: "#0d0d1a",
  red: "#e3350d",
  yellow: "#ffcb05",
  blue: "#3b5ca8",
};

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    const clean = forgotEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      toast.error("Email inválido. Ex: nome@exemplo.com");
      return;
    }
    setForgotBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(clean, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Email de redefinição enviado! Verifique sua caixa de entrada ✉️");
      setForgotOpen(false);
      setForgotEmail("");
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erro ao enviar email";
      toast.error(raw);
    } finally {
      setForgotBusy(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate({ to: "/" });
        return;
      }
      // Pré-preencher e tentar auto-login se houver credenciais salvas
      try {
        const raw = localStorage.getItem(REMEMBER_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as { email?: string; password?: string };
        if (!saved.email || !saved.password) return;
        setEmail(saved.email);
        setPassword(saved.password);
        setBusy(true);
        supabase.auth
          .signInWithPassword({ email: saved.email, password: saved.password })
          .then(({ error }) => {
            if (!error) navigate({ to: "/" });
            else localStorage.removeItem(REMEMBER_KEY);
          })
          .finally(() => setBusy(false));
      } catch {}
    });
  }, [navigate]);

  function translateAuthError(raw: string): string {
    const m = raw.toLowerCase();
    if (m.includes("invalid login credentials") || m.includes("invalid_credentials"))
      return "Email ou senha incorretos. Verifique e tente novamente.";
    if (m.includes("email not confirmed"))
      return "Confirme seu email antes de entrar (verifique sua caixa de entrada).";
    if (m.includes("already registered") || m.includes("já está cadastrado") || m.includes("user already"))
      return "Este email já está cadastrado. Faça login.";
    if (m.includes("password should be at least") || m.includes("password is too short") || m.includes("weak_password"))
      return "Senha muito curta. Use no mínimo 6 caracteres.";
    if (m.includes("pwned") || (m.includes("password") && m.includes("compromised")))
      return "Essa senha apareceu em vazamentos públicos. Escolha outra mais segura.";
    if (m.includes("unable to validate email") || m.includes("invalid email") || m.includes("invalid format"))
      return "Email inválido. Verifique se digitou corretamente (sem espaços).";
    if (m.includes("rate limit") || m.includes("too many requests"))
      return "Muitas tentativas. Aguarde alguns segundos e tente novamente.";
    if (m.includes("signup is disabled") || m.includes("signups not allowed"))
      return "Cadastros temporariamente desativados. Tente mais tarde.";
    if (m.includes("network") || m.includes("failed to fetch"))
      return "Sem conexão com o servidor. Verifique sua internet.";
    if (m.includes("user not found"))
      return "Conta não encontrada. Crie uma conta primeiro.";
    return raw;
  }

  function showErr(msg: string) {
    setErrorMsg(msg);
    toast.error(msg);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    // Validações locais antes de chamar a API
    const cleanEmail = email.trim();
    if (cleanEmail !== email) setEmail(cleanEmail);
    if (!cleanEmail) { showErr("Digite seu email."); return; }
    if (/\s/.test(cleanEmail)) { showErr("O email não pode ter espaços."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) { showErr("Email inválido. Ex: nome@exemplo.com"); return; }
    if (!password) { showErr("Digite sua senha."); return; }
    if (/\s/.test(password)) { showErr("A senha não pode ter espaços."); return; }
    if (password.length < 6) { showErr("A senha precisa ter no mínimo 6 caracteres."); return; }

    if (mode === "signup") {
      const uname = username.trim();
      if (uname) {
        if (uname.length < 3) { showErr("O nome do treinador precisa ter ao menos 3 caracteres."); return; }
        if (uname.length > 20) { showErr("O nome do treinador deve ter no máximo 20 caracteres."); return; }
        if (/\s/.test(uname)) { showErr("O nome do treinador não pode ter espaços."); return; }
        if (!/^[a-zA-Z0-9_.-]+$/.test(uname)) {
          showErr("Use só letras, números, _ . - no nome do treinador (sem acentos/símbolos).");
          return;
        }
      }
    }

    setBusy(true);
    const watchdog = setTimeout(() => {
      setBusy(false);
      showErr("A operação demorou muito. Tente novamente.");
    }, 20000);
    try {
      if (mode === "signup") {
        try { await supabase.auth.signOut(); } catch {}
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail, password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { username: username.trim() || cleanEmail.split("@")[0] },
          },
        });
        if (error) throw error;
        const identities = (data.user as { identities?: unknown[] } | null)?.identities;
        if (data.user && Array.isArray(identities) && identities.length === 0) {
          throw new Error("Este email já está cadastrado. Faça login.");
        }
        if (remember) {
          localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: cleanEmail, password }));
        }
        if (!data.session) {
          const { error: signInErr } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
          if (signInErr) throw signInErr;
        }
        toast.success("Conta criada! Bem-vindo à arena! 🎉");
        navigate({ to: "/" });
        return;
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;
        if (remember) {
          localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: cleanEmail, password }));
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
        navigate({ to: "/" });
      }
    } catch (err) {
      console.error("[auth submit]", err);
      const raw = err instanceof Error ? err.message : "Erro ao processar";
      showErr(translateAuthError(raw));
    } finally {
      clearTimeout(watchdog);
      setBusy(false);
    }
  }

  async function googleSignIn() {
    setBusy(true);
    try {
      // Detecta ambiente nativo (Capacitor). No app, o broker da Lovable não
      // funciona porque o redirect acontece dentro do WKWebView e o Google
      // bloqueia com "Erro 403: disallowed_useragent". Por isso usamos o
      // plugin nativo que abre o fluxo no navegador do sistema / SDK nativo
      // do Google e devolve um idToken cujo `aud` é o `serverClientId`
      // (= Web Client ID), que é exatamente o que o Supabase aceita.
      const isNative =
        typeof window !== "undefined" &&
        (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } })
          .Capacitor?.isNativePlatform?.() === true;

      if (isNative) {
        const { SocialLogin } = await import("@capgo/capacitor-social-login");
        try {
          await SocialLogin.initialize({
            google: {
              webClientId:
                "486152638398-rk8rqgq0b2fhdcnok8s25oijqneqnqjk.apps.googleusercontent.com",
              iOSClientId:
                "486152638398-fb6bpnfo14rr5ditb967ft0841fl0bal.apps.googleusercontent.com",
              iOSServerClientId:
                "486152638398-rk8rqgq0b2fhdcnok8s25oijqneqnqjk.apps.googleusercontent.com",
              mode: "online",
            },
          });
        } catch (e) {
          console.warn("[googleSignIn native] initialize warn", e);
        }
        const rawNonce = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        const res = await SocialLogin.login({
          provider: "google",
          options: { scopes: ["email", "profile"], nonce: rawNonce },
        });
        const result = res?.result as { idToken?: string } | undefined;
        const idToken = result?.idToken;
        if (!idToken) {
          showErr("Não foi possível obter token do Google.");
          setBusy(false);
          return;
        }
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken,
          nonce: rawNonce,
        });
        if (error) {
          console.error("[googleSignIn native] supabase error", error);
          showErr(`Falha no login Google: ${error.message}`);
          setBusy(false);
          return;
        }
        navigate({ to: "/" });
        return;
      }

      // Web: usa o broker OAuth da Lovable
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/login`,
      });
      if (result.error) {
        console.error("[googleSignIn] broker error", result.error);
        showErr("Falha no login Google");
        setBusy(false);
        return;
      }
      if (result.redirected) {
        return;
      }
      navigate({ to: "/" });
    } catch (e) {
      console.error("[googleSignIn]", e);
      const msg = e instanceof Error ? e.message : "Falha no login Google";
      showErr(msg);
      setBusy(false);
    }
  }

  const typeIcons = ["🔥", "💧", "🌿", "⚡", "🔮", "🥊", "🪨", "🐉"];

  return (
    <main
      className="relative min-h-screen overflow-hidden font-[Barlow]"
      style={{ background: `radial-gradient(circle at 50% 40%, #1a1a35 0%, ${C.bg} 70%)` }}
    >
      {/* Giant pokeball motif background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden opacity-[0.05]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[820px] h-[820px] border-[64px] border-white rounded-full" />
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-full h-[64px] bg-white" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-white rounded-full border-[24px]" style={{ borderColor: C.bg }} />
      </div>
      {/* Ambient glows */}
      <div className="pointer-events-none fixed -top-32 -left-32 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ background: `${C.red}33` }} />
      <div className="pointer-events-none fixed -bottom-32 -right-32 w-[28rem] h-[28rem] rounded-full blur-3xl animate-pulse" style={{ background: `${C.blue}2e`, animationDelay: "1s" }} />

      <div className="relative min-h-screen grid lg:grid-cols-2">
        {/* ═══ LEFT: Hero panel ═══ */}
        <section className="relative flex flex-col items-center justify-center px-6 pt-10 pb-4 lg:py-0 overflow-hidden">
          {/* Type icon strip */}
          <div className="flex gap-3 mb-4 lg:mb-6 text-xl lg:text-2xl opacity-80">
            {typeIcons.map((t, i) => (
              <span
                key={i}
                className="inline-block animate-bounce"
                style={{ animationDuration: "3s", animationDelay: `${i * 0.25}s` }}
              >
                {t}
              </span>
            ))}
          </div>

          <h1
            className="font-['Bebas_Neue'] text-6xl lg:text-8xl leading-none tracking-wide text-center select-none"
            style={{
              color: C.yellow,
              WebkitTextStroke: "2px #2a4a8f",
              textShadow: `0 4px 0 #2a4a8f, 0 8px 24px rgba(0,0,0,.6)`,
            }}
          >
            DUELO
            <br />
            POKÉMON
          </h1>
          <p className="mt-3 text-xs lg:text-sm font-bold uppercase tracking-[0.35em] text-white/60">
            Colecione · Treine · Batalhe
          </p>

          {/* Featured pokémon */}
          <div className="relative mt-4 lg:mt-8">
            <div
              className="absolute inset-0 rounded-full blur-2xl scale-90 animate-pulse"
              style={{ background: `radial-gradient(circle, ${C.red}55, transparent 70%)` }}
            />
            <img
              src={charizardImg}
              alt="Charizard"
              className="relative w-40 lg:w-72 drop-shadow-[0_20px_40px_rgba(227,53,13,0.45)] animate-[loginFloat_4s_ease-in-out_infinite]"
            />
          </div>

          {/* Pokeball divider dots */}
          <div className="mt-4 lg:mt-6 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: C.red }} />
            <div className="w-2 h-2 rounded-full" style={{ background: "#334155" }} />
            <div className="w-2 h-2 rounded-full" style={{ background: "#334155" }} />
          </div>
        </section>

        {/* ═══ RIGHT: Auth panel ═══ */}
        <section className="relative flex flex-col items-center justify-center px-4 pb-10 lg:py-10">
          <div className="relative w-full max-w-md">
            {/* Top accent */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-24 h-4 rounded-t-lg blur-[2px] opacity-60" style={{ background: C.red }} />

            <div className="relative rounded-3xl bg-[#14142a]/90 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl" style={{ boxShadow: `0 25px 60px -15px ${C.red}26` }}>
              {/* Tabs */}
              <div className="flex border-b border-white/10">
                <button
                  onClick={() => setMode("signin")}
                  className={`flex-1 py-4 text-sm font-extrabold uppercase tracking-widest transition-all ${
                    mode === "signin" ? "text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                  style={mode === "signin" ? { background: `${C.red}1a`, borderBottom: `3px solid ${C.red}` } : undefined}
                >
                  Entrar
                </button>
                <button
                  onClick={() => setMode("signup")}
                  className={`flex-1 py-4 text-sm font-extrabold uppercase tracking-widest transition-all ${
                    mode === "signup" ? "text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                  style={mode === "signup" ? { background: `${C.yellow}14`, borderBottom: `3px solid ${C.yellow}` } : undefined}
                >
                  Criar Conta
                </button>
              </div>

              <div className="p-6 lg:p-8">
                <div className="mb-6 text-center">
                  <h2 className="font-['Bebas_Neue'] text-3xl tracking-wider text-white">
                    {mode === "signin" ? (
                      <>BEM-VINDO DE VOLTA, <span style={{ color: C.red }}>TREINADOR</span></>
                    ) : (
                      <>COMECE SUA <span style={{ color: C.yellow }}>JORNADA</span></>
                    )}
                  </h2>
                  <p className="text-slate-400 text-[11px] mt-1 uppercase tracking-widest">
                    Prepare-se para a batalha
                  </p>
                </div>

                {errorMsg && (
                  <div role="alert" className="mb-4 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold flex items-start gap-2" style={{ borderColor: `${C.red}99`, background: `${C.red}22`, color: "#fecaca" }}>
                    <span className="text-base leading-none mt-0.5">⚠️</span>
                    <span className="flex-1">{errorMsg}</span>
                    <button type="button" onClick={() => setErrorMsg(null)} className="text-red-200/70 hover:text-white text-xs font-bold">✕</button>
                  </div>
                )}

                <form onSubmit={submit} className="space-y-4">
                  {mode === "signup" && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 ml-1">Nome do Treinador</label>
                      <input
                        value={username} onChange={(e) => setUsername(e.target.value)}
                        placeholder="Seu apelido de treinador"
                        className="w-full bg-black/40 border border-white/10 text-white px-4 py-3 rounded-xl outline-none transition-all placeholder:text-slate-600 focus:ring-4"
                        style={{ ["--tw-ring-color" as string]: `${C.red}1f` }}
                        onFocus={(e) => (e.currentTarget.style.borderColor = `${C.red}80`)}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1.5 ml-1">Identificador do Treinador</label>
                    <input
                      type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      className="w-full bg-black/40 border border-white/10 text-white px-4 py-3 rounded-xl outline-none transition-all placeholder:text-slate-600"
                      onFocus={(e) => (e.currentTarget.style.borderColor = `${C.red}80`)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between items-end mb-1.5 px-1">
                      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500">Código de Acesso</label>
                      {mode === "signin" && (
                        <button
                          type="button"
                          onClick={() => { setForgotEmail(email); setForgotOpen(true); }}
                          className="text-[10px] uppercase font-bold text-slate-500 hover:text-white transition-colors"
                        >
                          Esqueceu?
                        </button>
                      )}
                    </div>
                    <input
                      type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="Senha (mín. 6 caracteres)"
                      className="w-full bg-black/40 border border-white/10 text-white px-4 py-3 rounded-xl outline-none transition-all placeholder:text-slate-600"
                      onFocus={(e) => (e.currentTarget.style.borderColor = `${C.red}80`)}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)")}
                    />
                  </div>

                  <label className="flex items-center gap-2 text-white/70 text-xs cursor-pointer select-none pt-1">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      className="w-4 h-4"
                      style={{ accentColor: C.red }}
                    />
                    Lembrar de mim (entrar automático)
                  </label>

                  <button
                    type="submit" disabled={busy}
                    className="w-full py-4 mt-2 rounded-xl text-white font-extrabold uppercase tracking-widest text-sm shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:brightness-110"
                    style={{
                      background: `linear-gradient(135deg, ${C.red}, #b3230a)`,
                      boxShadow: `0 10px 30px -10px ${C.red}80`,
                    }}
                  >
                    {busy ? "⏳ AGUARDE..." : mode === "signin" ? "⚔️ INICIAR DESAFIO" : "✨ COMEÇAR JORNADA"}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-5">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div>
                  <div className="relative flex justify-center">
                    <span className="px-3 bg-[#14142a] text-[10px] font-bold uppercase tracking-widest text-slate-600">ou</span>
                  </div>
                </div>

                <button
                  type="button" onClick={googleSignIn} disabled={busy}
                  className="w-full py-3 rounded-xl bg-white/95 hover:bg-white text-slate-800 font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
                    <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/>
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"/>
                  </svg>
                  Entrar com Google
                </button>
              </div>
            </div>


            {/* Public legal footer */}
            <footer className="relative mt-6 text-center text-white/50 text-xs">
              <nav className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                <Link to="/terms" className="underline hover:text-white">Termos de Uso</Link>
                <Link to="/privacy" className="underline hover:text-white">Política de Privacidade</Link>
                <Link to="/refunds" className="underline hover:text-white">Política de Reembolso</Link>
              </nav>
              <p className="mt-2 text-white/30 text-[11px]">
                © {new Date().getFullYear()} DUELO POKEMON — Operado por Bruno Henrique Moura Bernardo.
              </p>
            </footer>
          </div>
        </section>
      </div>

      <style>{`
        @keyframes loginFloat {
          0%, 100% { transform: translateY(0) rotate(-2deg); }
          50% { transform: translateY(-14px) rotate(2deg); }
        }
      `}</style>

      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => !forgotBusy && setForgotOpen(false)}>
          <div className="relative w-full max-w-sm rounded-2xl bg-[#14142a] border-2 p-6 shadow-2xl" style={{ borderColor: `${C.red}66` }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-['Bebas_Neue'] text-2xl tracking-wider text-white mb-1 flex items-center gap-2">🔑 ESQUECI MINHA SENHA</h3>
            <p className="text-white/60 text-xs mb-4">Digite seu email e enviaremos um link para redefinir sua senha.</p>
            <form onSubmit={sendReset} className="space-y-3">
              <input
                type="email" required autoFocus value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder:text-slate-600 outline-none transition"
              />
              <div className="flex gap-2">
                <button type="button" onClick={() => setForgotOpen(false)} disabled={forgotBusy} className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={forgotBusy} className="flex-1 py-2.5 rounded-xl text-white font-extrabold text-sm shadow-lg disabled:opacity-50 transition" style={{ background: `linear-gradient(135deg, ${C.red}, #b3230a)` }}>
                  {forgotBusy ? "Enviando..." : "Enviar link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

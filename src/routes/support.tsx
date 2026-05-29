import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Suporte — Arena Pet" },
      { name: "description", content: "Central de suporte do Arena Pet. Tire dúvidas, fale com a gente por email ou no Discord." },
    ],
  }),
  component: SupportPage,
});

const FAQ: { q: string; a: string }[] = [
  {
    q: "Como recupero minha conta?",
    a: "Na tela de login, toque em \"Esqueci minha senha\" e digite o email cadastrado. Você receberá um link para definir uma nova senha. Se não receber, confira a caixa de spam ou entre em contato pelo email abaixo.",
  },
  {
    q: "Como compro gemas?",
    a: "Abra a Loja pelo menu (🏪 Loja) e escolha o pacote de gemas desejado. O pagamento é processado pela App Store. As gemas são creditadas automaticamente após a confirmação.",
  },
  {
    q: "Como funciona o Battle Pass?",
    a: "O Passe de Batalha é uma temporada de recompensas. Você ganha XP de Passe jogando batalhas, expedições e missões diárias. Cada nível libera uma recompensa gratuita; o passe Premium libera recompensas extras por temporada.",
  },
  {
    q: "Não recebi minhas gemas após a compra. O que faço?",
    a: "Feche e abra o app novamente — quase sempre resolve. Se persistir, mande seu email de cadastro e o comprovante da App Store para suporte@arenapet.com que a gente regulariza.",
  },
  {
    q: "Posso jogar em mais de um dispositivo?",
    a: "Sim! Basta fazer login com o mesmo email/senha nos dois aparelhos. Seu progresso é salvo na nuvem.",
  },
  {
    q: "Como excluo minha conta?",
    a: "Vá em Perfil (👤) → role até \"Zona de perigo\" → \"Excluir minha conta\". A exclusão é permanente e apaga todos os seus dados.",
  },
];

function SupportPage() {
  const { profile, loading } = useProfile();
  const [open, setOpen] = useState<number | null>(0);

  if (loading || !profile) {
    return <div className="p-8 text-center text-white">Carregando…</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.25_0.12_290)] via-[oklch(0.18_0.10_310)] to-[oklch(0.22_0.14_260)]">
      <HUD profile={profile} />
      <main
        className="max-w-2xl mx-auto p-4 space-y-4"
        style={{ paddingBottom: "calc(8rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-2">
          <Link to="/" className="text-white/70 hover:text-white text-xs">← Voltar</Link>
        </div>

        <div className="rounded-3xl bg-[oklch(0.18_0.06_290)]/90 backdrop-blur-xl border-2 border-fuchsia-400/30 p-6 shadow-2xl">
          <h1 className="text-2xl font-extrabold text-white mb-1 flex items-center gap-2">
            <span>💬</span> Suporte Arena Pet
          </h1>
          <p className="text-white/60 text-sm">
            Tá com alguma dúvida ou problema? A gente tá aqui pra ajudar.
          </p>
        </div>

        {/* Canais de contato */}
        <div className="grid sm:grid-cols-2 gap-3">
          <a
            href="mailto:suporte@arenapet.com"
            className="rounded-2xl bg-[oklch(0.18_0.06_290)]/90 backdrop-blur-xl border-2 border-cyan-400/30 p-5 shadow-2xl hover:border-cyan-300 transition group"
          >
            <div className="text-3xl mb-2">📧</div>
            <div className="text-white font-extrabold text-sm mb-1">Email</div>
            <div className="text-cyan-300 text-sm font-bold group-hover:underline break-all">
              suporte@arenapet.com
            </div>
            <div className="text-white/50 text-xs mt-1">Resposta em até 48h úteis</div>
          </a>

          <a
            href="https://discord.gg/C4bsUaWhxq"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-2xl bg-[oklch(0.18_0.06_290)]/90 backdrop-blur-xl border-2 border-indigo-400/30 p-5 shadow-2xl hover:border-indigo-300 transition group"
          >
            <div className="text-3xl mb-2">💬</div>
            <div className="text-white font-extrabold text-sm mb-1">Discord</div>
            <div className="text-indigo-300 text-sm font-bold group-hover:underline">
              Entrar no servidor
            </div>
            <div className="text-white/50 text-xs mt-1">Comunidade + suporte rápido</div>
          </a>
        </div>

        {/* FAQ */}
        <div className="rounded-3xl bg-[oklch(0.18_0.06_290)]/90 backdrop-blur-xl border-2 border-amber-400/30 p-6 shadow-2xl">
          <h2 className="text-lg font-extrabold text-white mb-1 flex items-center gap-2">
            ❓ Perguntas frequentes
          </h2>
          <p className="text-white/60 text-xs mb-4">
            Confira aqui antes de mandar email — sua dúvida pode já estar respondida.
          </p>

          <div className="space-y-2">
            {FAQ.map((item, i) => {
              const isOpen = open === i;
              return (
                <div
                  key={i}
                  className="rounded-xl bg-black/30 border border-white/10 overflow-hidden"
                >
                  <button
                    onClick={() => setOpen(isOpen ? null : i)}
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-white/5 transition"
                  >
                    <span className="text-white font-bold text-sm">{item.q}</span>
                    <span className={`text-white/60 text-lg transition-transform ${isOpen ? "rotate-180" : ""}`}>
                      ⌄
                    </span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 text-white/80 text-sm leading-relaxed border-t border-white/10 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-black/20 border border-white/10 p-4 text-center">
          <p className="text-white/60 text-xs">
            Ainda precisa de ajuda? Mande um email pra{" "}
            <a href="mailto:suporte@arenapet.com" className="text-cyan-300 font-bold hover:underline">
              suporte@arenapet.com
            </a>{" "}
            com o seu nick e o que aconteceu — a gente responde rapidinho. 💜
          </p>
        </div>
      </main>
    </div>
  );
}

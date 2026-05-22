import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/novidades")({
  component: NovidadesPage,
  head: () => ({
    meta: [
      { title: "Novidades — Arena Pet" },
      { name: "description", content: "Confira as novidades e o que vem por aí no Arena Pet." },
    ],
  }),
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-purple-900/40 border-2 border-purple-400/30 p-5 space-y-3 shadow-lg">
      <h2 className="text-xl sm:text-2xl font-extrabold text-yellow-300">{title}</h2>
      <ul className="text-white/90 text-sm sm:text-base leading-relaxed space-y-2">
        {children}
      </ul>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="text-yellow-300 flex-shrink-0">•</span>
      <span>{children}</span>
    </li>
  );
}

function NovidadesPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-950 via-indigo-950 to-slate-950 text-white px-4 py-6 pb-28">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-white/70 hover:text-white text-sm">← Home</Link>
        </div>

        <header className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold">📢 Novidades</h1>
          <p className="text-white/70 text-sm">Fique por dentro do que tem de novo e do que está por vir!</p>
        </header>

        <Section title="🎉 Bem vindo ao Arena Pet!">
          <Bullet>Colete pets, monte seu time e batalhe contra jogadores do mundo todo</Bullet>
          <Bullet><b>Sistema de sinergias</b> — monte comps com categorias e ganhe buffs</Bullet>
          <Bullet><b>Copa</b>, <b>Ranking com Seasons</b> e recompensas exclusivas</Bullet>
          <Bullet><b>Passe de batalha</b> com recompensas diárias</Bullet>
          <Bullet><b>Sistema de amigos</b> — adicione amigos, mande mensagens e desafie para batalhas</Bullet>
        </Section>

        <Section title="👀 Em Breve">
          <Bullet>🦏 <b>Rinoceronte Guardião</b> — remove debuffs do time</Bullet>
          <Bullet>🐘 <b>Elefante Ancestral</b> — imune a todo CC</Bullet>
          <Bullet>🦧 <b>Orangotango Guardião</b> — completa o trio dos primatas</Bullet>
          <Bullet>🐋 <b>Baleia Leviatã</b> — completa o trio abissal</Bullet>
          <Bullet>⚔️ <b>Times de 4 pets</b> — quem sabe... 👀</Bullet>
        </Section>
      </div>
    </main>
  );
}

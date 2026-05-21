import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/dicas")({
  component: DicasPage,
  head: () => ({
    meta: [
      { title: "Dicas — Arena Pet" },
      { name: "description", content: "Aprenda os melhores truques e estratégias do Arena Pet." },
    ],
  }),
});

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-purple-900/40 border-2 border-purple-400/30 p-5 space-y-3 shadow-lg">
      <h2 className="text-xl sm:text-2xl font-extrabold text-yellow-300">{title}</h2>
      <div className="text-white/90 text-sm sm:text-base leading-relaxed space-y-2">
        {children}
      </div>
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

function DicasPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-purple-950 via-indigo-950 to-slate-950 text-white px-4 py-6 pb-28">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-white/70 hover:text-white text-sm">← Home</Link>
        </div>

        <header className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-extrabold">💡 Dicas do Arena Pet</h1>
          <p className="text-white/70 text-sm">Tudo o que você precisa saber para dominar a arena!</p>
        </header>

        <Section title="🐣 Seção 1 — Primeiros Passos">
          <ul className="space-y-2">
            <Bullet>Abra baús para conseguir seus primeiros pets</Bullet>
            <Bullet>Monte um time de 3 pets</Bullet>
            <Bullet>Posicione <b>Tank na Frente</b>, <b>DPS no Meio</b>, <b>Healer/Mago atrás</b></Bullet>
            <Bullet>Treine seus pets todo dia para ficarem mais fortes</Bullet>
            <Bullet>Participe de batalhas para ganhar moedas e gems</Bullet>
            <Bullet>Participe da <b>Copa</b> — é onde você ganha mais gems rapidamente! Seja campeão e ganhe recompensas exclusivas 🏆</Bullet>
            <Bullet>Os melhores colocados de cada <b>Season</b> ganham prêmios exclusivos! A Season fica na aba de <b>Ranking</b> — quanto mais você batalha e sobe de tier, mais perto está das recompensas do topo! 🏆</Bullet>
          </ul>
        </Section>

        <Section title="🎭 Seção 2 — Entendendo os Roles">
          <ul className="space-y-2">
            <Bullet>🛡️ <b>Tank</b> — aguenta dano na frente, provoca inimigos</Bullet>
            <Bullet>⚔️ <b>DPS</b> — causa dano alto e consistente</Bullet>
            <Bullet>🗡️ <b>Assassino</b> — mata o inimigo mais fraco primeiro</Bullet>
            <Bullet>🔮 <b>Mago</b> — dano mágico que ignora defesa</Bullet>
            <Bullet>✨ <b>Healer</b> — cura o time a cada 2 turnos</Bullet>
          </ul>
        </Section>

        <Section title="💡 Seção 3 — Sinergias">
          <ul className="space-y-2">
            <Bullet>Ter <b>2 pets</b> da mesma categoria dá <b>+5%</b> no atributo</Bullet>
            <Bullet>Ter <b>3 pets</b> da mesma categoria dá <b>+10%</b> no atributo</Bullet>
            <Bullet>Exemplo: <b>3 Felinos</b> = +10% crit chance pra todo o time</Bullet>
          </ul>
        </Section>

        <Section title="⚔️ Seção 4 — Exemplo de Comp: Gelo ❄️">
          <p className="font-bold text-cyan-300">Urso Polar + Lobo Ártico + Foca Glacial</p>
          <p>
            <b>Objetivo:</b> Urso congela inimigos com 50% de chance em todo ataque,
            Lobo critica os mais fracos, Foca cura e reduz ATK do inimigo mais forte.
          </p>
          <p>
            Inimigos ficam alternando entre <b>congelados</b> e com <b>ATK reduzido</b> —
            muito difícil de matar.
          </p>
          <p className="text-cyan-200">
            <b>Sinergia:</b> 3× Gelo = <b>+10% DEF</b> pra todo o time
          </p>
        </Section>

        <Section title="💪 Seção 5 — Dicas de Treino">
          <p>Treine o stat principal do role do seu pet:</p>
          <ul className="space-y-2">
            <Bullet>🛡️ <b>Tank</b> → HP e DEF</Bullet>
            <Bullet>⚔️ <b>DPS</b> → ATK</Bullet>
            <Bullet>🗡️ <b>Assassino</b> → ATK e SPD</Bullet>
            <Bullet>🔮 <b>Mago</b> → INT</Bullet>
            <Bullet>✨ <b>Healer</b> → INT e HP</Bullet>
          </ul>
          <p className="text-white/80 italic">
            Cada pet tem limite de treinos baseado no rank — eleve para desbloquear mais!
          </p>
        </Section>

        <Section title="💎 Seção 6 — Como Conseguir Pets Melhores">
          <ul className="space-y-2">
            <Bullet>Abra baús diariamente</Bullet>
            <Bullet>Complete <b>expedições</b> para ganhar recompensas</Bullet>
            <Bullet>Participe da <b>Copa</b> — campeões ganham gems em grande quantidade 🏆</Bullet>
            <Bullet>Fique de olho nos eventos da <b>loja</b> para pets exclusivos</Bullet>
            <Bullet>Os melhores colocados de cada <b>Season</b> ganham prêmios exclusivos! A Season fica na aba de <b>Ranking</b> — quanto mais você batalha e sobe de tier, mais perto está das recompensas do topo! 🏆</Bullet>
          </ul>
        </Section>

        <div className="text-center pt-4">
          <Link
            to="/arena"
            className="inline-block px-6 py-3 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-purple-950 font-extrabold shadow-lg transition"
          >
            ⚔️ Ir para a Arena
          </Link>
        </div>
      </div>
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/refunds")({
  component: RefundsPage,
  head: () => ({
    meta: [
      { title: "Política de Reembolso — Arena Pet" },
      { name: "description", content: "Como funciona o reembolso de compras no Arena Pet." },
    ],
  }),
});

function RefundsPage() {
  return (
    <main className="min-h-screen bg-slate-900 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-4">
        <Link to="/" className="text-white/70 hover:text-white text-sm">← Home</Link>
        <h1 className="text-3xl font-extrabold">Política de Reembolso</h1>
        <p className="text-sm opacity-70">Última atualização: 21 de maio de 2026</p>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-xl font-bold mt-4">Garantia de 30 dias</h2>
          <p>
            Oferecemos garantia de reembolso de <b>30 dias</b> a partir da data da compra.
            Se você não estiver satisfeito com sua aquisição de gemas ou do Passe VIP no
            Arena Pet, pode solicitar reembolso integral dentro desse prazo.
          </p>

          <h2 className="text-xl font-bold mt-4">Como solicitar</h2>
          <p>
            Os reembolsos são processados pelo nosso parceiro de pagamento{" "}
            <b>Paddle.com</b>, que é a Comerciante Registrada de todas as compras. Para
            solicitar:
          </p>
          <ol className="list-decimal pl-6 space-y-1">
            <li>
              Acesse{" "}
              <a
                href="https://paddle.net"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-fuchsia-300"
              >
                paddle.net
              </a>{" "}
              e informe o e-mail usado na compra.
            </li>
            <li>Selecione a transação que deseja reembolsar.</li>
            <li>Solicite o reembolso explicando brevemente o motivo.</li>
          </ol>
          <p>
            Você também pode falar com nosso suporte pelos canais oficiais do Arena Pet no
            app, que encaminhará seu pedido à Paddle.
          </p>

          <h2 className="text-xl font-bold mt-4">Prazo de processamento</h2>
          <p>
            Após aprovação, o estorno aparece em sua fatura/conta em até 5 a 10 dias úteis,
            dependendo da operadora do cartão ou meio de pagamento usado.
          </p>

          <h2 className="text-xl font-bold mt-4">Itens já consumidos</h2>
          <p>
            Caso o reembolso seja aprovado e as gemas já tenham sido gastas no jogo (em
            baús, skins, recargas de energia, torneios, etc.), o saldo correspondente pode
            ser deduzido da sua conta. Itens consumíveis usados não podem ser restaurados.
          </p>

          <h2 className="text-xl font-bold mt-4">Compras fraudulentas</h2>
          <p>
            Se você identificar uma compra que não reconhece, solicite o reembolso pela
            Paddle imediatamente. Casos de fraude são tratados em parceria com a Paddle.
          </p>

          <h2 className="text-xl font-bold mt-4">Contato</h2>
          <p>
            Dúvidas sobre reembolsos: pelo{" "}
            <a
              href="https://paddle.net"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-fuchsia-300"
            >
              paddle.net
            </a>{" "}
            ou pelos canais oficiais do Arena Pet no app.
          </p>
        </section>
      </div>
    </main>
  );
}

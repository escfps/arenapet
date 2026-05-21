import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso — Arena Pet" },
      { name: "description", content: "Termos e condições de uso do Arena Pet." },
    ],
  }),
});

function TermsPage() {
  return (
    <main className="min-h-screen bg-slate-900 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-4">
        <Link to="/" className="text-white/70 hover:text-white text-sm">← Home</Link>
        <h1 className="text-3xl font-extrabold">Termos de Uso</h1>
        <p className="text-sm opacity-70">Última atualização: 21 de maio de 2026</p>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-xl font-bold mt-4">1. Sobre o vendedor</h2>
          <p>
            O <b>ARENA PET</b> é operado por Bruno Henrique Moura Bernardo (pessoa física),
            domiciliado no Brasil ("nós", "vendedor"). Ao utilizar o serviço, você aceita
            integralmente estes Termos. Caso não concorde, não utilize o serviço.
          </p>

          <h2 className="text-xl font-bold mt-4">2. Descrição do serviço</h2>
          <p>
            O Arena Pet é um jogo digital online com sistema de batalhas, coleção de pets,
            torneios e itens cosméticos. O acesso é feito via navegador mediante cadastro.
          </p>

          <h2 className="text-xl font-bold mt-4">3. Cadastro e conta</h2>
          <p>
            Você deve fornecer informações verdadeiras e manter a confidencialidade do seu
            login. É responsável por toda atividade realizada em sua conta. Se for menor de
            idade, deve usar o serviço com supervisão do responsável legal.
          </p>

          <h2 className="text-xl font-bold mt-4">4. Uso aceitável</h2>
          <p>Você concorda em não:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>usar o serviço para qualquer finalidade ilegal, fraudulenta ou abusiva;</li>
            <li>tentar burlar, descompilar ou interferir na segurança do sistema;</li>
            <li>usar bots, scrapers ou automações não autorizadas;</li>
            <li>violar direitos de propriedade intelectual de terceiros;</li>
            <li>comercializar contas, gemas ou itens fora das plataformas oficiais.</li>
          </ul>

          <h2 className="text-xl font-bold mt-4">5. Propriedade intelectual</h2>
          <p>
            Todo o conteúdo do Arena Pet (código, arte, sons, marca, personagens) é de
            propriedade do vendedor. É concedida ao jogador apenas uma licença pessoal,
            limitada, não exclusiva e intransferível para uso do serviço.
          </p>

          <h2 className="text-xl font-bold mt-4">6. Pagamentos e moeda virtual</h2>
          <p>
            Compras de gemas e do Passe VIP são processadas pelo nosso revendedor online
            Paddle.com, que é o <b>Comerciante Registrado (Merchant of Record)</b> de todos
            os pedidos. A Paddle cuida da cobrança, dos impostos, das faturas e do
            atendimento relacionado a pagamentos e devoluções. Os termos do comprador da
            Paddle se aplicam:{" "}
            <a
              href="https://www.paddle.com/legal/checkout-buyer-terms"
              target="_blank"
              rel="noopener noreferrer"
              className="underline text-fuchsia-300"
            >
              Buyer Terms da Paddle
            </a>.
          </p>
          <p>
            As gemas são itens virtuais sem valor monetário fora do jogo, não podem ser
            convertidas em dinheiro e não são transferíveis entre contas.
          </p>

          <h2 className="text-xl font-bold mt-4">7. Reembolsos</h2>
          <p>
            Reembolsos seguem nossa{" "}
            <Link to="/refunds" className="underline text-fuchsia-300">
              Política de Reembolso
            </Link>
            .
          </p>

          <h2 className="text-xl font-bold mt-4">8. Suspensão e encerramento</h2>
          <p>
            Podemos suspender ou encerrar contas que violem estes Termos, apresentem risco
            de fraude/segurança, façam mau uso do serviço ou deixem de pagar valores
            devidos. Contas encerradas perdem acesso a itens, moedas e progresso.
          </p>

          <h2 className="text-xl font-bold mt-4">9. Disponibilidade do serviço</h2>
          <p>
            Nos esforçamos para manter o serviço disponível, mas não garantimos
            funcionamento ininterrupto ou livre de erros. Podemos alterar, suspender ou
            descontinuar funcionalidades a qualquer momento.
          </p>

          <h2 className="text-xl font-bold mt-4">10. Limitação de responsabilidade</h2>
          <p>
            Na máxima extensão permitida por lei, o vendedor não responde por danos
            indiretos, lucros cessantes, perda de dados ou perda de itens virtuais. A
            responsabilidade total fica limitada ao valor pago nos últimos 6 meses.
          </p>

          <h2 className="text-xl font-bold mt-4">11. Lei aplicável</h2>
          <p>
            Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro do domicílio
            do vendedor para dirimir controvérsias, salvo direito do consumidor em
            contrário.
          </p>

          <h2 className="text-xl font-bold mt-4">12. Contato</h2>
          <p>
            Dúvidas sobre estes Termos: entre em contato pelos canais oficiais do Arena Pet
            no app.
          </p>
        </section>
      </div>
    </main>
  );
}

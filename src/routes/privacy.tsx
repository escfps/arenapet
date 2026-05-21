import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade — Arena Pet" },
      { name: "description", content: "Como o Arena Pet coleta e trata seus dados pessoais." },
    ],
  }),
});

function PrivacyPage() {
  return (
    <main className="min-h-screen bg-slate-900 text-white px-4 py-10">
      <div className="max-w-3xl mx-auto space-y-4">
        <Link to="/" className="text-white/70 hover:text-white text-sm">← Home</Link>
        <h1 className="text-3xl font-extrabold">Política de Privacidade</h1>
        <p className="text-sm opacity-70">Última atualização: 21 de maio de 2026</p>

        <section className="space-y-3 text-sm leading-relaxed">
          <h2 className="text-xl font-bold mt-4">1. Controlador dos dados</h2>
          <p>
            <b>Bruno Henrique Moura Bernardo</b>, pessoa física, é o controlador dos dados
            pessoais coletados pelo Arena Pet, conforme a Lei Geral de Proteção de Dados
            (LGPD - Lei 13.709/2018).
          </p>

          <h2 className="text-xl font-bold mt-4">2. Dados que coletamos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><b>Cadastro:</b> nome de usuário, e-mail, senha (criptografada).</li>
            <li><b>Uso:</b> progresso no jogo, batalhas, itens, moedas e gemas.</li>
            <li><b>Técnicos:</b> endereço IP, identificadores de dispositivo, logs de acesso.</li>
            <li><b>Suporte:</b> mensagens enviadas a nós para atendimento.</li>
          </ul>
          <p>
            Dados de pagamento (cartão, endereço de cobrança, CPF para nota fiscal) são
            coletados <b>diretamente pela Paddle.com</b>, nossa Comerciante Registrada, e
            não trafegam pelos nossos servidores.
          </p>

          <h2 className="text-xl font-bold mt-4">3. Finalidades e base legal</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Criar e manter sua conta (execução de contrato).</li>
            <li>Operar o jogo, ranking, torneios e batalhas (execução de contrato).</li>
            <li>Processar pagamentos via Paddle (execução de contrato).</li>
            <li>Prevenir fraude, abuso e proteger a integridade do serviço (legítimo interesse).</li>
            <li>Cumprir obrigações legais e fiscais (obrigação legal).</li>
            <li>Melhorar o produto com base em métricas agregadas (legítimo interesse).</li>
          </ul>

          <h2 className="text-xl font-bold mt-4">4. Com quem compartilhamos</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><b>Paddle.com</b> — Comerciante Registrada (cobrança, impostos, faturas, reembolsos).</li>
            <li><b>Provedores de infraestrutura</b> — hospedagem, banco de dados, autenticação.</li>
            <li><b>Autoridades</b> — quando exigido por lei ou ordem judicial.</li>
          </ul>
          <p>Não vendemos seus dados pessoais.</p>

          <h2 className="text-xl font-bold mt-4">5. Retenção</h2>
          <p>
            Mantemos seus dados enquanto sua conta estiver ativa. Após o encerramento, os
            dados são deletados ou anonimizados em até 90 dias, salvo quando a lei exigir
            retenção maior (ex.: registros fiscais).
          </p>

          <h2 className="text-xl font-bold mt-4">6. Seus direitos (LGPD)</h2>
          <p>Você pode, a qualquer momento, solicitar:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>confirmação e acesso aos seus dados;</li>
            <li>correção de dados incompletos ou desatualizados;</li>
            <li>anonimização, bloqueio ou eliminação;</li>
            <li>portabilidade;</li>
            <li>revogação do consentimento;</li>
            <li>informações sobre compartilhamentos.</li>
          </ul>
          <p>
            Para exercer seus direitos, entre em contato pelos canais oficiais do Arena Pet
            no app. Responderemos em até 15 dias.
          </p>

          <h2 className="text-xl font-bold mt-4">7. Segurança</h2>
          <p>
            Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo
            criptografia em trânsito (HTTPS), criptografia de senhas e controles de acesso.
            Nenhum sistema é 100% seguro, mas trabalhamos para minimizar riscos.
          </p>

          <h2 className="text-xl font-bold mt-4">8. Cookies</h2>
          <p>
            Usamos cookies essenciais para manter sua sessão. Não utilizamos cookies de
            marketing de terceiros no momento.
          </p>

          <h2 className="text-xl font-bold mt-4">9. Crianças</h2>
          <p>
            O serviço não é direcionado a crianças menores de 13 anos. Menores devem usar o
            serviço com supervisão e consentimento de responsável legal.
          </p>

          <h2 className="text-xl font-bold mt-4">10. Contato</h2>
          <p>
            Dúvidas sobre privacidade: entre em contato pelos canais oficiais do Arena Pet
            no app.
          </p>
        </section>
      </div>
    </main>
  );
}

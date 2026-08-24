# Blindagem de segurança da economia

## O problema (confirmado na auditoria)

Hoje o jogo é "cliente-autoritativo": o navegador do jogador tem permissão de escrever
diretamente nas tabelas de economia. As regras de acesso atuais dizem apenas
"você pode editar a sua própria linha" — sem limitar **quais campos** nem **quais valores**.

Isso significa que qualquer pessoa com o console do navegador aberto consegue, em segundos:

- Definir diamantes, moedas, XP, nível, pontos de arena, vitórias e VIP para qualquer número.
- Criar pokémons do nada, em qualquer espécie, raridade, ⭐10, shiny, com stats máximos.
- Encher o inventário de baús, rações e insígnias.
- Abrir baús "de graça" (o desconto e o prêmio são calculados no navegador).
- Ganhar recompensa de batalha sem batalhar (o resultado é enviado pelo cliente).

Foi exatamente por isso que seu amigo conseguiu se encher de diamantes em 10 minutos.
Nenhum ajuste de tela resolve: a correção precisa mover as decisões da economia
para o servidor e **remover a permissão de escrita direta do navegador**.

## Estratégia

Toda a economia passa a ser decidida no servidor (funções protegidas por login),
e o banco passa a **bloquear** alterações nesses campos vindas do jogador.
O cliente só lê e pede ações; quem calcula prêmio, preço e resultado é o servidor.

### Fase 1 — Travas no banco (impede o hack imediatamente)
- Bloquear no banco qualquer alteração feita pelo jogador em: moedas, diamantes, XP,
  nível, pontos de arena, vitórias/derrotas, VIP, contadores de pity e campos de passe.
- Bloquear criação/edição direta de pokémons pelo jogador (espécie, ⭐, stats, shiny),
  liberando só o que é cosmético/organizacional (nome, posição no time).
- Bloquear escrita direta em inventário e insígnias.
- Manter leitura normal para tudo (o jogo continua mostrando os dados).

### Fase 2 — Ações movidas para o servidor
Cada fluxo abaixo ganha uma função de servidor que valida saldo, cooldown e regras,
aplica o resultado e devolve o que aconteceu para a tela:
- Loja: comprar baú (moeda/diamante), abrir baú do inventário, comprar ovo/inicial,
  recarga de energia, compra de skin.
- Arena: registrar resultado de batalha, pontos de arena, XP/nível, prêmios de promoção.
- Pokémon: treinar stats, resetar treinos, alimentar (consumo de ração).
- Forja: fusão/evolução (consome o pokémon e sobe ⭐, preservando shiny).
- Expedições: iniciar e coletar recompensa.
- Ginásios: consumo das 5 insígnias, resultado do desafio, drop de insígnia, prêmio diário.
- Baú de código resgatado e baú de boas-vindas.
- Sorteio de baú e sorteio de shiny passam a rodar **só no servidor** (o cliente
  apenas anima o resultado recebido).

### Fase 3 — Verificação da batalha no servidor
O resultado do combate passa a ser recalculado no servidor a partir dos times
(mesma lógica de batalha já existente), então "ganhei" enviado pelo cliente
deixa de valer. Sem isso, dá para farmar vitória infinita mesmo com a Fase 1.

### Fase 4 — Revisão final
- Rodar o scanner de segurança e o linter do banco e corrigir o que sobrar.
- Revisar o painel admin (hoje liberado por lista fixa de IDs) e trocar por
  papel de admin em tabela própria.
- Conferir mercado, presentes e trocas (já são server-side) contra saldo negativo
  e duplicação de item.

## Detalhes técnicos

- Travas implementadas como triggers `BEFORE UPDATE/INSERT` em `profiles`, `monsters`,
  `inventory`, `gym_badges`, comparando `current_user`/role: `service_role` e funções
  `SECURITY DEFINER` passam, `authenticated` é rejeitado nas colunas sensíveis.
- Ações novas em `src/lib/economy.functions.ts`, `battles.functions.ts` e
  `gyms.functions.ts` usando `createServerFn` + `requireSupabaseAuth`, escrevendo
  com o cliente admin após validação.
- Sorteios (`rollChest`, chance de shiny, `rollArenaPoints`, `rollLevelUpRewards`)
  movidos para módulos `.server`/handlers; o cliente recebe o resultado.
- Recompensa de batalha exige um "token de partida" criado no servidor no início
  do combate, para impedir replay do mesmo resultado.

## Ordem de entrega

Fase 1 + Fase 2 precisam sair juntas (a trava quebra os fluxos antigos, as funções
novas os restauram). Fase 3 e 4 vêm na sequência.

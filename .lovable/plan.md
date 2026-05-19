## Objetivo

Trocar a Copa Pet do modelo "simulado tudo de uma vez" para **partidas reais, rodada por rodada**, com batalha animada (mesma da arena), espectador opcional e troféu visível.

## Como vai funcionar (regras)

- xx:00, xx:10, xx:20... → abre inscrição (1 minuto, 1 💎)
- Em xx:01, xx:11... → fecha inscrição, bots completam até 32, sorteio do chaveamento
- A **rodada 1 (oitavas)** começa imediatamente. Cada rodada dura **90 segundos**:
  - Partidas bot-vs-bot são resolvidas no servidor na hora (com `simulateBattle`, gera log salvo)
  - Sua partida abre uma tela de batalha animada (mesma UI da arena)
  - Se você não jogar em 90s → perde por W.O. (vencedor: oponente)
  - Se você terminar antes → pode **assistir** a animação de qualquer outra partida em andamento da mesma rodada, ou só esperar
- Quando o timer da rodada expira, todas as partidas sem vencedor são resolvidas por W.O. e a próxima rodada começa
- Final → campeão definido, troféu 🏆 aparece com o nome dele no topo da tabela "Última Copa" e no Hall dos Campeões

## Mudanças no banco

`tournaments`:
- novas colunas `current_round int default 0`, `round_started_at timestamptz null`, `round_duration_seconds int default 90`
- status passa a ter mais estados: `open` → `in_progress` → `finished`

`tournament_matches`:
- novas colunas `status text default 'pending'` (pending | in_progress | done), `log jsonb null`, `played_at timestamptz null`

Funções novas/atualizadas:
- `close_tournament_registration(uuid)` → completa com bots, sorteia bracket, cria todas as 16 partidas da rodada 1 com `status='pending'`, marca tournament como `in_progress`, `current_round=1`, `round_started_at=now()`
- `report_match_result(match_id, winner_id, log_json)` → salva resultado, valida que o caller é dono de um dos lados ou que é a função interna (security definer)
- `advance_tournament_round(uuid)` → quando todas as partidas da rodada têm vencedor OU expirou os 90s, resolve as restantes (W.O. para quem não jogou, ou simula bot-vs-bot), cria a próxima rodada, ou marca campeão se foi a final
- `tournaments_tick()` (já existe, atualizar): para cada torneio
  - se `status='open'` e passou de slot+60s → chama `close_tournament_registration`
  - se `status='in_progress'` e `round_started_at + 90s <= now()` → chama `advance_tournament_round`
  - garante próximo slot

Cron já está rodando a cada minuto. Para reagir mais rápido (90s não bate certo com tick de 60s), também chamamos o tick via uma server function quando o frontend detecta que a rodada deveria ter avançado (best-effort).

## Mudanças no frontend (`src/routes/tournament.tsx`)

Estados do torneio mostram telas diferentes:

1. **status `open` (inscrição)** — igual hoje
2. **status `in_progress`** — substitui a tela atual por:
   - Cabeçalho com rodada atual ("Oitavas de Final"), countdown da rodada (90s)
   - Se eu tenho partida pendente nesta rodada e não joguei: **botão grande "▶ Jogar minha partida"** → abre `<BattleScene>` no modo arena, ao terminar chama `report_match_result` com o log
   - Se já joguei (ganhei ou perdi): bloco "✅ Você venceu / ❌ Eliminado" + lista das outras partidas em andamento com botão "👁 Assistir" em cada uma (reproduz o log salvo no `BattleScene`)
   - Mini chaveamento do torneio atual, atualizado em real-time (polling 3s)
3. **status `finished`** — mostra 🏆 troféu animado com nome do campeão no topo + bracket completo

Bots vs bots resolvem com `simulateBattle` no servidor SQL? Não dá — `simulateBattle` é JS. Solução: bots vs bots ficam com vencedor sorteado por peso de power (igual hoje) + log "[bot] resolvido automaticamente", e quem clica "Assistir" numa partida de bot vê uma animação curta com pets random. Para partidas com player envolvido, o log real do `simulateBattle` é gravado e qualquer espectador vê a animação verdadeira.

## Arquivos a tocar

- migration: alterar tabelas + reescrever `run_tournament`/`tournaments_tick` + novas funções RPC
- `src/routes/tournament.tsx`: refatorar completamente a aba "current" + nova UI de batalha/espectador
- novo componente `src/components/TournamentBattle.tsx`: wrapper do `BattleScene` que sabe carregar times pelos `user_id` dos jogadores da partida
- `src/lib/battle.ts`: já tem `simulateBattle` e tipos — reutilizar sem mudar

## Detalhes técnicos

- O `BattleScene` já é reutilizável (recebe `log` + nomes dos times). Para a partida do jogador, rodamos `simulateBattle` no cliente assim que ele clica em "Jogar", mostramos a animação, e ao final salvamos o `log` no `tournament_matches.log` via RPC `report_match_result`
- Para espectador: lemos `tournament_matches.log` (jsonb) e passamos pro `BattleScene`
- Polling: enquanto status='in_progress', `tournament.tsx` puxa matches a cada 3s para descobrir novos resultados/rodada
- Recompensas do campeão (Baú de Ouro): exatamente como já está hoje, aplicado no `advance_tournament_round` quando determina o campeão da final

## O que NÃO entra neste plano

- Sincronização perfeita "live" entre espectadores e o jogador (com WebSocket/realtime). A animação que o espectador vê é a reprodução do log já gravado, então só aparece depois que a partida do jogador termina
- Pausar/retomar partidas. Se você fechar a aba no meio, perde por W.O. quando o timer estourar
- Replay das copas anteriores em vídeo. A aba "Última Copa" continua mostrando só o bracket+placares

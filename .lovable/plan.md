# Sistema de Fusão (Rank ✦1-10) + Trocas entre Jogadores

Combinando com o sistema de raridade/skills planejado anteriormente.

---

## Parte 1 — Rank por Fusão (✦1 a ✦10)

### Conceito
Separado do `level` (XP de batalha). Cada bichinho tem um **rank ✦** que só sobe **fundindo 2 da mesma espécie no mesmo rank**.

```
2x Flarepup ✦1  →  1x Flarepup ✦2
2x Flarepup ✦2  →  1x Flarepup ✦3
...
2x Flarepup ✦9  →  1x Flarepup ✦10   (precisa de 512 ✦1 no total!)
```

Curva de raridade exponencial (2^9 = 512 bichinhos base pra um ✦10).

### Multiplicador de stats por rank
```
✦1=1.00  ✦2=1.10  ✦3=1.22  ✦4=1.36  ✦5=1.52
✦6=1.70  ✦7=1.90  ✦8=2.13  ✦9=2.40  ✦10=2.70
```
Combina com rarity × level: `base × rarityMult × rankMult × levelMult`.

### Regras de fusão
- Mesma **espécie exata** (Flarepup só funde com Flarepup)
- Mesmo **rank exato**
- O monstro resultante **preserva o de maior level XP** dos dois, soma 30% do XP do outro
- Bloqueia fusão se algum dos 2 estiver no time (precisa tirar do time antes)
- Sem custo de moedas (a raridade já é o custo)

### UI
- Nova aba/rota `/forge` (Forja) — lista bichinhos agrupados por espécie+rank, mostra pares fundíveis com botão "Fundir ✦N → ✦N+1"
- Badge ✦N no MonsterCard (acima do nome)
- Coleção (`/collection`) mostra o ✦ máximo já alcançado por espécie

### DB
```sql
ALTER TABLE monsters ADD COLUMN rank int NOT NULL DEFAULT 1;
-- CHECK via trigger: 1 ≤ rank ≤ 10
```

---

## Parte 2 — Trocas Diretas entre Jogadores

### Fluxo (1↔1 com taxa)
1. Player A vai em `/trade` e cria oferta: escolhe 1 monstro próprio + ID/username do destinatário + monstro alvo (opcional sugestão)
2. Player B recebe notificação na home, abre a oferta, escolhe 1 monstro próprio para dar em troca
3. Ambos confirmam → **taxa de 50 moedas + 5 gemas de cada lado** → troca atômica via server function

### Restrições
- Monstro não pode estar no time
- Não pode trocar lendários (mas pode trocar puros/mestiços)
- Não pode trocar ✦8+ (a raridade é alta demais)
- Cooldown de 24h entre trocas com o mesmo parceiro (anti-farm)
- Ambos jogadores precisam confirmar — auto-cancela em 24h

### DB
```sql
CREATE TABLE trades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL,
  to_user_id uuid NOT NULL,
  from_monster_id uuid NOT NULL REFERENCES monsters(id) ON DELETE CASCADE,
  to_monster_id uuid REFERENCES monsters(id) ON DELETE CASCADE, -- null até B aceitar
  status text NOT NULL DEFAULT 'pending', -- pending | accepted | completed | cancelled
  from_confirmed boolean NOT NULL DEFAULT false,
  to_confirmed boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
-- RLS: ver apenas trades onde sou from ou to
```

### Server functions (em `src/lib/trades.functions.ts`)
- `createTrade({ toUsername, fromMonsterId })`
- `respondToTrade({ tradeId, withMonsterId })` — B escolhe seu monstro
- `confirmTrade({ tradeId })` — quando ambos confirmam, executa swap atômico (atualiza `owner_id`, debita taxa de ambos)
- `cancelTrade({ tradeId })`
- `listMyTrades()` — pendentes + histórico

### UI
- Nova rota `/trade` com tabs: **Receber** (ofertas pendentes pra mim) / **Enviar** (minhas ofertas) / **Histórico**
- Botão "Propor troca" → modal que pega username e seleciona monstro
- Badge de notificação no HUD quando tem trade pendente

---

## Parte 3 — Arquivos / tarefas

```text
src/lib/game-data.ts
  - RANK_INFO (mult por rank) + helpers
  - canFuse(m1, m2): regras de validação
  - totalStats() agora aceita rank

src/lib/forge.functions.ts (novo)
  - fuseMonsters({ keepId, consumeId })

src/lib/trades.functions.ts (novo)
  - createTrade / respondToTrade / confirmTrade / cancelTrade / listMyTrades

src/routes/forge.tsx (nova)
src/routes/trade.tsx (nova)

src/components/MonsterCard.tsx
  - Badge ✦ rank

src/components/HUD.tsx
  - Link 🔨 Forja + 🔄 Trocas + badge de pending

DB migration:
  - ALTER TABLE monsters ADD COLUMN rank int DEFAULT 1
  - CREATE TABLE trades + RLS + índices
```

---

## Ordem sugerida de implementação

1. **DB** — adiciona `rank` em monsters + cria tabela `trades`
2. **Fusão (Forja)** — sistema mais simples, fica funcional sozinho
3. **Trocas** — depois, com server functions atômicas

Posso seguir nessa ordem. Quer que eu também implemente o **sistema de raridade/skills/lendários** que ficou pendente antes disso, ou deixa pra depois e foca em Forja + Trocas primeiro?

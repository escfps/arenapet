## Mudança nos baús

Hoje os baús têm chance de NÃO vir pet (madeira 5%, prata 40%, ouro 70%). Vou garantir que **todo baú aberto sempre traz 1 pet**, e ajustar a raridade conforme o tier.

### Nova tabela de raridade (arquivo `src/lib/game-data.ts`, objeto `CHESTS`)

| Baú | Pet garantido | Distribuição de raridade |
|---|---|---|
| 📦 Madeira | ✅ 100% | 100% comum |
| 🥈 Prata | ✅ 100% | 100% comum |
| 🥇 Ouro | ✅ 100% | 80% comum, 20% raro |
| 👑 Lendário | ✅ 100% | 40% raro, 35% super raro, 18% épico, 6% lendário, 1% mítico |

> "Os outros conforme" → interpretei madeira como 100% comum (mais fraco que prata seria estranho, então igualei) e mantive o lendário forte como nível topo. Se quiser outra divisão pro lendário ou pro madeira, me diga após aprovar.

### Implementação
- Em cada entrada de `CHESTS`, setar `petChance: 1`
- Substituir `petRarityWeights` conforme tabela acima
- Nada mais muda (moedas, gemas, ração, preços, sistema de level-up que entrega baús)

A função `rollChest` já lida com pesos automaticamente, então basta ajustar os dados.
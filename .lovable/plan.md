# Skills exclusivas por pet

## Hoje (problema)
Skill é definida por **role** (`ROLE_SKILLS`), então todo Tank tem "Provocação Brutal", todo Assassino tem "Lâmina Sombria", etc. As 30 espécies se resumem em 5 habilidades.

## Proposta
Cada espécie ganha sua **própria skill nomeada e ilustrada**, com mecânica única ou variação significativa de uma mecânica base. Vou inspirar em LoL (Garen/Yasuo/Ahri/Soraka/Zed/Thresh/Veigar/Master Yi/Lulu/Lucian etc).

### Novas mecânicas a adicionar em `battle.ts`
Hoje existem 5 (`shield_taunt`, `heavy_strike`, `guaranteed_crit`, `aoe_magic`, `team_heal`). Adiciono **10 novas**:

1. **lifesteal_strike** — bate forte e cura X% do dano (DPS sustain — Tigre Infernal)
2. **execute** — dano massivo em alvo abaixo de 30% HP (Pantera Negra)
3. **burn_dot** — aplica queimadura (X de dano/turno por 3 turnos) (Flarepup, Cinderwisp)
4. **double_strike** — ataca 2x o alvo mais forte (Voltbun, Sparkpup)
5. **shield_ally** — escudo num aliado + buff de DEF (Aquakitty estilo Lulu)
6. **chain_lightning** — pula entre 3 inimigos, dano decrescente (Stormtad, Voltsprout)
7. **silence_disable** — anula skill do alvo no próximo turno (Voidspark, Tidewraith)
8. **berserker_rage** — buff de ATK +50% por 3 turnos, perde DEF (Gorila Titã)
9. **revive_ally** — ressuscita 1 aliado com 30% HP (Dragão Branco, mítico)
10. **true_damage_nuke** — dano que ignora 100% DEF e elemento (Dragão Negro)

As 5 atuais ficam mas viram **variações nomeadas** (ex.: Leafox tem "shield_taunt" como "Casca de Carvalho"; Rockpup tem "shield_taunt" como "Muralha de Pedra" com cd menor).

### Per-species skill
Adiciono campo opcional `skill?: Skill` em `Species`. `battle.ts` usa `sp.skill ?? ROLE_SKILLS[role]` como fallback. Cada uma das 30 espécies recebe nome/emoji/descrição únicos. Quando duas compartilham mecânica, os números (cd, mult) diferem pra dar sabor distinto.

### Tela do monstro
`monster.$id.tsx` já lê `ROLE_SKILLS[sp.role]` — passo a usar o helper `getSkill(sp)`.

## Mudanças de balanceamento
- Execute, true_damage e revive ficam só em raridades altas (epic+).
- Burn/silence/lifesteal aparecem em raros pra dar identidade sem quebrar PvP.
- Comuns ganham nomes próprios mas usam variações das 5 mecânicas atuais com cd/mult ajustados (pra não inflacionar).

## Arquivos afetados
- `src/lib/game-data.ts` — novo tipo `SkillKind` expandido, campo `skill` por species, helper `getSkill`.
- `src/lib/battle.ts` — implementação das 10 novas mecânicas + leitura via `getSkill`.
- `src/routes/monster.$id.tsx` — usar `getSkill(sp)`.

## Confirma?
Se topar, mando tudo de uma vez. Se quiser ajustar (ex.: só pets nomeados ganham skill única e os comuns continuam role-based; ou quer mais/menos mecânicas novas), me fala antes que eu codo.
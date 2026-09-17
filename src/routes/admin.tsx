import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast, Toaster } from "sonner";
import { useProfile } from "@/lib/use-profile";
import { SPECIES, RARITY_INFO, rankStars } from "@/lib/game-data";
import {
  adminSearchPlayer,
  adminGetPlayerPets,
  adminGrantResources,
  adminRankUpPet,
  adminAddPet,
  adminDeletePet,
  adminUpdateProfile,
  adminLaunchReset,
  adminUpdatePetStat,
  adminListNewUsers,
} from "@/lib/admin.functions";

import {
  adminCreateRedeemCode,
  adminListRedeemCodes,
  adminDeleteRedeemCode,
  adminListCodeUsages,
} from "@/lib/redeem.functions";

const ADMIN_USER_IDS = new Set<string>([
  "9efcc279-b110-4feb-862e-deea6acf858e",
]);

export const Route = createFileRoute("/admin")({
  component: AdminPage,
});

type ProfileRow = {
  id: string;
  username: string;
  coins: number;
  gems: number;
  vip_until: string | null;
  arena_points: number;
  level: number;
  xp: number;
  wins: number;
  losses: number;
  is_bot: boolean;
};

type PetRow = {
  id: string;
  name: string;
  species: string;
  rank: number;
  in_team: boolean;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  int: number;
  crit: number;
  train_count?: number;
};

const STAT_LABELS: { key: "hp" | "atk" | "def" | "spd" | "int" | "crit"; icon: string }[] = [
  { key: "hp", icon: "❤️" },
  { key: "atk", icon: "⚔️" },
  { key: "def", icon: "🛡️" },
  { key: "spd", icon: "💨" },
  { key: "int", icon: "🧠" },
  { key: "crit", icon: "💢" },
];

function AdminPage() {
  const navigate = useNavigate();
  const { userId, loading } = useProfile();
  const searchFn = useServerFn(adminSearchPlayer);
  const petsFn = useServerFn(adminGetPlayerPets);
  const grantFn = useServerFn(adminGrantResources);
  const rankUpFn = useServerFn(adminRankUpPet);
  const updateStatFn = useServerFn(adminUpdatePetStat);
  const addPetFn = useServerFn(adminAddPet);
  const delPetFn = useServerFn(adminDeletePet);
  const updateProfileFn = useServerFn(adminUpdateProfile);
  const createCodeFn = useServerFn(adminCreateRedeemCode);
  const listCodesFn = useServerFn(adminListRedeemCodes);
  const delCodeFn = useServerFn(adminDeleteRedeemCode);
  const launchResetFn = useServerFn(adminLaunchReset);
  const listNewUsersFn = useServerFn(adminListNewUsers);


  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [selected, setSelected] = useState<ProfileRow | null>(null);
  const [pets, setPets] = useState<PetRow[]>([]);
  const [edit, setEdit] = useState<{ username: string; level: number; xp: number; arena_points: number; wins: number; losses: number; coins: number; gems: number } | null>(null);
  const [gems, setGems] = useState(100);
  const [coins, setCoins] = useState(1000);
  const [vipDays, setVipDays] = useState(30);
  const [newSpecies, setNewSpecies] = useState("flarepup");
  const [newRank, setNewRank] = useState(1);
  const [busy, setBusy] = useState(false);

  // New users
  type NewUser = { id: string; username: string; email: string | null; created_at: string };
  type DayBucket = { day: string; count: number };
  const [newUsers, setNewUsers] = useState<NewUser[]>([]);
  const [perDay, setPerDay] = useState<DayBucket[]>([]);
  const [usersDays, setUsersDays] = useState(30);
  const [showUsersList, setShowUsersList] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Redeem codes
  type CodeRow = {
    id: string;
    code: string;
    reward_type: string;
    reward_data: Record<string, unknown>;
    created_at: string;
    used_at: string | null;
    used_by_name: string | null;
    max_uses?: number;
    uses_count?: number;
  };
  type CodeUse = { id: string; user_id: string; used_at: string; username: string };
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [codeType, setCodeType] = useState<"pet" | "chest" | "gems" | "coins" | "random_shiny">("gems");
  const [codeSpecies, setCodeSpecies] = useState("flarepup");
  const [codeRank, setCodeRank] = useState(1);
  const [codeChest, setCodeChest] = useState<"wood" | "silver" | "gold" | "legendary">("gold");
  const [codeAmount, setCodeAmount] = useState(100);
  const [usagesModal, setUsagesModal] = useState<{ code: string; uses: CodeUse[] } | null>(null);
  const listUsagesFn = useServerFn(adminListCodeUsages);

  useEffect(() => {
    if (loading) return;
    if (!userId || !ADMIN_USER_IDS.has(userId)) {
      toast.error("Acesso negado");
      navigate({ to: "/" });
    }
  }, [userId, loading, navigate]);

  useEffect(() => {
    if (!userId || !ADMIN_USER_IDS.has(userId)) return;
    listCodesFn({}).then((r) => setCodes(r.codes as CodeRow[])).catch(() => {});
  }, [userId]); // eslint-disable-line

  const loadNewUsers = async (days: number) => {
    setLoadingUsers(true);
    try {
      const r = await listNewUsersFn({ data: { days } });
      setNewUsers(r.users as NewUser[]);
      setPerDay(r.perDay as DayBucket[]);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!userId || !ADMIN_USER_IDS.has(userId)) return;
    loadNewUsers(usersDays);
  }, [userId, usersDays]); // eslint-disable-line

  async function reloadCodes() {
    const r = await listCodesFn({});
    setCodes(r.codes as CodeRow[]);
  }

  async function createCode() {
    setBusy(true);
    try {
      type CreatePayload =
        | { reward_type: "pet"; species: string; rank: number }
        | { reward_type: "chest"; chestTier: "wood" | "silver" | "gold" | "legendary" }
        | { reward_type: "gems"; amount: number }
        | { reward_type: "coins"; amount: number }
        | { reward_type: "random_shiny" };
      let payload: CreatePayload;
      if (codeType === "pet") payload = { reward_type: "pet", species: codeSpecies, rank: codeRank };
      else if (codeType === "chest") payload = { reward_type: "chest", chestTier: codeChest };
      else if (codeType === "gems") payload = { reward_type: "gems", amount: codeAmount };
      else if (codeType === "random_shiny") payload = { reward_type: "random_shiny" };
      else payload = { reward_type: "coins", amount: codeAmount };
      const r = await createCodeFn({ data: payload });
      toast.success(`Código gerado: ${r.code}`);
      try { await navigator.clipboard.writeText(r.code); } catch {}
      await reloadCodes();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteCode(id: string) {
    if (!confirm("Excluir este código?")) return;
    setBusy(true);
    try {
      await delCodeFn({ data: { id } });
      await reloadCodes();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function viewUsages(c: CodeRow) {
    try {
      const r = await listUsagesFn({ data: { code_id: c.id } });
      setUsagesModal({ code: c.code, uses: r.uses as CodeUse[] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function doSearch() {
    if (!query.trim()) return;
    try {
      const r = await searchFn({ data: { query: query.trim() } });
      setResults(r.profiles as ProfileRow[]);
      if (r.profiles.length === 0) toast.info("Nenhum jogador encontrado");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function pickPlayer(p: ProfileRow) {
    setSelected(p);
    setEdit({
      username: p.username,
      level: p.level,
      xp: p.xp,
      arena_points: p.arena_points,
      wins: p.wins,
      losses: p.losses,
      coins: p.coins,
      gems: p.gems,
    });
    try {
      const r = await petsFn({ data: { userId: p.id } });
      setPets(r.pets as PetRow[]);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function saveEdit() {
    if (!selected || !edit) return;
    setBusy(true);
    try {
      await updateProfileFn({ data: { userId: selected.id, ...edit } });
      toast.success("Perfil atualizado!");
      await reloadSelected();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reloadSelected() {
    if (!selected) return;
    const r = await searchFn({ data: { query: selected.username } });
    const fresh = (r.profiles as ProfileRow[]).find((x) => x.id === selected.id);
    if (fresh) setSelected(fresh);
    const pr = await petsFn({ data: { userId: selected.id } });
    setPets(pr.pets as PetRow[]);
  }

  async function grant(payload: { gems?: number; coins?: number; vipDays?: number }) {
    if (!selected) return;
    setBusy(true);
    try {
      await grantFn({ data: { userId: selected.id, ...payload } });
      toast.success("Aplicado!");
      await reloadSelected();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rankPet(petId: string, delta: number) {
    setBusy(true);
    try {
      await rankUpFn({ data: { petId, delta } });
      await reloadSelected();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function bumpStat(petId: string, stat: "hp" | "atk" | "def" | "spd" | "int" | "crit", delta: number) {
    setBusy(true);
    try {
      await updateStatFn({ data: { petId, stat, delta } });
      await reloadSelected();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }



  async function addPet() {
    if (!selected) return;
    setBusy(true);
    try {
      await addPetFn({ data: { userId: selected.id, species: newSpecies, rank: newRank } });
      toast.success("Pet adicionado!");
      await reloadSelected();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function delPet(petId: string) {
    if (!confirm("Deletar este pet?")) return;
    setBusy(true);
    try {
      await delPetFn({ data: { petId } });
      toast.success("Pet removido");
      await reloadSelected();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doLaunchReset() {
    const txt = prompt(
      "⚠️ AÇÃO IRREVERSÍVEL ⚠️\n\nIsto vai:\n• Zerar arena_points, V/D de TODOS\n• Apagar pets dos bots e dar 2 comuns + 1 raro novos\n• Resetar bots pra nível 1, 3000🪙, 20💎\n• Encerrar a Season atual e iniciar a próxima\n\nPets, moedas, diamantes e baús dos JOGADORES REAIS ficam intactos.\n\nDigite RESETAR LANCAMENTO para confirmar:"
    );
    if (txt !== "RESETAR LANCAMENTO") {
      if (txt !== null) toast.error("Confirmação incorreta. Nada foi feito.");
      return;
    }
    setBusy(true);
    try {
      const r = await launchResetFn({ data: { confirm: "RESETAR LANCAMENTO" } });
      toast.success(`✅ Reset OK — ${r.profiles_reset} perfis, ${r.bots_reset} bots, Season #${r.new_season}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="p-8 text-white">Carregando…</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 p-4 text-white">
      <Toaster richColors position="top-center" />
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black">🛠️ Painel Admin</h1>
          <button onClick={() => navigate({ to: "/" })} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm">
            ← Voltar
          </button>
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-red-900/60 to-orange-900/60 border-2 border-red-500/60 p-4">
          <h2 className="text-lg font-black flex items-center gap-2">🚀 Reset de Lançamento</h2>
          <p className="text-sm opacity-90 mt-1">
            Zera ranking de todos, transforma bots em "novos jogadores" (2 comuns + 1 raro, lv1) e inicia nova Season.
            Pets/moedas/baús dos jogadores reais ficam intactos.
          </p>
          <button
            disabled={busy}
            onClick={doLaunchReset}
            className="mt-3 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 font-black text-sm shadow-lg"
          >
            🚀 Executar reset de lançamento
          </button>
        </div>

        {/* New users / signups */}
        <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-4">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h2 className="text-xl font-bold">📈 Novos cadastros</h2>
            <div className="flex items-center gap-2">
              <label className="text-xs opacity-70">Últimos</label>
              <select
                value={usersDays}
                onChange={(e) => setUsersDays(Number(e.target.value))}
                className="px-2 py-1 rounded bg-black/40 border border-white/10 text-sm"
              >
                <option value={1}>1 dia</option>
                <option value={3}>3 dias</option>
                <option value={7}>7 dias</option>
                <option value={14}>14 dias</option>
                <option value={30}>30 dias</option>
                <option value={60}>60 dias</option>
                <option value={90}>90 dias</option>
              </select>
              <button
                onClick={() => loadNewUsers(usersDays)}
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs"
              >
                🔄
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            <div className="rounded-lg bg-black/30 p-3">
              <div className="text-xs opacity-70">Total no período</div>
              <div className="text-2xl font-black">{loadingUsers ? "..." : newUsers.length}</div>
            </div>
            <div className="rounded-lg bg-black/30 p-3">
              <div className="text-xs opacity-70">Hoje</div>
              <div className="text-2xl font-black">
                {loadingUsers ? "..." : (perDay[0]?.count ?? 0)}
              </div>
            </div>
            <div className="rounded-lg bg-black/30 p-3">
              <div className="text-xs opacity-70">Média/dia</div>
              <div className="text-2xl font-black">
                {loadingUsers || perDay.length === 0
                  ? "..."
                  : Math.round((newUsers.length / Math.max(1, perDay.length)) * 10) / 10}
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-black/30 p-3 mb-3">
            <div className="text-xs opacity-70 font-bold mb-2">Por dia</div>
            <div className="space-y-1 max-h-56 overflow-y-auto">
              {perDay.map((d) => {
                const max = Math.max(1, ...perDay.map((x) => x.count));
                const pct = (d.count / max) * 100;
                return (
                  <div key={d.day} className="flex items-center gap-2 text-sm">
                    <div className="w-24 font-mono opacity-80">
                      {new Date(d.day + "T12:00:00").toLocaleDateString("pt-BR", {
                        day: "2-digit", month: "2-digit",
                      })}
                    </div>
                    <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-fuchsia-500 to-purple-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="w-10 text-right font-bold">{d.count}</div>
                  </div>
                );
              })}
              {!loadingUsers && perDay.length === 0 && (
                <div className="opacity-60 text-sm">Nenhum cadastro no período.</div>
              )}
            </div>
          </div>

          <button
            onClick={() => setShowUsersList((v) => !v)}
            className="w-full px-3 py-2 rounded bg-white/10 hover:bg-white/20 text-sm font-bold"
          >
            {showUsersList ? "▲ Esconder lista de usuários" : `▼ Ver lista (${newUsers.length})`}
          </button>

          {showUsersList && (
            <div className="mt-3 space-y-1 max-h-96 overflow-y-auto">
              {newUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center gap-2 p-2 rounded bg-white/5 text-sm"
                >
                  <span className="font-bold flex-1 truncate">{u.username}</span>
                  <span className="text-xs opacity-80 truncate max-w-[200px]">
                    {u.email ?? "—"}
                  </span>
                  <span className="text-xs opacity-60 whitespace-nowrap">
                    {new Date(u.created_at).toLocaleString("pt-BR", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
              {newUsers.length === 0 && (
                <div className="opacity-60 text-sm p-2">Nenhum usuário no período.</div>
              )}
            </div>
          )}
        </div>


        <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-4">
          <div className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              placeholder="Buscar nick..."
              className="flex-1 px-3 py-2 rounded bg-black/30 border border-white/20 outline-none"
            />
            <button onClick={doSearch} className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-500 font-bold">
              Buscar
            </button>
          </div>
          {results.length > 0 && (
            <div className="mt-3 space-y-1 max-h-60 overflow-y-auto">
              {results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => pickPlayer(p)}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition ${
                    selected?.id === p.id ? "bg-purple-600" : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <span className="font-bold">{p.username}</span>{p.is_bot && " 🤖"}
                  <span className="opacity-70 ml-2">💎 {p.gems} · 🪙 {p.coins} · Lv {p.level}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <>
            <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-4">
              <h2 className="text-xl font-bold mb-2">{selected.username}{selected.is_bot && " 🤖"}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                <div>💎 Gemas: <b>{selected.gems}</b></div>
                <div>🪙 Moedas: <b>{selected.coins}</b></div>
                <div>🏆 Arena: <b>{selected.arena_points}</b></div>
                <div>📈 Lv: <b>{selected.level}</b> ({selected.xp} XP)</div>
                <div>⚔️ V/D: <b>{selected.wins}/{selected.losses}</b></div>
                <div className="col-span-2 sm:col-span-3">
                  👑 VIP: {selected.vip_until && new Date(selected.vip_until) > new Date()
                    ? `até ${new Date(selected.vip_until).toLocaleDateString("pt-BR")}`
                    : "inativo"}
                </div>
              </div>

              {edit && (
                <div className="mt-4 rounded-lg bg-black/30 p-3 space-y-2">
                  <div className="text-xs opacity-70 font-bold">✏️ Editar perfil (valores absolutos)</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label className="text-xs">Nick
                      <input value={edit.username} onChange={(e) => setEdit({ ...edit, username: e.target.value })} className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 text-sm" />
                    </label>
                    <label className="text-xs">Nível
                      <input type="number" value={edit.level} onChange={(e) => setEdit({ ...edit, level: Number(e.target.value) })} className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 text-sm" />
                    </label>
                    <label className="text-xs">XP
                      <input type="number" value={edit.xp} onChange={(e) => setEdit({ ...edit, xp: Number(e.target.value) })} className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 text-sm" />
                    </label>
                    <label className="text-xs">Arena pts
                      <input type="number" value={edit.arena_points} onChange={(e) => setEdit({ ...edit, arena_points: Number(e.target.value) })} className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 text-sm" />
                    </label>
                    <label className="text-xs">Vitórias
                      <input type="number" value={edit.wins} onChange={(e) => setEdit({ ...edit, wins: Number(e.target.value) })} className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 text-sm" />
                    </label>
                    <label className="text-xs">Derrotas
                      <input type="number" value={edit.losses} onChange={(e) => setEdit({ ...edit, losses: Number(e.target.value) })} className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 text-sm" />
                    </label>
                    <label className="text-xs">🪙 Moedas
                      <input type="number" value={edit.coins} onChange={(e) => setEdit({ ...edit, coins: Number(e.target.value) })} className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 text-sm" />
                    </label>
                    <label className="text-xs">💎 Gemas
                      <input type="number" value={edit.gems} onChange={(e) => setEdit({ ...edit, gems: Number(e.target.value) })} className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 text-sm" />
                    </label>
                  </div>
                  <button disabled={busy} onClick={saveEdit} className="w-full py-1.5 rounded bg-blue-600 hover:bg-blue-500 font-bold text-sm">
                    💾 Salvar alterações
                  </button>
                </div>
              )}


              <div className="mt-4 grid sm:grid-cols-3 gap-3">
                <div className="rounded-lg bg-black/30 p-3 space-y-2">
                  <label className="text-xs opacity-70">💎 Adicionar gemas</label>
                  <input type="number" value={gems} onChange={(e) => setGems(Number(e.target.value))} className="w-full px-2 py-1 rounded bg-black/40 border border-white/10" />
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={() => grant({ gems })} className="flex-1 py-1 rounded bg-fuchsia-600 hover:bg-fuchsia-500 font-bold text-sm">+ Adicionar</button>
                    <button disabled={busy} onClick={() => grant({ gems: -gems })} className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-sm">−</button>
                  </div>
                </div>

                <div className="rounded-lg bg-black/30 p-3 space-y-2">
                  <label className="text-xs opacity-70">🪙 Adicionar moedas</label>
                  <input type="number" value={coins} onChange={(e) => setCoins(Number(e.target.value))} className="w-full px-2 py-1 rounded bg-black/40 border border-white/10" />
                  <div className="flex gap-2">
                    <button disabled={busy} onClick={() => grant({ coins })} className="flex-1 py-1 rounded bg-amber-600 hover:bg-amber-500 font-bold text-sm">+ Adicionar</button>
                    <button disabled={busy} onClick={() => grant({ coins: -coins })} className="px-3 py-1 rounded bg-red-700 hover:bg-red-600 text-sm">−</button>
                  </div>
                </div>

                <div className="rounded-lg bg-black/30 p-3 space-y-2">
                  <label className="text-xs opacity-70">👑 Dias de VIP</label>
                  <input type="number" value={vipDays} onChange={(e) => setVipDays(Number(e.target.value))} className="w-full px-2 py-1 rounded bg-black/40 border border-white/10" />
                  <button disabled={busy} onClick={() => grant({ vipDays })} className="w-full py-1 rounded bg-yellow-600 hover:bg-yellow-500 font-bold text-sm">+ Aplicar VIP</button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-4">
              <h3 className="font-bold mb-2">🐾 Pets ({pets.length})</h3>
              <div className="mb-3 flex flex-wrap items-end gap-2 p-2 bg-black/30 rounded">
                <div className="flex-1 min-w-[160px]">
                  <label className="text-xs opacity-70 block">Espécie</label>
                  <select value={newSpecies} onChange={(e) => setNewSpecies(e.target.value)} className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 text-sm">
                    {Object.values(SPECIES).filter((sp) => !sp.retired)
                      .slice()
                      .sort((a, b) => Number(!!b.hidden) - Number(!!a.hidden))
                      .map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.hidden ? "🔒 " : ""}{sp.name} ({RARITY_INFO[sp.rarity].name}){sp.hidden ? " — OCULTO" : ""}
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs opacity-70 block">Estrelas</label>
                  <input type="number" min={1} max={10} value={newRank} onChange={(e) => setNewRank(Math.max(1, Math.min(10, Number(e.target.value))))} className="w-20 px-2 py-1 rounded bg-black/40 border border-white/10 text-sm" />
                </div>
                <button disabled={busy} onClick={addPet} className="px-4 py-1 rounded bg-green-600 hover:bg-green-500 font-bold text-sm">
                  + Adicionar pet
                </button>
              </div>

              <div className="space-y-1 max-h-96 overflow-y-auto">
                {pets.map((pet) => {
                  const sp = SPECIES[pet.species];
                  return (
                    <div key={pet.id} className="p-2 bg-black/30 rounded text-sm space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold flex-1 truncate">
                          {sp?.name ?? pet.species} {pet.in_team && "⭐"}
                          <span className="text-yellow-300 ml-2">{rankStars(pet.rank)}</span>
                        </span>
                        <button disabled={busy || pet.rank <= 1} onClick={() => rankPet(pet.id, -1)} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30">−⭐</button>
                        <button disabled={busy || pet.rank >= 10} onClick={() => rankPet(pet.id, 1)} className="px-2 py-1 rounded bg-yellow-600 hover:bg-yellow-500 font-bold disabled:opacity-30">+⭐</button>
                        <button disabled={busy} onClick={() => delPet(pet.id)} className="px-2 py-1 rounded bg-red-700 hover:bg-red-600">🗑️</button>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {(() => {
                          const rank = Math.max(1, pet.rank ?? 1);
                          const trainLimit = rank * 10;
                          const trainUsed = pet.train_count ?? 0;
                          const trainsLeft = Math.max(0, trainLimit - trainUsed);
                          return (
                            <div className="text-[11px] opacity-80">
                              💪 Treinos: <span className={trainsLeft === 0 ? "text-amber-300 font-bold" : "font-bold"}>{trainUsed}/{trainLimit}</span>
                              {trainsLeft === 0 && <span className="ml-1 text-amber-300">(suba ⭐ pra treinar mais)</span>}
                            </div>
                          );
                        })()}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {STAT_LABELS.map(({ key, icon }) => {
                            const rank = Math.max(1, pet.rank ?? 1);
                            const trainLimit = rank * 10;
                            const trainUsed = pet.train_count ?? 0;
                            const noTrains = trainUsed >= trainLimit;
                            const val = pet[key] ?? 0;
                            const atCritMax = key === "crit" && val >= rank;
                            const cantAdd = noTrains || atCritMax;
                            return (
                              <div key={key} className="flex items-center gap-0.5 bg-black/30 rounded px-1.5 py-0.5">
                                <span className="text-xs w-12 opacity-80">{icon} {val}</span>
                                <button disabled={busy || val <= 0} onClick={() => bumpStat(pet.id, key, -1)} className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30 text-xs">−1</button>
                                <button disabled={busy || cantAdd} onClick={() => bumpStat(pet.id, key, 1)} className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 font-bold text-xs disabled:opacity-30">+1🎲</button>
                                <button disabled={busy || cantAdd} onClick={() => bumpStat(pet.id, key, 10)} className="px-1.5 py-0.5 rounded bg-emerald-700 hover:bg-emerald-600 font-bold text-xs disabled:opacity-30">+10🎲</button>
                              </div>
                            );
                          })}
                        </div>
                      </div>


                    </div>
                  );
                })}
                {pets.length === 0 && <div className="opacity-60 text-sm p-2">Nenhum pet.</div>}
              </div>
            </div>
          </>
        )}

        {/* Redeem Codes */}
        <div className="rounded-2xl bg-white/10 backdrop-blur border border-white/20 p-4">
          <h2 className="text-xl font-bold mb-3">🎁 Códigos de resgate</h2>

          <div className="rounded-lg bg-black/30 p-3 space-y-2 mb-4">
            <div className="text-xs opacity-70 font-bold">Criar novo código</div>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="text-xs opacity-70 block">Tipo</label>
                <select
                  value={codeType}
                  onChange={(e) => setCodeType(e.target.value as typeof codeType)}
                  className="px-2 py-1 rounded bg-black/40 border border-white/10 text-sm"
                >
                  <option value="gems">💎 Diamantes</option>
                  <option value="coins">🪙 Moedas</option>
                  <option value="chest">📦 Baú</option>
                  <option value="pet">🐾 Pet</option>
                  <option value="random_shiny">✨ Shiny aleatório (vinculado)</option>
                </select>
              </div>

              {codeType === "pet" && (
                <>
                  <div className="flex-1 min-w-[160px]">
                    <label className="text-xs opacity-70 block">Espécie</label>
                    <select
                      value={codeSpecies}
                      onChange={(e) => setCodeSpecies(e.target.value)}
                      className="w-full px-2 py-1 rounded bg-black/40 border border-white/10 text-sm"
                    >
                      {Object.values(SPECIES).filter((sp) => !sp.retired).map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name} ({RARITY_INFO[sp.rarity].name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs opacity-70 block">Estrelas</label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={codeRank}
                      onChange={(e) => setCodeRank(Math.max(1, Math.min(10, Number(e.target.value))))}
                      className="w-20 px-2 py-1 rounded bg-black/40 border border-white/10 text-sm"
                    />
                  </div>
                </>
              )}

              {codeType === "chest" && (
                <div>
                  <label className="text-xs opacity-70 block">Tier do baú</label>
                  <select
                    value={codeChest}
                    onChange={(e) => setCodeChest(e.target.value as typeof codeChest)}
                    className="px-2 py-1 rounded bg-black/40 border border-white/10 text-sm"
                  >
                    <option value="wood">📦 Madeira</option>
                    <option value="silver">🥈 Prata</option>
                    <option value="gold">🥇 Ouro</option>
                    <option value="legendary">👑 Lendário</option>
                  </select>
                </div>
              )}

              {(codeType === "gems" || codeType === "coins") && (
                <div>
                  <label className="text-xs opacity-70 block">Quantidade</label>
                  <input
                    type="number"
                    min={1}
                    value={codeAmount}
                    onChange={(e) => setCodeAmount(Math.max(1, Number(e.target.value)))}
                    className="w-28 px-2 py-1 rounded bg-black/40 border border-white/10 text-sm"
                  />
                </div>
              )}

              <button
                disabled={busy}
                onClick={createCode}
                className="px-4 py-1.5 rounded bg-green-600 hover:bg-green-500 font-bold text-sm"
              >
                ✨ Gerar código
              </button>
            </div>
          </div>

          <div className="space-y-1 max-h-96 overflow-y-auto">
            {codes.map((c) => {
              const rd = c.reward_data || {};
              let desc = "";
              if (c.reward_type === "pet") {
                const sp = SPECIES[String(rd.species ?? "")];
                desc = `🐾 ${sp?.name ?? rd.species} ${rankStars(Number(rd.rank) || 1)}`;
              } else if (c.reward_type === "chest") {
                desc = `📦 Baú ${String(rd.chestTier ?? "")}`;
              } else if (c.reward_type === "gems") {
                desc = `💎 ${rd.amount} diamantes`;
              } else if (c.reward_type === "coins") {
                desc = `🪙 ${rd.amount} moedas`;
              } else if (c.reward_type === "random_shiny") {
                desc = `✨ Shiny aleatório 🔒 (vinculado)`;
              }
              const maxUses = c.max_uses ?? 1;
              const usesCount = c.uses_count ?? 0;
              const isMulti = maxUses > 1;
              const exhausted = isMulti ? usesCount >= maxUses : !!c.used_at;
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 p-2 rounded text-sm ${
                    exhausted ? "bg-red-900/30 opacity-70" : "bg-green-900/30"
                  }`}
                >
                  <span className="font-mono font-bold tracking-wider flex-1 truncate">
                    {c.code}
                  </span>
                  <span className="text-xs opacity-80 hidden sm:block">{desc}</span>
                  {isMulti ? (
                    <>
                      <span className="text-xs text-blue-300">
                        {usesCount}/{maxUses} usos
                      </span>
                      <button
                        onClick={() => viewUsages(c)}
                        className="px-2 py-1 rounded bg-blue-700 hover:bg-blue-600 text-xs"
                      >
                        👥 Ver usos
                      </button>
                    </>
                  ) : c.used_at ? (
                    <span className="text-xs text-red-300">
                      ✓ usado por {c.used_by_name ?? "?"}
                    </span>
                  ) : (
                    <span className="text-xs text-green-300">disponível</span>
                  )}
                  <button
                    onClick={() => navigator.clipboard.writeText(c.code).then(() => toast.success("Copiado!"))}
                    className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-xs"
                  >
                    📋
                  </button>
                  <button
                    disabled={busy}
                    onClick={() => deleteCode(c.id)}
                    className="px-2 py-1 rounded bg-red-700 hover:bg-red-600"
                  >
                    🗑️
                  </button>
                </div>
              );
            })}
            {codes.length === 0 && (
              <div className="opacity-60 text-sm p-2">Nenhum código criado.</div>
            )}
          </div>
        </div>

        {usagesModal && (
          <div
            className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setUsagesModal(null)}
          >
            <div
              className="w-full max-w-md rounded-2xl bg-slate-900 border border-white/20 p-4 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-lg">
                  👥 Usos de <span className="font-mono">{usagesModal.code}</span>
                </h3>
                <button
                  onClick={() => setUsagesModal(null)}
                  className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-sm"
                >
                  ✕
                </button>
              </div>
              <div className="text-xs opacity-70 mb-2">
                Total: {usagesModal.uses.length} resgate{usagesModal.uses.length === 1 ? "" : "s"}
              </div>
              <div className="space-y-1">
                {usagesModal.uses.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded bg-white/5 text-sm">
                    <span className="font-bold">{u.username}</span>
                    <span className="text-xs opacity-70">
                      {new Date(u.used_at).toLocaleString("pt-BR")}
                    </span>
                  </div>
                ))}
                {usagesModal.uses.length === 0 && (
                  <div className="opacity-60 text-sm p-2">Nenhum resgate ainda.</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
} from "@/lib/admin.functions";

import {
  adminCreateRedeemCode,
  adminListRedeemCodes,
  adminDeleteRedeemCode,
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
};

function AdminPage() {
  const navigate = useNavigate();
  const { userId, loading } = useProfile();
  const searchFn = useServerFn(adminSearchPlayer);
  const petsFn = useServerFn(adminGetPlayerPets);
  const grantFn = useServerFn(adminGrantResources);
  const rankUpFn = useServerFn(adminRankUpPet);
  const addPetFn = useServerFn(adminAddPet);
  const delPetFn = useServerFn(adminDeletePet);
  const updateProfileFn = useServerFn(adminUpdateProfile);
  const createCodeFn = useServerFn(adminCreateRedeemCode);
  const listCodesFn = useServerFn(adminListRedeemCodes);
  const delCodeFn = useServerFn(adminDeleteRedeemCode);

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

  // Redeem codes
  type CodeRow = {
    id: string;
    code: string;
    reward_type: string;
    reward_data: Record<string, unknown>;
    created_at: string;
    used_at: string | null;
    used_by_name: string | null;
  };
  const [codes, setCodes] = useState<CodeRow[]>([]);
  const [codeType, setCodeType] = useState<"pet" | "chest" | "gems" | "coins">("gems");
  const [codeSpecies, setCodeSpecies] = useState("flarepup");
  const [codeRank, setCodeRank] = useState(1);
  const [codeChest, setCodeChest] = useState<"wood" | "silver" | "gold" | "legendary">("gold");
  const [codeAmount, setCodeAmount] = useState(100);

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
        | { reward_type: "coins"; amount: number };
      let payload: CreatePayload;
      if (codeType === "pet") payload = { reward_type: "pet", species: codeSpecies, rank: codeRank };
      else if (codeType === "chest") payload = { reward_type: "chest", chestTier: codeChest };
      else if (codeType === "gems") payload = { reward_type: "gems", amount: codeAmount };
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
                    {Object.values(SPECIES)
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
                    <div key={pet.id} className="flex items-center gap-2 p-2 bg-black/30 rounded text-sm">
                      <span className="font-bold flex-1 truncate">
                        {sp?.name ?? pet.species} {pet.in_team && "⭐"}
                        <span className="text-yellow-300 ml-2">{rankStars(pet.rank)}</span>
                      </span>
                      <button disabled={busy || pet.rank <= 1} onClick={() => rankPet(pet.id, -1)} className="px-2 py-1 rounded bg-white/10 hover:bg-white/20 disabled:opacity-30">−⭐</button>
                      <button disabled={busy || pet.rank >= 10} onClick={() => rankPet(pet.id, 1)} className="px-2 py-1 rounded bg-yellow-600 hover:bg-yellow-500 font-bold disabled:opacity-30">+⭐</button>
                      <button disabled={busy} onClick={() => delPet(pet.id)} className="px-2 py-1 rounded bg-red-700 hover:bg-red-600">🗑️</button>
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
                      {Object.values(SPECIES).map((sp) => (
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
              }
              return (
                <div
                  key={c.id}
                  className={`flex items-center gap-2 p-2 rounded text-sm ${
                    c.used_at ? "bg-red-900/30 opacity-70" : "bg-green-900/30"
                  }`}
                >
                  <span className="font-mono font-bold tracking-wider flex-1 truncate">
                    {c.code}
                  </span>
                  <span className="text-xs opacity-80 hidden sm:block">{desc}</span>
                  {c.used_at ? (
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
      </div>
    </div>
  );
}

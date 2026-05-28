import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { HUD } from "@/components/HUD";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/lib/use-profile";
import { changeUsername, NICK_CHANGE_COST_GEMS } from "@/lib/profile.functions";
import { deleteMyAccount } from "@/lib/account.functions";
import { getUserTrophies, type SeasonTrophy } from "@/lib/seasons.functions";
import { tierTrophyEmoji } from "@/lib/season-rewards";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { profile, loading, reload } = useProfile();
  const navigate = useNavigate();
  const changeNick = useServerFn(changeUsername);
  const fetchTrophies = useServerFn(getUserTrophies);
  const deleteAccount = useServerFn(deleteMyAccount);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [trophies, setTrophies] = useState<SeasonTrophy[]>([]);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [delConfirm, setDelConfirm] = useState("");
  const [delBusy, setDelBusy] = useState(false);

  async function handleDeleteAccount() {
    if (delConfirm !== "EXCLUIR") { toast.error('Digite "EXCLUIR" para confirmar.'); return; }
    setDelBusy(true);
    try {
      await deleteAccount({ data: { confirm: "EXCLUIR" } });
      try { localStorage.removeItem("arenapet:remember"); } catch {}
      await supabase.auth.signOut();
      toast.success("Conta excluída com sucesso");
      navigate({ to: "/login" });
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao excluir conta");
      setDelBusy(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 6) { toast.error("A senha precisa ter no mínimo 6 caracteres."); return; }
    if (pwd !== pwd2) { toast.error("As senhas não coincidem."); return; }
    setPwdBusy(true);
    try {
      
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      try { localStorage.removeItem("arenapet:remember"); } catch {}
      toast.success("Senha alterada com sucesso! 🔐");
      setPwd(""); setPwd2("");
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao alterar senha");
    } finally {
      setPwdBusy(false);
    }
  }

  useEffect(() => {
    if (profile) {
      fetchTrophies({ data: { userId: profile.id } }).then(setTrophies).catch(() => {});
    }
  }, [profile, fetchTrophies]);

  if (loading || !profile) {
    return <div className="p-8 text-center text-white">Carregando…</div>;
  }

  const nickChanges = (profile as any).nick_changes ?? 0;
  const isFree = nickChanges === 0;
  const canAfford = profile.gems >= NICK_CHANGE_COST_GEMS;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const res = await changeNick({ data: { newUsername: newName.trim() } });
      toast.success(res.free ? "Nick alterado de graça! 🎉" : `Nick alterado! -${NICK_CHANGE_COST_GEMS} 💎`);
      setNewName("");
      await reload();
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao trocar nick");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[oklch(0.25_0.12_290)] via-[oklch(0.18_0.10_310)] to-[oklch(0.22_0.14_260)]">
      <HUD profile={profile} />
      <main className="max-w-2xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Link to="/" className="text-white/70 hover:text-white text-xs">← Voltar</Link>
        </div>

        <div className="rounded-3xl bg-[oklch(0.18_0.06_290)]/90 backdrop-blur-xl border-2 border-fuchsia-400/30 p-6 shadow-2xl">
          <h1 className="text-2xl font-extrabold text-white mb-1 flex items-center gap-2">
            <span>👤</span> Meu Perfil
          </h1>
          <p className="text-white/60 text-sm mb-6">Gerencie sua conta de Treinador</p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <Stat label="Nick atual" value={profile.username} />
            <Stat label="Nível" value={`Lv ${profile.level}`} />
            <Stat label="Vitórias" value={`${profile.wins}V / ${profile.losses}D`} />
            <Stat label="Moedas / Gemas" value={`🪙 ${profile.coins} • 💎 ${profile.gems}`} />
          </div>

          <div className="border-t border-white/10 pt-5">
            <h2 className="text-lg font-extrabold text-white mb-1 flex items-center gap-2">
              ✏️ Trocar nick
            </h2>
            <p className="text-white/60 text-xs mb-3">
              {isFree
                ? "Sua primeira troca é grátis! 🎁"
                : `Custo: ${NICK_CHANGE_COST_GEMS} 💎 (você já trocou ${nickChanges}x)`}
            </p>

            <form onSubmit={submit} className="space-y-3">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🎮</span>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Novo nick (3-20, letras/números/_.-)"
                  minLength={3}
                  maxLength={20}
                  pattern="[a-zA-Z0-9_.\-]+"
                  required
                  className="w-full pl-10 pr-3 py-3 rounded-xl bg-black/40 border-2 border-white/10 focus:border-fuchsia-400 text-white text-sm font-bold outline-none transition"
                />
              </div>

              <button
                type="submit"
                disabled={busy || (!isFree && !canAfford)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-fuchsia-500 to-purple-600 hover:from-fuchsia-400 hover:to-purple-500 text-white font-extrabold shadow-[0_4px_0_oklch(0.35_0.18_290)] active:translate-y-0.5 active:shadow-[0_1px_0_oklch(0.35_0.18_290)] transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Salvando..." : isFree ? "✨ Trocar (grátis)" : `💎 Trocar por ${NICK_CHANGE_COST_GEMS} gemas`}
              </button>
              {!isFree && !canAfford && (
                <p className="text-rose-300 text-xs text-center">Gemas insuficientes</p>
              )}
            </form>
          </div>
        </div>

        {/* Change password */}
        <div className="rounded-3xl bg-[oklch(0.18_0.06_290)]/90 backdrop-blur-xl border-2 border-cyan-400/30 p-6 shadow-2xl">
          <h2 className="text-lg font-extrabold text-white mb-1 flex items-center gap-2">🔐 Alterar senha</h2>
          <p className="text-white/60 text-xs mb-3">Escolha uma nova senha (mín. 6 caracteres).</p>
          <form onSubmit={changePassword} className="space-y-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
              <input
                type="password" required minLength={6} value={pwd} onChange={(e) => setPwd(e.target.value)}
                placeholder="Nova senha"
                className="w-full pl-10 pr-3 py-3 rounded-xl bg-black/40 border-2 border-white/10 focus:border-cyan-400 text-white text-sm font-bold outline-none transition"
              />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🔒</span>
              <input
                type="password" required minLength={6} value={pwd2} onChange={(e) => setPwd2(e.target.value)}
                placeholder="Confirme a nova senha"
                className="w-full pl-10 pr-3 py-3 rounded-xl bg-black/40 border-2 border-white/10 focus:border-cyan-400 text-white text-sm font-bold outline-none transition"
              />
            </div>
            <button
              type="submit"
              disabled={pwdBusy}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-extrabold shadow-[0_4px_0_oklch(0.35_0.15_240)] active:translate-y-0.5 active:shadow-[0_1px_0_oklch(0.35_0.15_240)] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {pwdBusy ? "Salvando..." : "🔐 Alterar senha"}
            </button>
          </form>
        </div>


        {/* Season trophies (permanent) */}
        <div className="rounded-3xl bg-[oklch(0.18_0.06_290)]/90 backdrop-blur-xl border-2 border-amber-400/30 p-6 shadow-2xl">
          <h2 className="text-lg font-extrabold text-white mb-1 flex items-center gap-2">
            🏆 Troféus de Season
          </h2>
          <p className="text-white/60 text-xs mb-4">Conquistas permanentes de cada temporada (Mestre, Grão-Mestre e Lendário)</p>
          {trophies.length === 0 ? (
            <div className="text-center py-6 text-white/50 text-sm">
              Ainda sem troféus. Alcance <b>Mestre</b> ou acima até o fim da Season pra conquistar o seu! ✨
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {trophies.map((t) => {
                const isLegendary = t.tier === "Lendário";
                const isGM = t.tier === "Grão-Mestre";
                return (
                  <div
                    key={t.season_number}
                    className={`rounded-2xl p-3 border-2 text-center ${
                      isLegendary
                        ? "bg-gradient-to-br from-fuchsia-700/60 via-pink-700/60 to-amber-600/60 border-amber-300 shadow-[0_0_20px_rgba(251,191,36,0.4)]"
                        : isGM
                        ? "bg-gradient-to-br from-red-700/60 to-pink-700/60 border-red-300"
                        : "bg-gradient-to-br from-purple-700/60 to-fuchsia-700/60 border-fuchsia-300"
                    }`}
                  >
                    <div className="text-3xl mb-1">{tierTrophyEmoji(t.tier)}</div>
                    <div className="text-white font-extrabold text-sm">{t.tier}</div>
                    <div className="text-white/80 text-[10px] mt-0.5">Season #{t.season_number}</div>
                    {t.final_rank && (
                      <div className="text-amber-300 text-[10px] font-bold mt-0.5">#{t.final_rank} • {t.arena_points} pts</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Danger zone */}
        <div className="rounded-3xl bg-[oklch(0.18_0.06_290)]/90 backdrop-blur-xl border-2 border-red-500/30 p-6 shadow-2xl">
          <h2 className="text-lg font-extrabold text-white mb-1 flex items-center gap-2">⚠️ Zona de perigo</h2>
          <p className="text-white/60 text-xs mb-3">Esta ação é permanente. Todos os seus dados (pets, batalhas, compras) serão apagados.</p>
          <button
            onClick={() => { setDelConfirm(""); setDelOpen(true); }}
            className="w-full py-2.5 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 text-red-300 hover:text-red-200 text-sm font-extrabold transition"
          >
            🗑️ Excluir minha conta
          </button>
        </div>
      </main>

      {delOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => !delBusy && setDelOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl bg-[oklch(0.18_0.06_290)] border-2 border-red-500/50 p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-extrabold text-white mb-2 flex items-center gap-2">⚠️ Excluir conta</h3>
            <p className="text-white/70 text-sm mb-4">
              Essa ação <b className="text-red-300">não pode ser desfeita</b>. Todos os seus pets, baús,
              compras, amizades e progresso serão apagados permanentemente.
            </p>
            <p className="text-white/80 text-xs mb-2">
              Para confirmar, digite <b className="text-red-300">EXCLUIR</b> abaixo:
            </p>
            <input
              type="text"
              value={delConfirm}
              onChange={(e) => setDelConfirm(e.target.value)}
              placeholder="EXCLUIR"
              autoCapitalize="characters"
              className="w-full px-3 py-3 rounded-xl bg-black/40 border-2 border-white/10 focus:border-red-400 text-white text-sm font-bold outline-none transition mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setDelOpen(false)}
                disabled={delBusy}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-extrabold transition disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={delBusy || delConfirm !== "EXCLUIR"}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-extrabold transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {delBusy ? "Excluindo..." : "Excluir definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/30 border border-white/10 p-3">
      <div className="text-[10px] uppercase tracking-wide text-white/50 font-bold">{label}</div>
      <div className="text-white font-extrabold text-sm mt-0.5 truncate">{value}</div>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { HUD } from "@/components/HUD";
import { useProfile } from "@/lib/use-profile";
import { changeUsername, NICK_CHANGE_COST_GEMS } from "@/lib/profile.functions";

export const Route = createFileRoute("/profile")({ component: ProfilePage });

function ProfilePage() {
  const { profile, loading, reload } = useProfile();
  const changeNick = useServerFn(changeUsername);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

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
      </main>
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

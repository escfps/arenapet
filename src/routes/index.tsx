import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ANIMALS, CROPS, getCropStage, xpToLevel } from "@/lib/game-data";
import { Plot } from "@/components/Plot";
import { AnimalCard } from "@/components/AnimalCard";
import { CoinBadge } from "@/components/CoinBadge";
import { toast, Toaster } from "sonner";
import farmBg from "@/assets/farm-bg.jpg";

export const Route = createFileRoute("/")({
  component: GamePage,
  head: () => ({
    meta: [
      { title: "Colheita Feliz — Sua fazenda online" },
      { name: "description", content: "Plante, colhe, crie animais e construa sua fazenda dos sonhos." },
    ],
  }),
});

type Profile = { id: string; username: string; coins: number; xp: number; level: number };
type PlotRow = { id: string; slot_index: number; crop_type: string | null; planted_at: string | null };
type AnimalRow = { id: string; animal_type: string; last_collected_at: string };
type InvRow = { item_type: string; quantity: number };

function GamePage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [plots, setPlots] = useState<PlotRow[]>([]);
  const [animals, setAnimals] = useState<AnimalRow[]>([]);
  const [inventory, setInventory] = useState<InvRow[]>([]);
  const [selectedSeed, setSelectedSeed] = useState<string>("morango");
  const [tab, setTab] = useState<"shop" | "inventory" | "animals">("shop");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { navigate({ to: "/login" }); return; }
      setUserId(data.session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!s) navigate({ to: "/login" });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function reload() {
    if (!userId) return;
    const [p, pl, an, inv] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("plots").select("*").eq("user_id", userId).order("slot_index"),
      supabase.from("animals").select("*").eq("user_id", userId).order("created_at"),
      supabase.from("inventory").select("*").eq("user_id", userId),
    ]);
    if (p.data) setProfile(p.data as Profile);
    if (pl.data) setPlots(pl.data as PlotRow[]);
    if (an.data) setAnimals(an.data as AnimalRow[]);
    if (inv.data) setInventory(inv.data as InvRow[]);
    setLoading(false);
  }

  useEffect(() => { if (userId) reload(); }, [userId]);

  async function addCoinsXp(deltaCoins: number, deltaXp: number) {
    if (!profile) return;
    const newCoins = profile.coins + deltaCoins;
    const newXp = profile.xp + deltaXp;
    const { level } = xpToLevel(newXp);
    setProfile({ ...profile, coins: newCoins, xp: newXp, level });
    await supabase.from("profiles").update({ coins: newCoins, xp: newXp, level }).eq("id", profile.id);
    if (level > profile.level) toast.success(`🎉 Subiu para nível ${level}!`);
  }

  async function bumpInventory(item: string, delta: number) {
    if (!userId) return;
    const existing = inventory.find((i) => i.item_type === item);
    const newQty = (existing?.quantity ?? 0) + delta;
    if (newQty <= 0) {
      setInventory(inventory.filter((i) => i.item_type !== item));
      await supabase.from("inventory").delete().eq("user_id", userId).eq("item_type", item);
    } else {
      setInventory([...inventory.filter((i) => i.item_type !== item), { item_type: item, quantity: newQty }]);
      await supabase.from("inventory").upsert({ user_id: userId, item_type: item, quantity: newQty });
    }
  }

  async function handlePlot(plot: PlotRow) {
    if (!profile) return;
    const stage = getCropStage(plot.planted_at, plot.crop_type);
    if (stage === "ready" && plot.crop_type) {
      const crop = CROPS[plot.crop_type];
      setPlots(plots.map((p) => p.id === plot.id ? { ...p, crop_type: null, planted_at: null } : p));
      await supabase.from("plots").update({ crop_type: null, planted_at: null }).eq("id", plot.id);
      await bumpInventory(crop.id, 1);
      await addCoinsXp(0, crop.xp);
      toast.success(`Colheu 1 ${crop.name} ${crop.emoji}! +${crop.xp} XP`);
    } else if (stage === "empty") {
      const crop = CROPS[selectedSeed];
      if (profile.coins < crop.seedCost) { toast.error("Moedas insuficientes!"); return; }
      const now = new Date().toISOString();
      setPlots(plots.map((p) => p.id === plot.id ? { ...p, crop_type: crop.id, planted_at: now } : p));
      await supabase.from("plots").update({ crop_type: crop.id, planted_at: now }).eq("id", plot.id);
      await addCoinsXp(-crop.seedCost, 0);
    } else {
      toast("Ainda crescendo...", { icon: "🌿" });
    }
  }

  async function buyAnimal(animalId: string) {
    if (!profile || !userId) return;
    const a = ANIMALS[animalId];
    if (profile.coins < a.buyCost) { toast.error("Moedas insuficientes!"); return; }
    const { data } = await supabase.from("animals").insert({
      user_id: userId, animal_type: animalId,
      last_collected_at: new Date(Date.now() - a.cooldownSeconds * 1000).toISOString(),
    }).select().single();
    if (data) setAnimals([...animals, data as AnimalRow]);
    await addCoinsXp(-a.buyCost, 0);
    toast.success(`Comprou ${a.name} ${a.emoji}!`);
  }

  async function collectAnimal(animal: AnimalRow) {
    const a = ANIMALS[animal.animal_type];
    const now = new Date().toISOString();
    setAnimals(animals.map((x) => x.id === animal.id ? { ...x, last_collected_at: now } : x));
    await supabase.from("animals").update({ last_collected_at: now }).eq("id", animal.id);
    await bumpInventory(a.produces.toLowerCase(), 1);
    await addCoinsXp(0, a.xp);
    toast.success(`Coletou ${a.productEmoji} ${a.produces}! +${a.xp} XP`);
  }

  async function sellItem(item: string, qty: number = 1) {
    const inv = inventory.find((i) => i.item_type === item);
    if (!inv || inv.quantity < qty) return;
    const crop = CROPS[item];
    const animal = Object.values(ANIMALS).find((a) => a.produces.toLowerCase() === item);
    const price = crop?.sellPrice ?? animal?.productSell ?? 0;
    await bumpInventory(item, -qty);
    await addCoinsXp(price * qty, 0);
    toast.success(`Vendeu ${qty}x por 🪙 ${price * qty}`);
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  const levelInfo = useMemo(() => profile ? xpToLevel(profile.xp) : null, [profile]);

  if (loading || !profile) {
    return <div className="min-h-screen flex items-center justify-center text-2xl">🌻 Carregando fazenda...</div>;
  }

  return (
    <main className="min-h-screen pb-8">
      <Toaster position="top-center" richColors />

      {/* HUD */}
      <header className="sticky top-0 z-10 backdrop-blur-md bg-card/80 border-b-2 border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 font-extrabold">
            <span className="text-2xl">🌻</span>
            <span className="hidden sm:inline">Colheita Feliz</span>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <div className="text-sm">
              <div className="font-bold text-xs text-muted-foreground">{profile.username}</div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-primary text-primary-foreground rounded-full px-2 py-0.5">Nv {profile.level}</span>
                {levelInfo && (
                  <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${levelInfo.progress * 100}%` }} />
                  </div>
                )}
              </div>
            </div>
            <CoinBadge amount={profile.coins} />
            <button onClick={logout} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">Sair</button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 mt-6 grid lg:grid-cols-[1fr_360px] gap-6">
        {/* Farm */}
        <section>
          <div className="panel-wood rounded-2xl p-1">
            <div className="bg-grass/30 rounded-xl p-4">
              <h2 className="font-extrabold text-lg mb-3 flex items-center gap-2">
                🚜 Sua Fazenda
                <span className="text-xs font-normal text-muted-foreground">
                  Plantando: {CROPS[selectedSeed].emoji} {CROPS[selectedSeed].name} (🪙 {CROPS[selectedSeed].seedCost})
                </span>
              </h2>
              <div className="grid grid-cols-4 gap-3">
                {plots.map((p) => (
                  <Plot key={p.id} cropType={p.crop_type} plantedAt={p.planted_at} onClick={() => handlePlot(p)} />
                ))}
              </div>
            </div>
          </div>

          {/* Animals area */}
          <div className="panel-wood rounded-2xl p-1 mt-5">
            <div className="bg-sky/30 rounded-xl p-4">
              <h2 className="font-extrabold text-lg mb-3">🏡 Animais da Fazenda</h2>
              {animals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Compre animais na loja → eles produzem ovos, leite e mais!
                </p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {animals.map((a) => (
                    <AnimalCard key={a.id} animalType={a.animal_type} lastCollected={a.last_collected_at} onCollect={() => collectAnimal(a)} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Side panel: Shop / Inventory / Animals */}
        <aside>
          <div className="panel-wood rounded-2xl p-1 sticky top-24">
            <div className="bg-card rounded-xl">
              <div className="flex border-b-2 border-border">
                {(["shop", "inventory", "animals"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`flex-1 py-3 text-sm font-bold transition ${tab === t ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    {t === "shop" ? "🌱 Sementes" : t === "inventory" ? "📦 Estoque" : "🐾 Animais"}
                  </button>
                ))}
              </div>

              <div className="p-3 max-h-[60vh] overflow-y-auto">
                {tab === "shop" && (
                  <div className="space-y-2">
                    {Object.values(CROPS).map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setSelectedSeed(c.id)}
                        className={`w-full p-2.5 rounded-lg flex items-center gap-3 border-2 transition btn-pop ${
                          selectedSeed === c.id ? "border-primary bg-primary/10" : "border-border hover:bg-muted"
                        }`}
                      >
                        <span className="text-3xl">{c.emoji}</span>
                        <div className="flex-1 text-left">
                          <div className="font-bold text-sm">{c.name}</div>
                          <div className="text-xs text-muted-foreground">
                            🪙 {c.seedCost} • {c.growSeconds < 60 ? `${c.growSeconds}s` : `${Math.round(c.growSeconds / 60)}m`} • vende 🪙 {c.sellPrice}
                          </div>
                        </div>
                        {selectedSeed === c.id && <span className="text-primary font-bold">✓</span>}
                      </button>
                    ))}
                  </div>
                )}

                {tab === "inventory" && (
                  <div className="space-y-2">
                    {inventory.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">Estoque vazio. Colhe alguma coisa!</p>
                    )}
                    {inventory.map((i) => {
                      const crop = CROPS[i.item_type];
                      const animalProd = Object.values(ANIMALS).find((a) => a.produces.toLowerCase() === i.item_type);
                      const emoji = crop?.emoji ?? animalProd?.productEmoji ?? "📦";
                      const name = crop?.name ?? animalProd?.produces ?? i.item_type;
                      const price = crop?.sellPrice ?? animalProd?.productSell ?? 0;
                      return (
                        <div key={i.item_type} className="p-2.5 rounded-lg border-2 border-border bg-muted/50 flex items-center gap-2">
                          <span className="text-2xl">{emoji}</span>
                          <div className="flex-1">
                            <div className="font-bold text-sm">{name}</div>
                            <div className="text-xs text-muted-foreground">x{i.quantity} • 🪙 {price} cada</div>
                          </div>
                          <button
                            onClick={() => sellItem(i.item_type, 1)}
                            className="px-3 py-1.5 bg-accent text-accent-foreground rounded-md text-xs font-bold btn-pop hover:brightness-110"
                          >Vender</button>
                          {i.quantity > 1 && (
                            <button
                              onClick={() => sellItem(i.item_type, i.quantity)}
                              className="px-2 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-bold btn-pop hover:brightness-110"
                            >Tudo</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {tab === "animals" && (
                  <div className="space-y-2">
                    {Object.values(ANIMALS).map((a) => (
                      <div key={a.id} className="p-2.5 rounded-lg border-2 border-border bg-muted/50 flex items-center gap-3">
                        <span className="text-3xl">{a.emoji}</span>
                        <div className="flex-1">
                          <div className="font-bold text-sm">{a.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {a.productEmoji} a cada {Math.round(a.cooldownSeconds / 60) || `${a.cooldownSeconds}s`}m
                          </div>
                        </div>
                        <button
                          onClick={() => buyAnimal(a.id)}
                          disabled={profile.coins < a.buyCost}
                          className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-bold btn-pop disabled:opacity-50"
                        >🪙 {a.buyCost}</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

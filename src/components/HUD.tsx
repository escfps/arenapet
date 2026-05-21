import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CoinBadge, GemBadge, VipBadge } from "./CoinBadge";
import { SoundControl } from "./SoundControl";
import { MobileNav, MobileDrawerButton } from "./MobileNav";
import { isVip, getTier } from "@/lib/game-data";
import { supabase } from "@/integrations/supabase/client";

export type ProfileRow = {
  id: string;
  username: string;
  coins: number;
  gems: number;
  xp: number;
  level: number;
  vip_until: string | null;
  wins: number;
  losses: number;
  expedition_slots: number;
  arena_points: number;
  welcome_chest_claimed?: boolean;
};

export function HUD({ profile }: { profile: ProfileRow }) {
  const navigate = useNavigate();
  const vip = isVip(profile.vip_until);
  const tier = getTier(profile.arena_points ?? 0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function logout() {
    try { localStorage.removeItem("arenapet:remember"); } catch {}
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <>
    <header className="sticky top-0 z-20 backdrop-blur-md bg-purple-950/70 border-b-2 border-purple-400/30 shadow-lg">
      <div className="max-w-6xl mx-auto px-2 py-1.5 flex items-center gap-1.5 md:gap-2 md:flex-wrap md:px-3 md:py-2">
        <MobileDrawerButton onOpen={() => setDrawerOpen(true)} />
        <Link to="/" className="hidden md:flex font-extrabold text-white items-center gap-1.5 hover:scale-105 transition">
          <span className="text-xl">🐲</span>
          <span className="text-sm">ARENA PET</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1 ml-2">
          <NavLink to="/" label="Home" emoji="🏠" />
          <NavLink to="/arena" label="Arena" emoji="⚔️" />
          <NavLink to="/tournament" label="Copa" emoji="🏆" />
          <NavLink to="/ranking" label="Ranking" emoji="📊" />
          <NavLink to="/history" label="Histórico" emoji="📜" />
          <NavLink to="/forge" label="Elevar" emoji="⭐" />
          <NavLink to="/trade" label="Trocas" emoji="🔄" />
          <NavLink to="/expeditions" label="Expedições" emoji="🗺️" />
          <NavLink to="/collection" label="Coleção" emoji="📖" />
          <NavLink to="/shop" label="Loja" emoji="🛒" />
        </nav>
        <Link to="/profile" className="text-white hover:scale-105 transition min-w-0 flex-1 md:flex-none md:text-right md:ml-auto">
          <div className="text-base md:text-sm font-extrabold flex items-center gap-1.5 md:justify-end hover:underline leading-tight">
            <span className="truncate">{profile.username}</span>
          </div>
          <div className="text-[10px] opacity-90 flex items-center gap-1 md:justify-end whitespace-nowrap mt-0.5">
            {vip && <VipBadge />}
            {vip && <span className="text-white/40">•</span>}
            <span className={`px-1.5 py-0.5 rounded font-extrabold whitespace-nowrap ${tier.color}`}>{tier.emoji}&nbsp;{tier.short}</span>
          </div>
        </Link>
        
        <div className="flex items-center gap-1.5 shrink-0">
          <CoinBadge amount={profile.coins} />
          <GemBadge amount={profile.gems} />
          <SoundControl />
          <button onClick={logout} className="hidden md:inline text-[10px] text-white/70 hover:text-white px-1.5">Sair</button>
        </div>

      </div>
    </header>
    <MobileNav open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

function NavLink({ to, label, emoji }: { to: string; label: string; emoji: string }) {
  return (
    <Link
      to={to}
      className="px-2.5 py-1 rounded-lg text-white text-xs font-bold hover:bg-white/15 transition flex items-center gap-1"
      activeProps={{ className: "bg-white/25" }}
    >
      <span>{emoji}</span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

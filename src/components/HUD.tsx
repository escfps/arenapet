import { Link, useNavigate } from "@tanstack/react-router";
import { CoinBadge, GemBadge, VipBadge } from "./CoinBadge";
import { isVip } from "@/lib/game-data";
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
};

export function HUD({ profile }: { profile: ProfileRow }) {
  const navigate = useNavigate();
  const vip = isVip(profile.vip_until);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <header className="sticky top-0 z-20 backdrop-blur-md bg-purple-950/70 border-b-2 border-purple-400/30 shadow-lg">
      <div className="max-w-6xl mx-auto px-3 py-2 flex items-center gap-2 flex-wrap">
        <Link to="/" className="font-extrabold text-white flex items-center gap-1.5 hover:scale-105 transition">
          <span className="text-xl">🐲</span>
          <span className="hidden sm:inline text-sm">MonstroBattle</span>
        </Link>
        <nav className="flex items-center gap-1 ml-2">
          <NavLink to="/" label="Pátio" emoji="🏠" />
          <NavLink to="/arena" label="Arena" emoji="⚔️" />
          <NavLink to="/forge" label="Forja" emoji="🔨" />
          <NavLink to="/trade" label="Trocas" emoji="🔄" />
          <NavLink to="/collection" label="Coleção" emoji="📖" />
          <NavLink to="/shop" label="Loja" emoji="🛒" />
        </nav>
        <div className="flex items-center gap-1.5 ml-auto flex-wrap">
          <div className="text-right text-white">
            <div className="text-[10px] font-bold opacity-80 flex items-center gap-1 justify-end">
              {profile.username} {vip && <VipBadge />}
            </div>
            <div className="text-[10px] opacity-80">
              Nv {profile.level} • {profile.wins}V/{profile.losses}D
            </div>
          </div>
          <CoinBadge amount={profile.coins} />
          <GemBadge amount={profile.gems} />
          <button onClick={logout} className="text-[10px] text-white/70 hover:text-white px-1.5">Sair</button>
        </div>
      </div>
    </header>
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

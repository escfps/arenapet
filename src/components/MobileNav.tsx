import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const bottomItems = [
  { to: "/", label: "Início", emoji: "🏠" },
  { to: "/arena", label: "Arena", emoji: "⚔️" },
  { to: "/ranking", label: "Ranking", emoji: "📊" },
  { to: "/tournament", label: "Copa", emoji: "🏆" },
  { to: "/forge", label: "Elevar", emoji: "⭐" },
  { to: "/collection", label: "Coleção", emoji: "🎒" },
] as const;

const drawerItems = [
  { to: "/friends", label: "Amigos", emoji: "👥" },
  { to: "/shop", label: "Loja", emoji: "🏪" },
  { to: "/profile", label: "Perfil", emoji: "👤" },
  { to: "/history", label: "Histórico", emoji: "📜" },
  { to: "/trade", label: "Trocas", emoji: "🔄" },
  { to: "/expeditions", label: "Expedições", emoji: "🗺️" },
  { to: "/redeem", label: "Resgatar Código", emoji: "🎁" },
] as const;

export function MobileDrawerButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      aria-label="Abrir menu"
      className="p-2 rounded-lg text-white hover:bg-white/15 transition"
    >
      <Menu className="w-5 h-5" />
    </button>
  );
}

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Close drawer on route change
  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line

  // Lock scroll while drawer is open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  async function logout() {
    try { localStorage.removeItem("arenapet:remember"); } catch {}
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  }

  return (
    <>
      {/* Bottom Navigation Bar (mobile only) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-purple-950/95 backdrop-blur-md border-t-2 border-purple-400/30 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex items-stretch justify-around">
          {bottomItems.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <li key={item.to} className="flex-1">
                <Link
                  to={item.to}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2 px-1 min-h-[56px] transition ${
                    active
                      ? "text-yellow-300"
                      : "text-white/80 hover:text-white active:bg-white/10"
                  }`}
                >
                  <span className="text-xl leading-none">{item.emoji}</span>
                  <span className="text-[10px] font-bold leading-none">{item.label}</span>
                  {active && <span className="absolute top-0 h-0.5 w-8 rounded-b bg-yellow-300" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Drawer (mobile only) */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in"
            onClick={onClose}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 bottom-0 w-72 max-w-[80%] bg-purple-950 border-r-2 border-purple-400/30 shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <span className="font-extrabold text-white flex items-center gap-2">
                <span className="text-2xl">🐲</span> ARENA PET
              </span>
              <button
                onClick={onClose}
                aria-label="Fechar menu"
                className="p-1.5 rounded-lg text-white/80 hover:bg-white/15"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto p-2">
              {drawerItems.map((item) => {
                const active = pathname.startsWith(item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-base font-bold transition ${
                        active
                          ? "bg-yellow-300/20 text-yellow-300"
                          : "text-white hover:bg-white/10"
                      }`}
                    >
                      <span className="text-2xl">{item.emoji}</span>
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            <div className="p-3 border-t border-white/10">
              <button
                onClick={logout}
                className="w-full px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm"
              >
                Sair
              </button>
            </div>
          </aside>
        </div>
      )}
    </>
  );
}

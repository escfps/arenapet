import { Link } from "@tanstack/react-router";

export function CoinBadge({ amount }: { amount: number }) {
  return (
    <Link
      to="/shop"
      aria-label="Abrir loja"
      className="rounded-full px-2 py-0.5 flex items-center gap-1 font-extrabold text-amber-100 bg-gradient-to-b from-amber-600 to-amber-800 border border-amber-900/60 hover:scale-105 active:scale-95 transition"
    >
      <span className="text-sm">🪙</span>
      <span className="tabular-nums text-xs">{amount.toLocaleString("pt-BR")}</span>
    </Link>
  );
}

export function GemBadge({ amount }: { amount: number }) {
  return (
    <Link
      to="/shop"
      aria-label="Abrir loja"
      className="rounded-full px-3 py-1 flex items-center gap-1.5 font-extrabold text-white bg-gradient-to-b from-fuchsia-500 to-purple-700 border-2 border-purple-300 shadow-[inset_0_2px_0_rgba(255,255,255,0.4),0_2px_0_rgba(126,34,206,1)] hover:scale-105 active:scale-95 transition"
    >
      <span className="text-base">💎</span>
      <span className="tabular-nums text-sm">{amount.toLocaleString("pt-BR")}</span>
    </Link>
  );
}

export function VipBadge() {
  return (
    <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 text-yellow-950 text-[10px] font-extrabold border-2 border-yellow-600 shadow-md">
      👑 VIP
    </span>
  );
}

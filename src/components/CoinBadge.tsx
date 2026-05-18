export function CoinBadge({ amount }: { amount: number }) {
  return (
    <div className="coin-badge rounded-full px-3 py-1 flex items-center gap-1.5 font-extrabold text-amber-900">
      <span className="text-base">🪙</span>
      <span className="tabular-nums text-sm">{amount.toLocaleString("pt-BR")}</span>
    </div>
  );
}

export function GemBadge({ amount }: { amount: number }) {
  return (
    <div className="rounded-full px-3 py-1 flex items-center gap-1.5 font-extrabold text-white bg-gradient-to-b from-fuchsia-500 to-purple-700 border-2 border-purple-300 shadow-[inset_0_2px_0_rgba(255,255,255,0.4),0_2px_0_rgba(126,34,206,1)]">
      <span className="text-base">💎</span>
      <span className="tabular-nums text-sm">{amount.toLocaleString("pt-BR")}</span>
    </div>
  );
}

export function VipBadge() {
  return (
    <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 text-yellow-950 text-[10px] font-extrabold border-2 border-yellow-600 shadow-md">
      👑 VIP
    </span>
  );
}

export function CoinBadge({ amount }: { amount: number }) {
  return (
    <div className="coin-badge rounded-full px-4 py-1.5 flex items-center gap-2 font-extrabold text-amber-900">
      <span className="text-lg">🪙</span>
      <span className="tabular-nums">{amount.toLocaleString("pt-BR")}</span>
    </div>
  );
}

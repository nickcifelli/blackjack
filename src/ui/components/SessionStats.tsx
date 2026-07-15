export function SessionStats({ correct, total }: { correct: number; total: number }) {
  const pct = total > 0 ? (correct / total) * 100 : 0;
  return (
    <div className="session-stats">
      Session accuracy: {correct}/{total}
      {total > 0 ? ` (${pct.toFixed(0)}%)` : ''}
    </div>
  );
}

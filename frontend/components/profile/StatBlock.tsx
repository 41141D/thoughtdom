export default function StatBlock({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="font-display text-xl font-semibold text-text">{value}</div>
      <div className="text-xs text-muted mt-0.5">{label}</div>
    </div>
  );
}

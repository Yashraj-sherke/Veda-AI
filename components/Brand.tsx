export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="VedaAI">
      <span className="brand-mark">V</span>
      {!compact && <span className="brand-name">VedaAI</span>}
    </div>
  );
}

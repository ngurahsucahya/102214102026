/** Logo pintu sederhana: frame, divider, dan gagang. */
export function DoorMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 80" className={className} aria-hidden>
      <rect x="3" y="3" width="50" height="74" rx="3" fill="#eff4ff" stroke="#1e40af" strokeWidth="5" />
      <rect x="8" y="37" width="40" height="5" fill="#1e40af" />
      <rect x="44" y="30" width="5" height="18" rx="2" fill="#d97706" />
    </svg>
  );
}

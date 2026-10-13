/** "Scroll" cue: a hairline with a purple drop running down it (Shade hero `.cue`). */
export function ScrollCue({ label = 'scroll', className = '' }: { label?: string; className?: string }) {
  return (
    <div aria-hidden className={`m-cue ${className}`}>
      <span>{label}</span>
      <i />
    </div>
  );
}

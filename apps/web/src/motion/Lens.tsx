/**
 * Film lens: a soft vignette plus a static fractal-noise grain, fixed over the
 * page (Shade landing `.lens`). Static (no animation), pointer-transparent.
 */
export function Lens({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden className={`m-lens ${className}`}>
      <div className="m-lens-vig" />
      <div className="m-lens-grain" />
    </div>
  );
}

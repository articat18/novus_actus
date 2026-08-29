import type { SVGProps } from "react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand${compact ? " brand--compact" : ""}`} aria-label="Novus Actus Interveniens">
      <span className="brand__mark" aria-hidden="true">
        <LeafIcon />
      </span>
      <span className="brand__name">
        <strong>Novus Actus</strong>
        {!compact && <small>Interveniens</small>}
      </span>
    </div>
  );
}

export function LeafIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 28 28" fill="none" {...props}>
      <path
        d="M22.9 4.2C15.2 4.5 8.3 7.1 6.1 12.1c-1.3 3-.7 6.3 1.3 8.4 2.2 2.3 6 2.8 9.1 1.1 5.2-2.9 6.3-10.4 6.4-17.4Z"
        fill="currentColor"
      />
      <path
        d="M4.6 23.9c3.8-5.6 7.8-9.4 13.8-12.6"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function EyeIcon({ closed = false }: { closed?: boolean }) {
  return closed ? (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m4 4 16 16M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 5.2A10.4 10.4 0 0 1 12 5c5.5 0 9 7 9 7a17 17 0 0 1-2.1 3M6.6 6.6C4.3 8.2 3 10.8 3 12c0 0 3.5 7 9 7 1.4 0 2.6-.4 3.7-1"
        stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M3 12s3.5-7 9-7 9 7 9 7-3.5 7-9 7-9-7-9-7Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

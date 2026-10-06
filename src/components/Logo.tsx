import { useId } from 'react';

/**
 * Logo de VillaMusic: una "V" de Villarreal con un ecualizador adentro,
 * sobre un degradado cálido (volcán Galeras al amanecer).
 * La misma imagen vive en /public/logo.svg para el favicon.
 */
export function Logo({ size = 40 }: { size?: number }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="VillaMusic">
      <defs>
        <linearGradient id={`g${id}`} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#g${id})`} />
      <path
        d="M16 16 L32 48 L48 16"
        fill="none"
        stroke="#fff"
        strokeWidth="6.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g fill="#fff" opacity="0.95">
        <rect x="24.2" y="19" width="2" height="5" rx="1" />
        <rect x="27.6" y="17" width="2" height="9" rx="1" />
        <rect x="31" y="14.5" width="2" height="14" rx="1" />
        <rect x="34.4" y="17" width="2" height="9" rx="1" />
        <rect x="37.8" y="19" width="2" height="5" rx="1" />
      </g>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <span className="wordmark-name">
        <b>Villa</b>Music
      </span>
      <small>Hecho en Pasto</small>
    </span>
  );
}

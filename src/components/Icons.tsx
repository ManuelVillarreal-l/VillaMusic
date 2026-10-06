import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  className?: string;
  strokeWidth?: number;
}

function stroke(children: ReactNode) {
  return function Icon({ size = 20, className, strokeWidth = 2 }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
      >
        {children}
      </svg>
    );
  };
}

function solid(children: ReactNode) {
  return function Icon({ size = 20, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="currentColor"
        stroke="none"
        className={className}
        aria-hidden="true"
      >
        {children}
      </svg>
    );
  };
}

export const IconPlay = solid(
  <path d="M7 4.6v14.8a1 1 0 0 0 1.52.85l12-7.4a1 1 0 0 0 0-1.7l-12-7.4A1 1 0 0 0 7 4.6z" />,
);

export const IconPause = solid(
  <>
    <rect x="5.5" y="4" width="4.5" height="16" rx="1.5" />
    <rect x="14" y="4" width="4.5" height="16" rx="1.5" />
  </>,
);

export const IconSkipNext = solid(
  <>
    <path d="M5 5.4v13.2a1 1 0 0 0 1.55.83l9.6-6.6a1 1 0 0 0 0-1.66l-9.6-6.6A1 1 0 0 0 5 5.4z" />
    <rect x="17.6" y="4.5" width="2.6" height="15" rx="1.3" />
  </>,
);

export const IconSkipPrev = solid(
  <g transform="translate(24 0) scale(-1 1)">
    <path d="M5 5.4v13.2a1 1 0 0 0 1.55.83l9.6-6.6a1 1 0 0 0 0-1.66l-9.6-6.6A1 1 0 0 0 5 5.4z" />
    <rect x="17.6" y="4.5" width="2.6" height="15" rx="1.3" />
  </g>,
);

export const IconGrip = solid(
  <>
    <circle cx="9" cy="6" r="1.5" />
    <circle cx="15" cy="6" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="9" cy="18" r="1.5" />
    <circle cx="15" cy="18" r="1.5" />
  </>,
);

export const IconShuffle = stroke(
  <>
    <path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22" />
    <path d="m18 2 4 4-4 4" />
    <path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" />
    <path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8" />
    <path d="m18 14 4 4-4 4" />
  </>,
);

export const IconRepeat = stroke(
  <>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
  </>,
);

export const IconRepeatOne = stroke(
  <>
    <path d="m17 2 4 4-4 4" />
    <path d="M3 11v-1a4 4 0 0 1 4-4h14" />
    <path d="m7 22-4-4 4-4" />
    <path d="M21 13v1a4 4 0 0 1-4 4H3" />
    <path d="M11 10h1v4" />
  </>,
);

export const IconRewind = stroke(
  <>
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </>,
);

export const IconForward = stroke(
  <>
    <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
  </>,
);

export const IconVolume = stroke(
  <>
    <path d="M4 9v6h3.5l4.5 4V5L7.5 9H4z" />
    <path d="M16 9a4.5 4.5 0 0 1 0 6" />
    <path d="M19 6.5a8.5 8.5 0 0 1 0 11" />
  </>,
);

export const IconVolumeMute = stroke(
  <>
    <path d="M4 9v6h3.5l4.5 4V5L7.5 9H4z" />
    <path d="m16 9 5 6" />
    <path d="m21 9-5 6" />
  </>,
);

export const IconTrash = stroke(
  <>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </>,
);

export const IconPlus = stroke(
  <>
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </>,
);

export const IconSearch = stroke(
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </>,
);

export const IconUpload = stroke(
  <>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <path d="m17 8-5-5-5 5" />
    <path d="M12 3v12" />
  </>,
);

export const IconMusic = stroke(
  <>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </>,
);

export const IconList = stroke(
  <>
    <path d="M21 15V6" />
    <circle cx="18.5" cy="15.5" r="2.5" />
    <path d="M12 12H3" />
    <path d="M16 6H3" />
    <path d="M12 18H3" />
  </>,
);

export const IconLink = stroke(
  <>
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </>,
);

export const IconClose = stroke(
  <>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </>,
);

export const IconUndo = stroke(
  <>
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </>,
);

export const IconSort = stroke(
  <>
    <path d="m21 16-4 4-4-4" />
    <path d="M17 20V4" />
    <path d="m3 8 4-4 4 4" />
    <path d="M7 4v16" />
  </>,
);

export const IconSwap = stroke(
  <>
    <path d="M8 3 4 7l4 4" />
    <path d="M4 7h16" />
    <path d="m16 21 4-4-4-4" />
    <path d="M20 17H4" />
  </>,
);

export const IconPencil = stroke(
  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />,
);

export const IconChevronDown = stroke(<path d="m6 9 6 6 6-6" />);

export const IconCheck = stroke(<path d="M20 6 9 17l-5-5" />);

export const IconDots = solid(
  <>
    <circle cx="5" cy="12" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="19" cy="12" r="1.8" />
  </>,
);

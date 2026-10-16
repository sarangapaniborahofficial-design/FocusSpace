import React from 'react';

export interface FocusSpaceLogoProps {
  size?: number;
  className?: string;
  theme?: string;
  animated?: boolean;
}

export const FocusSpaceLogo: React.FC<FocusSpaceLogoProps> = ({
  size = 24,
  className = '',
  theme,
  animated = false,
}) => {
  // Unique gradient id prefix to prevent collision
  const gradId = React.useId().replace(/:/g, '');

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
      style={{ overflow: 'visible' }}
      aria-label="FocusSpace Logo"
    >
      <defs>
        {/* Primary Radiant Focal Gradient */}
        <linearGradient id={`fs-grad-core-${gradId}`} x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.95" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.75" />
        </linearGradient>

        {/* Ambient Focal Glow */}
        <radialGradient id={`fs-glow-${gradId}`} cx="24" cy="24" r="20" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.25" />
          <stop offset="70%" stopColor="currentColor" stopOpacity="0.04" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Atmospheric Radial Focus Glow */}
      <circle cx="24" cy="24" r="20" fill={`url(#fs-glow-${gradId})`} />

      {/* Outer Tactile Aperture Squircle */}
      <rect
        x="3"
        y="3"
        width="42"
        height="42"
        rx="11"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeOpacity="0.9"
        fill="currentColor"
        fillOpacity="0.06"
      />

      {/* Precision Cardinal Reticles (0°, 90°, 180°, 270°) */}
      <path
        d="M24 3v4.5M24 40.5V45M3 24h4.5M40.5 24H45"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.85"
      />

      {/* Micro Navigation Coordinate Indices */}
      <circle cx="9" cy="9" r="1.2" fill="currentColor" fillOpacity="0.6" />
      <circle cx="39" cy="9" r="1.2" fill="currentColor" fillOpacity="0.6" />
      <circle cx="9" cy="39" r="1.2" fill="currentColor" fillOpacity="0.6" />
      <circle cx="39" cy="39" r="1.2" fill="currentColor" fillOpacity="0.6" />

      {/* Concentric Orbital Radar Ring */}
      <circle
        cx="24"
        cy="24"
        r="13.5"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeDasharray="2.5 3"
        strokeOpacity="0.45"
      />

      {/* Concentric Diamond Aperture (Rotated Focus Portal) */}
      <path
        d="M24 11.5L36.5 24L24 36.5L11.5 24Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
        fill="currentColor"
        fillOpacity="0.08"
      />

      {/* Inner Precision Focal Core (Singularity Square) */}
      <rect
        x="18"
        y="18"
        width="12"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="currentColor"
        fillOpacity="0.22"
      />

      {/* Center Focus Pupil / Laser Point */}
      <circle
        cx="24"
        cy="24"
        r="3"
        fill="currentColor"
        className={animated ? 'animate-pulse' : ''}
      />

      {/* Central Crosshair Micro-Markers */}
      <path
        d="M22 24h4M24 22v4"
        stroke="var(--bg-surface, #000)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
};

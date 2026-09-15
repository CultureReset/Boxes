/**
 * Procedural sunrise-over-mountains artwork. Used when the machine has no
 * wallpaper yet; on Omarchy the daemon serves the current theme background.
 */
export function HeroArt() {
  return (
    <svg viewBox="0 0 1200 520" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b1220" />
          <stop offset="0.45" stopColor="#1b2438" />
          <stop offset="0.75" stopColor="#5a3a3a" />
          <stop offset="1" stopColor="#c9743a" />
        </linearGradient>
        <radialGradient id="sun" cx="0.62" cy="0.72" r="0.35">
          <stop offset="0" stopColor="#ffd9a3" stopOpacity="0.95" />
          <stop offset="0.25" stopColor="#ff9c4a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#ff7a2a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="m1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a3346" />
          <stop offset="1" stopColor="#0d121c" />
        </linearGradient>
        <linearGradient id="m2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3b4459" />
          <stop offset="1" stopColor="#141a26" />
        </linearGradient>
        <linearGradient id="m3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a2130" />
          <stop offset="1" stopColor="#0a0d13" />
        </linearGradient>
        <linearGradient id="snow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6e9dc" />
          <stop offset="1" stopColor="#f6e9dc" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="1200" height="520" fill="url(#sky)" />
      <rect width="1200" height="520" fill="url(#sun)" />
      <g opacity="0.55" fill="#fff">
        <circle cx="120" cy="60" r="1.2" />
        <circle cx="260" cy="110" r="0.9" />
        <circle cx="420" cy="40" r="1.1" />
        <circle cx="560" cy="90" r="0.8" />
        <circle cx="900" cy="50" r="1" />
        <circle cx="1080" cy="120" r="0.9" />
        <circle cx="760" cy="30" r="1.1" />
      </g>
      <path d="M0 400 L140 300 L230 340 L340 250 L420 300 L520 220 L620 310 L700 260 L800 330 L900 240 L1000 320 L1100 270 L1200 330 L1200 520 L0 520Z" fill="url(#m3)" />
      <path d="M0 440 L110 360 L200 390 L300 320 L380 370 L470 300 L560 380 L650 340 L740 400 L830 330 L920 390 L1010 340 L1100 400 L1200 360 L1200 520 L0 520Z" fill="url(#m2)" />
      <path d="M300 320 L340 345 L380 370 L360 350 L330 352Z" fill="url(#snow)" opacity="0.7" />
      <path d="M470 300 L510 335 L560 380 L530 350 L500 348Z" fill="url(#snow)" opacity="0.7" />
      <path d="M830 330 L870 360 L920 390 L890 365 L860 362Z" fill="url(#snow)" opacity="0.7" />
      <path d="M0 500 L90 440 L170 470 L260 420 L350 460 L440 410 L540 470 L640 430 L730 480 L830 440 L930 490 L1030 450 L1120 480 L1200 450 L1200 520 L0 520Z" fill="url(#m1)" />
    </svg>
  );
}

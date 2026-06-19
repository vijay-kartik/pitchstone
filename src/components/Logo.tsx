type Props = { size?: number; id?: string }

// 3D pitchstone monolith — matte two-facet stone with a glowing violet seam and node.
export default function Logo({ size = 24, id = 'ps' }: Props) {
  const w = Math.round((size * 200) / 240)
  return (
    <svg
      width={w}
      height={size}
      viewBox="0 0 200 240"
      fill="none"
      aria-hidden="true"
      style={{ flexShrink: 0, overflow: 'visible' }}
    >
      <defs>
        <linearGradient id={`${id}-left`} x1="60" y1="20" x2="118" y2="210" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7d7d88" />
          <stop offset="0.5" stopColor="#54545f" />
          <stop offset="1" stopColor="#3f3f49" />
        </linearGradient>
        <linearGradient id={`${id}-right`} x1="152" y1="60" x2="118" y2="210" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#43434d" />
          <stop offset="1" stopColor="#2c2c34" />
        </linearGradient>
        <linearGradient id={`${id}-top`} x1="106" y1="20" x2="106" y2="70" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9a9aa4" />
          <stop offset="1" stopColor="#7d7d88" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-seam`} x1="82" y1="190" x2="146" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#6d2fb8" />
          <stop offset="1" stopColor="#cba2ff" />
        </linearGradient>
        <radialGradient id={`${id}-node`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.25" stopColor="#edd6ff" />
          <stop offset="0.5" stopColor="#b24dff" />
          <stop offset="0.8" stopColor="#9b4dff" stopOpacity="0.22" />
          <stop offset="1" stopColor="#9b4dff" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-glow`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="2.6" />
        </filter>
      </defs>

      {/* right (shadow) face */}
      <path d="M106 26 L152 80 L140 208 L112 207 Z" fill={`url(#${id}-right)`} />
      {/* left (lit) face */}
      <path d="M106 26 L66 92 L78 198 L112 207 Z" fill={`url(#${id}-left)`} />
      {/* top apex highlight */}
      <path d="M106 26 L66 92 L112 207 Z" fill={`url(#${id}-top)`} opacity="0.5" />
      {/* left rim light */}
      <path d="M106 26 L66 92 L78 198" stroke="#9a9aa4" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" opacity="0.55" />
      {/* central ridge shadow */}
      <path d="M106 26 L112 207" stroke="#1d1d24" strokeWidth="1.4" opacity="0.55" />

      {/* seam glow */}
      <line x1="82" y1="190" x2="146" y2="96" stroke="#9b4dff" strokeWidth="6" opacity="0.55" strokeLinecap="round" filter={`url(#${id}-glow)`} />
      {/* seam core */}
      <line x1="82" y1="190" x2="146" y2="96" stroke={`url(#${id}-seam)`} strokeWidth="2.4" strokeLinecap="round" />

      {/* node halo + core */}
      <circle cx="146" cy="96" r="26" fill={`url(#${id}-node)`} />
      <circle cx="146" cy="96" r="4.2" fill="#f7eeff" />
    </svg>
  )
}

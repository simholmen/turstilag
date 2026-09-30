import { OWNER_ICON } from '../../models/owners'

// The grunneier symbol: a rounded square in the owner's colour. Without a colour it's the neutral
// legend version, since every owner has their own colour on the map.
export default function OwnerSymbol({ color = 'var(--ink)', size = 20, className = '' }) {
  return (
    <span
      className={`wl-kind-square ${className}`}
      style={{ width: size, height: size, background: color, borderRadius: Math.round(size / 4) }}
      title="Grunneier"
    >
      <span className="wl-ico" style={{ width: Math.round(size * 0.6), height: Math.round(size * 0.6) }} dangerouslySetInnerHTML={{ __html: OWNER_ICON }} />
    </span>
  )
}

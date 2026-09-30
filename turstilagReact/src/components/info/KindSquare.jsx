import { TYPES } from '../../models/worklog'

// Rounded-square kind symbol — the "sign" language of Hva finnes and Turruter, matching the map markers
export default function KindSquare({ type, size = 20, className = '' }) {
  const t = TYPES[type] || TYPES.annet
  return (
    <span
      className={`wl-kind-square ${className}`}
      style={{ width: size, height: size, background: t.color, borderRadius: Math.round(size / 4) }}
      title={t.label}
    >
      <span className="wl-ico" style={{ width: Math.round(size * 0.6), height: Math.round(size * 0.6) }} dangerouslySetInnerHTML={{ __html: t.icon }} />
    </span>
  )
}

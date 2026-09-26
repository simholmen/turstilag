import { TYPES } from '../../models/worklog'

// Colored circle with the work type's icon, used in lists, chips and the legend
export default function TypeDot({ type, size = 20, className = '' }) {
  const t = TYPES[type] || TYPES.annet
  return (
    <span
      className={`wl-dot ${className}`}
      style={{ width: size, height: size, background: t.color }}
      title={t.label}
    >
      <span className="wl-ico" style={{ width: Math.round(size * 0.55), height: Math.round(size * 0.55) }} dangerouslySetInnerHTML={{ __html: t.icon }} />
    </span>
  )
}

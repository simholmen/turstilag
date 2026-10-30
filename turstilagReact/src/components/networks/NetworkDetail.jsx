import pencil from 'lucide-static/icons/pencil.svg?raw'
import { LINE_COLORS, LINE_KINDS, junctionCount, networkNodes } from '../../models/networks'
import { LineSwatch } from './StylePicker'

const PENCIL = pencil.slice(pencil.indexOf('<svg'))
const Icon = ({ html }) => <span className="wl-ico" dangerouslySetInnerHTML={{ __html: html }} />

// One stinettverk. It has no start, end or length, so the facts are where it is and how it branches.
// The edit actions are admin-only.
export default function NetworkDetail({ network, areas, onBack, onEdit, onAddPath, onMarkStretch, onRemovePart }) {
  const area = areas.find((a) => a.id === network.hubId)
  const nodes = networkNodes(network.parts)
  // The kinds of line the network is made of, e.g. "Rød merket tursti" and "Blå turvei"
  const styles = [...new Map(network.segments.map((s) => [`${s.color}:${s.kind}`, s])).values()]

  const facts = [
    area && { key: 'Turområde', value: area.name },
    { key: 'Kryss', value: junctionCount(network.parts) },
    { key: 'Blindender', value: nodes.filter((n) => n.degree === 1).length },
  ].filter(Boolean)

  return (
    <>
      <div className="wl-pad wl-back-row">
        <button type="button" className="wl-link-btn" onClick={onBack}>← Alle stinettverk</button>
      </div>
      <div className="wl-heading wl-heading-tight">
        <h1 className="wl-h1">{network.name}</h1>
        {onEdit && <button type="button" className="wl-btn small" onClick={onEdit}><Icon html={PENCIL} />Rediger stinettverk</button>}
      </div>

      <div className="wl-facts">
        {facts.map((f) => (
          <div key={f.key}>
            <span className="wl-label">{f.key}</span>
            <strong>{f.value}</strong>
          </div>
        ))}
      </div>

      {network.desc && <p className="wl-pad wl-network-desc">{network.desc}</p>}

      {styles.length > 0 && (
        <div className="wl-pad wl-network-styles">
          {styles.map((s) => (
            <div key={`${s.color}:${s.kind}`} className="wl-legend-row">
              <LineSwatch color={s.color} kind={s.kind} />
              {LINE_COLORS[s.color].label} {LINE_KINDS[s.kind].label.toLowerCase()}
            </div>
          ))}
        </div>
      )}

      {onAddPath && (
        <div className="wl-pad wl-network-actions">
          <button type="button" className="wl-dashed-btn" onClick={onAddPath}>+ Legg til sti</button>
          {network.parts.length > 0 && (
            <>
              <button type="button" className="wl-link-btn" onClick={onMarkStretch}>Merk en strekning (farge og linjetype)</button>
              <button type="button" className="wl-link-btn" onClick={onRemovePart}>Fjern en bit av nettverket</button>
            </>
          )}
        </div>
      )}
    </>
  )
}

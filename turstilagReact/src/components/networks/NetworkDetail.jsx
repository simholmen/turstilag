import pencil from 'lucide-static/icons/pencil.svg?raw'
import { junctionCount, networkNodes } from '../../models/networks'

const PENCIL = pencil.slice(pencil.indexOf('<svg'))
const Icon = ({ html }) => <span className="wl-ico" dangerouslySetInnerHTML={{ __html: html }} />

// One stinettverk. It has no start, end or length, so the facts are where it is and how it branches.
// The edit actions are admin-only.
export default function NetworkDetail({ network, areas, onBack, onEdit, onAddPath, onRemovePart }) {
  const area = areas.find((a) => a.id === network.hubId)
  const nodes = networkNodes(network.parts)

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
        {onEdit && <button type="button" className="wl-btn small" onClick={onEdit}><Icon html={PENCIL} />Rediger</button>}
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

      {onAddPath && (
        <div className="wl-pad wl-network-actions">
          <button type="button" className="wl-dashed-btn" onClick={onAddPath}>+ Legg til sti</button>
          {network.parts.length > 0 && (
            <button type="button" className="wl-link-btn" onClick={onRemovePart}>Fjern en bit av nettverket</button>
          )}
        </div>
      )}
    </>
  )
}

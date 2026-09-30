import { useState } from 'react'
import { imageUrl } from '../../lib/images'
import { entrySubtypeLabel, fmtDist, groupEntriesByType, sortEntriesByDistance } from '../../models/worklog'
import KindSquare from './KindSquare'
import OwnerSymbol from '../worklog/OwnerSymbol'
import { OwnerRow } from '../worklog/OwnerList'

const SORTS = [['type', 'Etter type'], ['near', 'Nærmest meg']]

// Collapse key for the grunneiere group; can't clash with a kind key
const OWNERS_GROUP = 'grunneiere'

// Collapsible section heading: icon, title, count and a chevron
function Group({ icon, title, count, open, onToggle, children }) {
  return (
    <section>
      <h2 className="wl-subheading wl-group-heading">
        <button type="button" className="wl-group-toggle" aria-expanded={open} onClick={onToggle}>
          <span className="wl-h2 wl-group-title">{icon}{title}</span>
          <span className="wl-mono">{count}</span>
          <span className={`wl-group-chevron ${open ? 'open' : ''}`} aria-hidden="true">▾</span>
        </button>
      </h2>
      {open && children}
    </section>
  )
}

export function PointRow({ entry, areaName, dist, onSelect }) {
  const sub = [entrySubtypeLabel(entry), areaName].filter(Boolean).join(' · ')
  return (
    <button type="button" className="wl-info-row" onClick={() => onSelect(entry.key)}>
      <div className="wl-entry-thumb wl-hatch">
        {entry.images[0] && <img src={imageUrl(entry.images[0])} alt="" loading="lazy" />}
        <KindSquare type={entry.type} size={22} className="wl-entry-badge" />
      </div>
      <div className="wl-entry-main">
        <span className="wl-entry-title">{entry.title}</span>
        {sub && <span className="wl-mono">{sub}</span>}
      </div>
      {dist != null && <span className="wl-mono wl-info-dist">{fmtDist(dist)}</span>}
    </button>
  )
}

// "Hva finnes": every point, grouped by kind (each group collapsible) or sorted by distance, then the
// grunneiere as their own collapsible group. `entries` and `owners` are already filtered by area and
// by what is toggled on in the map.
export default function InfoList({
  entries, owners = [], areas, sort, onSort, userLocation, geoError, onRequestLocation, onSelect, onSelectOwner,
}) {
  const [collapsed, setCollapsed] = useState(() => new Set())
  const toggleGroup = (key) => setCollapsed((prev) => {
    const next = new Set(prev)
    if (!next.delete(key)) next.add(key)
    return next
  })
  const areaName = (id) => areas.find((a) => a.id === id)?.name
  const near = sort === 'near' && userLocation
  const distanceOf = (e) => (userLocation ? sortEntriesByDistance([e], userLocation)[0]?.dist : null)

  const chooseSort = (key) => {
    if (key === 'near' && !userLocation) onRequestLocation()
    onSort(key)
  }

  return (
    <>
      <div className="wl-heading">
        <h1 className="wl-h1">Hva finnes på turen</h1>
        <span className="wl-mono">{entries.length} punkter</span>
      </div>

      <div className="wl-row wl-pad wl-wrap">
        {SORTS.map(([key, label]) => {
          const blocked = key === 'near' && Boolean(geoError)
          return (
            <button
              key={key}
              type="button"
              className={`wl-chip square ${(key === 'near' ? near : !near) ? 'on' : ''}`}
              disabled={blocked}
              title={blocked ? 'Posisjonen din er ikke tilgjengelig – gi nettleseren tilgang for å sortere etter avstand.' : undefined}
              onClick={() => chooseSort(key)}
            >
              {label}
            </button>
          )
        })}
      </div>

      {entries.length === 0 && owners.length === 0 ? (
        <p className="wl-empty">Ingenting med valgte filtre. Slå på en type i kartet.</p>
      ) : (
        <>
          {near ? (
            entries.length > 0 && (
              <div className="wl-list wl-info-list">
                {sortEntriesByDistance(entries, userLocation).map((e) => (
                  <PointRow key={e.key} entry={e} areaName={areaName(e.area)} dist={e.dist} onSelect={onSelect} />
                ))}
              </div>
            )
          ) : (
            groupEntriesByType(entries).map((group) => (
              <Group
                key={group.key}
                icon={<KindSquare type={group.key} size={22} />}
                title={group.plural}
                count={group.entries.length}
                open={!collapsed.has(group.key)}
                onToggle={() => toggleGroup(group.key)}
              >
                <div className="wl-list wl-info-list">
                  {group.entries.map((e) => (
                    <PointRow key={e.key} entry={e} areaName={areaName(e.area)} dist={distanceOf(e)} onSelect={onSelect} />
                  ))}
                </div>
              </Group>
            ))
          )}
          {owners.length > 0 && (
            <Group
              icon={<OwnerSymbol size={22} />}
              title="Grunneiere"
              count={owners.length}
              open={!collapsed.has(OWNERS_GROUP)}
              onToggle={() => toggleGroup(OWNERS_GROUP)}
            >
              <div className="wl-list">
                {[...owners].sort((a, b) => a.name.localeCompare(b.name, 'nb')).map((o) => (
                  <OwnerRow key={o.id} owner={o} areas={areas} onSelect={onSelectOwner} />
                ))}
              </div>
            </Group>
          )}
        </>
      )}
    </>
  )
}

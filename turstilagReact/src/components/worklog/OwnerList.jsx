import { useState } from 'react'
import { daaText, plural } from '../../models/owners'
import OwnerSymbol from './OwnerSymbol'

const SORTS = [['az', 'A–Å'], ['daa', 'Størst areal']]

// One grunneier: symbol in their colour, name, teiger · dyr · turområder, and total daa
export function OwnerRow({ owner, areas, onSelect }) {
  const sub = [
    plural(owner.parcels.length, 'teig', 'teiger'),
    owner.dyr && `Dyr: ${owner.dyr}`,
    owner.hubIds.map((id) => areas.find((a) => a.id === id)?.name).filter(Boolean).join(', '),
  ].filter(Boolean).join(' · ')
  return (
    <button type="button" className="wl-area-row wl-owner-row" onClick={() => onSelect(owner.id)}>
      <OwnerSymbol color={owner.color} size={40} />
      <span className="wl-area-row-main">
        <span className="wl-area-name">{owner.name}</span>
        <span className="wl-mono">{sub}</span>
      </span>
      <span className="wl-area-count">
        <span className="wl-big-number">{daaText(owner.daa)}</span>
        <span className="wl-mono small">daa</span>
      </span>
    </button>
  )
}

// Every grunneier, for the Grunneiere mode. `owners` are view models from buildOwnerViews.
// `onNewOwner` is only passed in admin.
export default function OwnerList({ owners, areas, onSelect, onNewOwner }) {
  const [sort, setSort] = useState('az')
  const [areaFilter, setAreaFilter] = useState('')
  const areaOptions = areas.filter((a) => owners.some((o) => o.hubIds.includes(a.id))).sort((a, b) => a.name.localeCompare(b.name, 'nb'))
  const shown = (areaFilter ? owners.filter((o) => o.hubIds.includes(areaFilter)) : owners)
    .slice()
    .sort((a, b) => (sort === 'daa' ? b.daa - a.daa : a.name.localeCompare(b.name, 'nb')))
  const totalDaa = shown.reduce((sum, o) => sum + o.daa, 0)

  return (
    <>
      <div className="wl-heading">
        <h1 className="wl-h1">Grunneiere</h1>
        <span className="wl-mono">{plural(shown.length, 'grunneier', 'grunneiere')} · {daaText(totalDaa)} daa</span>
      </div>

      <div className="wl-row wl-wrap wl-pad">
        {SORTS.map(([key, label]) => (
          <button key={key} type="button" className={`wl-chip square ${sort === key ? 'on' : ''}`} onClick={() => setSort(key)}>
            {label}
          </button>
        ))}
        {areaOptions.length > 1 && (
          <select className="wl-input wl-owner-area-select" value={areaFilter} onChange={(event) => setAreaFilter(event.target.value)}>
            <option value="">Alle turområder</option>
            {areaOptions.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>

      {onNewOwner && (
        <div className="wl-pad"><button type="button" className="wl-dashed-btn" onClick={onNewOwner}>+ Ny grunneier</button></div>
      )}

      <div className="wl-list">
        {shown.map((o) => <OwnerRow key={o.id} owner={o} areas={areas} onSelect={onSelect} />)}
        {shown.length === 0 && <p className="wl-empty">Ingen grunneiere registrert ennå.</p>}
      </div>
    </>
  )
}

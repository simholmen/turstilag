import './App.css'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWorklog } from './hooks/useWorklog'
import { useOwners } from './hooks/useOwners'
import { useIsMobile } from './hooks/useIsMobile'
import { useSidebarWidth } from './hooks/useSidebarWidth'
import { buildAreaViews } from './models/worklog'
import { buildOwnerViews, ownersForArea } from './models/owners'
import SiteHeader from './components/worklog/SiteHeader'
import WorklogMap from './components/worklog/WorklogMap'
import MapLegend from './components/worklog/MapLegend'
import MapLayerChips from './components/worklog/MapLayerChips'
import AreaList from './components/worklog/AreaList'
import AreaDetail from './components/worklog/AreaDetail'
import OwnerDetail from './components/worklog/OwnerDetail'

function App() {
  const { areas, entries, loading, error, version } = useWorklog()
  const { owners, parcels, loading: ownersLoading } = useOwners()
  const isMobile = useIsMobile()
  const { width: sidebarWidth, dragging: resizing, startResize } = useSidebarWidth()
  const [areaId, setAreaId] = useState(null)
  const [ownerId, setOwnerId] = useState(null)
  const [entryId, setEntryId] = useState(null)
  const [filter, setFilter] = useState(null)
  const [sort, setSort] = useState('recent')
  const [layers, setLayers] = useState({ work: true, owners: true, routes: false })
  const [noDataDismissed, setNoDataDismissed] = useState(false)
  const scrollRef = useRef(null)

  const areaViews = useMemo(() => buildAreaViews(areas, entries), [areas, entries])
  const ownerViews = useMemo(() => buildOwnerViews(owners, parcels, entries), [owners, parcels, entries])
  const area = areaViews.find((a) => a.id === areaId)
  const owner = ownerViews.find((o) => o.id === ownerId)
  const areaOwners = useMemo(() => (area ? ownersForArea(owners, parcels, area.id) : []), [area, owners, parcels])
  const usedTypes = useMemo(() => new Set(entries.map((e) => e.type)), [entries])
  const legendOwners = ownerId ? ownerViews.filter((o) => o.id === ownerId) : ownerViews
  const showNoDataPopup = !loading && (error || areas.length === 0) && !noDataDismissed

  const selectArea = useCallback((id) => {
    setAreaId(id)
    setOwnerId(null)
    setEntryId(null)
    setFilter(null)
  }, [])

  const selectOwner = useCallback((id) => {
    setOwnerId(id)
    setAreaId(null)
    setEntryId(null)
  }, [])

  const toggleEntry = useCallback((key) => setEntryId((prev) => (prev === key ? null : key)), [])
  const toggleLayer = useCallback((key) => setLayers((prev) => ({ ...prev, [key]: !prev[key] })), [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [areaId, ownerId])

  return (
    <div className="wl-app">
      <SiteHeader><span className="wl-mono">Arbeidslogg</span></SiteHeader>

      <div className="wl-body">
        <aside className="wl-aside" style={{ '--aside-w': `${sidebarWidth}px` }}>
          {!isMobile && (
            <div className={`wl-resize-handle ${resizing ? 'active' : ''}`} onMouseDown={startResize} onTouchStart={startResize} />
          )}
          <div className="wl-scroll" ref={scrollRef}>
            {area ? (
              <AreaDetail
                area={area}
                areaOwners={areaOwners}
                layers={layers}
                entryId={entryId}
                filter={filter}
                onBack={() => selectArea(null)}
                onFilter={(key) => { setFilter(key); setEntryId(null) }}
                onToggleEntry={toggleEntry}
                onSelectOwner={selectOwner}
              />
            ) : owner ? (
              <OwnerDetail
                owner={owner}
                areas={areaViews}
                entryId={entryId}
                onBack={() => selectOwner(null)}
                onToggleEntry={toggleEntry}
                onSelectArea={selectArea}
              />
            ) : (
              <AreaList
                areas={areaViews}
                entryCount={entries.length}
                sort={sort}
                onSort={setSort}
                onSelect={selectArea}
              />
            )}
            {(loading || ownersLoading) && <p className="wl-empty">Laster inn…</p>}
          </div>
        </aside>

        <WorklogMap
          areas={areas}
          entries={entries}
          parcels={parcels}
          owners={ownerViews}
          layers={layers}
          areaId={areaId}
          entryId={entryId}
          ownerId={ownerId}
          filter={filter}
          version={version}
          isMobile={isMobile}
          onAreaClick={selectArea}
          onEntryClick={toggleEntry}
          onOwnerClick={selectOwner}
        >
          <div className="wl-map-overlay-left"><MapLegend isMobile={isMobile} usedTypes={usedTypes} layers={layers} owners={legendOwners} /></div>
          <MapLayerChips layers={layers} onToggle={toggleLayer} />
        </WorklogMap>
      </div>

      {showNoDataPopup && (
        <div className="no-data-overlay" role="alertdialog" aria-labelledby="no-data-title">
          <div className="no-data-popup">
            <h2 id="no-data-title">Ingen data lastet inn</h2>
            <p>
              Ta kontakt med Simen på{' '}
              <a href="mailto:simen.emil.wiig@gmail.com">simen.emil.wiig@gmail.com</a>
            </p>
            <button type="button" className="wl-btn primary" onClick={() => setNoDataDismissed(true)}>Lukk</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default App

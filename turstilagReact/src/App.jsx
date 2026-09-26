import './App.css'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWorklog } from './hooks/useWorklog'
import { useIsMobile } from './hooks/useIsMobile'
import { buildAreaViews } from './models/worklog'
import SiteHeader from './components/worklog/SiteHeader'
import WorklogMap from './components/worklog/WorklogMap'
import MapLegend from './components/worklog/MapLegend'
import AreaList from './components/worklog/AreaList'
import AreaDetail from './components/worklog/AreaDetail'

function App() {
  const { areas, entries, loading, error, version } = useWorklog()
  const isMobile = useIsMobile()
  const [areaId, setAreaId] = useState(null)
  const [entryId, setEntryId] = useState(null)
  const [filter, setFilter] = useState(null)
  const [sort, setSort] = useState('recent')
  const [noDataDismissed, setNoDataDismissed] = useState(false)
  const scrollRef = useRef(null)

  const areaViews = useMemo(() => buildAreaViews(areas, entries), [areas, entries])
  const area = areaViews.find((a) => a.id === areaId)
  const usedTypes = useMemo(() => new Set(entries.map((e) => e.type)), [entries])
  const showNoDataPopup = !loading && (error || areas.length === 0) && !noDataDismissed

  const selectArea = useCallback((id) => {
    setAreaId(id)
    setEntryId(null)
    setFilter(null)
  }, [])

  const toggleEntry = useCallback((key) => setEntryId((prev) => (prev === key ? null : key)), [])

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [areaId])

  return (
    <div className="wl-app">
      <SiteHeader><span className="wl-mono">Arbeidslogg</span></SiteHeader>

      <div className="wl-body">
        <aside className="wl-aside">
          <div className="wl-scroll" ref={scrollRef}>
            {area ? (
              <AreaDetail
                area={area}
                entryId={entryId}
                filter={filter}
                onBack={() => selectArea(null)}
                onFilter={(key) => { setFilter(key); setEntryId(null) }}
                onToggleEntry={toggleEntry}
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
            {loading && <p className="wl-empty">Laster inn…</p>}
          </div>
        </aside>

        <WorklogMap
          areas={areas}
          entries={entries}
          areaId={areaId}
          entryId={entryId}
          filter={filter}
          version={version}
          isMobile={isMobile}
          onAreaClick={selectArea}
          onEntryClick={toggleEntry}
        >
          <div className="wl-map-overlay-left"><MapLegend isMobile={isMobile} usedTypes={usedTypes} /></div>
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

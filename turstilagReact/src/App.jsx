import './App.css'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import milestoneIcon from 'lucide-static/icons/milestone.svg?raw'
import routeIcon from 'lucide-static/icons/route.svg?raw'
import landPlotIcon from 'lucide-static/icons/land-plot.svg?raw'
import { useWorklog } from './hooks/useWorklog'
import { useOwners } from './hooks/useOwners'
import { useRoutes } from './hooks/useRoutes'
import { useIsMobile } from './hooks/useIsMobile'
import { useSheetDrag } from './hooks/useSheetDrag'
import { useSidebarWidth } from './hooks/useSidebarWidth'
import { useGeolocation } from './hooks/useGeolocation'
import { buildAreaViews } from './models/worklog'
import { DEFAULT_LAYERS, LAYER_KEYS, toggleKindIn } from './models/layers'
import { buildOwnerViews, ownersForArea } from './models/owners'
import SiteHeader from './components/worklog/SiteHeader'
import WorklogMap from './components/worklog/WorklogMap'
import MapLegend from './components/worklog/MapLegend'
import MapLayerChips from './components/worklog/MapLayerChips'
import MapAreaFilter from './components/worklog/MapAreaFilter'
import MapFilterMenu from './components/worklog/MapFilterMenu'
import AreaList from './components/worklog/AreaList'
import AreaDetail from './components/worklog/AreaDetail'
import OwnerDetail from './components/worklog/OwnerDetail'
import OwnerList from './components/worklog/OwnerList'
import InfoList from './components/info/InfoList'
import PointDetail from './components/info/PointDetail'
import RouteList from './components/routes/RouteList'
import RouteDetail from './components/routes/RouteDetail'

const MODES = [
  { id: 'finnes', label: 'Hva finnes', icon: milestoneIcon },
  { id: 'ruter', label: 'Turruter', icon: routeIcon },
  { id: 'grunneiere', label: 'Grunneiere', icon: landPlotIcon },
]
// Arbeidslogg is still reachable (?modus=arbeidslogg), just not one of the primary tabs
const MODE_IDS = ['finnes', 'ruter', 'grunneiere', 'arbeidslogg']

// Mode and the selected point/route live in the URL so they survive reloads and Back works
const readUrl = () => {
  const q = new URLSearchParams(window.location.search)
  const mode = MODE_IDS.includes(q.get('modus')) ? q.get('modus') : 'finnes'
  return {
    mode,
    point: mode === 'finnes' ? q.get('punkt') : null,
    route: mode === 'ruter' ? q.get('rute') : null,
  }
}

const buildSearch = ({ mode, point, route }) => {
  const q = new URLSearchParams({ modus: mode })
  if (point) q.set('punkt', point)
  if (route) q.set('rute', route)
  return `?${q.toString()}`
}


function App() {
  const { areas, entries, loading, error, version } = useWorklog()
  const { owners, parcels, loading: ownersLoading } = useOwners()
  const { routes } = useRoutes()
  const isMobile = useIsMobile()
  const geo = useGeolocation()
  const { width: sidebarWidth, dragging: resizing, startResize } = useSidebarWidth()
  const [nav, setNav] = useState(readUrl)
  const [areaId, setAreaId] = useState(null)
  const [ownerId, setOwnerId] = useState(null)
  const [entryId, setEntryId] = useState(null)
  const [filter, setFilter] = useState(null)
  const [sort, setSort] = useState('recent')
  const [layersByMode, setLayersByMode] = useState(DEFAULT_LAYERS)
  const [infoSort, setInfoSort] = useState(null)
  const [infoAreas, setInfoAreas] = useState([])
  const [difficulty, setDifficulty] = useState(null)
  const [noDataDismissed, setNoDataDismissed] = useState(false)
  // Mobile only: fold the bottom panel away so the map fills the screen. Remembers the selection
  // it was folded on, so picking something else on the map opens the panel again.
  const [collapsedAt, setCollapsedAt] = useState(null)
  const scrollRef = useRef(null)
  const bodyRef = useRef(null)

  const { mode } = nav
  const layers = layersByMode[mode]
  const worklogMode = mode === 'arbeidslogg'

  const areaViews = useMemo(() => buildAreaViews(areas, entries), [areas, entries])
  const ownerViews = useMemo(() => buildOwnerViews(owners, parcels, entries), [owners, parcels, entries])
  const area = areaViews.find((a) => a.id === areaId)
  const owner = ownerViews.find((o) => o.id === ownerId)
  const areaOwners = useMemo(() => (area ? ownersForArea(owners, parcels, area.id) : []), [area, owners, parcels])
  const usedTypes = useMemo(() => new Set(entries.map((e) => e.type)), [entries])
  const showNoDataPopup = !loading && (error || areas.length === 0) && !noDataDismissed

  // Hva finnes filters: area first (drives the chip counts), then kind and subtype. The kinds are
  // the map's kind toggles, so the sidebar chips and the map chips are one filter.
  const activeKinds = layers.kinds
  const infoEntries = useMemo(() => entries.filter((e) => activeKinds.includes(e.type)
    && (!infoAreas.length || infoAreas.includes(e.area))), [entries, activeKinds, infoAreas])
  // Grunneiere in the list follow the map's Grunneiere toggle and the area filter
  const infoOwners = useMemo(() => (layers.owners
    ? ownerViews.filter((o) => !infoAreas.length || o.hubIds.some((id) => infoAreas.includes(id)))
    : []), [layers.owners, ownerViews, infoAreas])
  // On mobile "Nærmest meg" is the default once a position is known
  const effectiveInfoSort = infoSort ?? (isMobile && geo.userLocation ? 'near' : 'type')

  const point = mode === 'finnes' ? entries.find((e) => e.key === nav.point) : null
  const route = mode === 'ruter' ? routes.find((r) => r.id === nav.route) : null
  const shownRoutes = difficulty ? routes.filter((r) => r.difficulty === difficulty) : routes

  const navigate = useCallback((patch) => {
    setNav((prev) => {
      const next = { ...prev, point: null, route: null, ...patch }
      const search = buildSearch(next)
      if (search !== window.location.search) window.history.pushState(null, '', search)
      return next
    })
  }, [])

  useEffect(() => {
    const onPop = () => setNav(readUrl())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Nothing stays selected in a mode that can't show it (reset during render, not in an effect)
  const [shownMode, setShownMode] = useState(mode)
  if (shownMode !== mode) {
    setShownMode(mode)
    setAreaId(null)
    setOwnerId(null)
    setEntryId(null)
    setFilter(null)
  }

  const changeMode = useCallback((next) => navigate({ mode: next }), [navigate])

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

  const selectPoint = useCallback((key) => {
    setOwnerId(null)
    navigate({ mode: 'finnes', point: key })
  }, [navigate])

  const selectRoute = useCallback((id) => {
    setOwnerId(null)
    navigate({ mode: 'ruter', route: id })
  }, [navigate])

  const toggleEntry = useCallback((key) => setEntryId((prev) => (prev === key ? null : key)), [])
  const toggleLayer = useCallback((key) => setLayersByMode((prev) => ({ ...prev, [mode]: { ...prev[mode], [key]: !prev[mode][key] } })), [mode])

  const toggleKind = useCallback((kind) => {
    setLayersByMode((prev) => ({ ...prev, [mode]: { ...prev[mode], kinds: toggleKindIn(prev[mode].kinds, kind) } }))
  }, [mode])

  const onMapEntryClick = worklogMode ? toggleEntry : selectPoint

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [areaId, ownerId, mode, nav.point, nav.route])

  const selectionKey = [mode, areaId, ownerId, entryId, nav.point, nav.route].join('|')
  const panelCollapsed = collapsedAt === selectionKey
  const { mapH: sheetMapH, handleProps: sheetHandleProps } = useSheetDrag({
    bodyRef,
    collapsed: panelCollapsed,
    setCollapsed: (fold) => setCollapsedAt(fold ? selectionKey : null),
  })

  const renderAside = () => {
    if (owner) {
      return (
        <OwnerDetail
          owner={owner}
          areas={areaViews}
          routes={routes}
          entryId={entryId}
          backLabel={worklogMode ? '← Alle områder' : mode === 'grunneiere' ? '← Alle grunneiere' : '← Tilbake'}
          onBack={() => selectOwner(null)}
          onToggleEntry={toggleEntry}
          onSelectPoint={worklogMode ? undefined : selectPoint}
          userLocation={geo.userLocation}
          onSelectArea={worklogMode ? selectArea : (id) => { setOwnerId(null); setInfoAreas([id]); navigate({ mode: 'finnes' }) }}
          onSelectRoute={selectRoute}
        />
      )
    }

    if (mode === 'finnes') {
      if (point) {
        return (
          <PointDetail
            entry={point}
            areas={areas}
            owners={ownerViews}
            parcels={parcels}
            routes={routes}
            onBack={() => navigate({ mode: 'finnes' })}
            onSelectArea={(id) => { setInfoAreas([id]); navigate({ mode: 'finnes' }) }}
            onSelectOwner={selectOwner}
            onSelectRoute={selectRoute}
          />
        )
      }
      return (
        <InfoList
          entries={infoEntries}
          owners={infoOwners}
          areas={areas}
          sort={effectiveInfoSort}
          onSort={setInfoSort}
          userLocation={geo.userLocation}
          geoError={geo.geoError}
          onRequestLocation={geo.requestLocation}
          onSelect={selectPoint}
          onSelectOwner={selectOwner}
        />
      )
    }

    if (mode === 'ruter') {
      if (route) {
        return (
          <RouteDetail
            route={route}
            owners={ownerViews}
            onBack={() => navigate({ mode: 'ruter' })}
            onSelectPoint={selectPoint}
            onSelectOwner={selectOwner}
          />
        )
      }
      return <RouteList routes={routes} difficulty={difficulty} onDifficulty={setDifficulty} onSelect={selectRoute} />
    }

    if (mode === 'grunneiere') return <OwnerList owners={ownerViews} areas={areas} onSelect={selectOwner} />

    if (area) {
      return (
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
      )
    }
    return (
      <AreaList
        areas={areaViews}
        entryCount={entries.length}
        sort={sort}
        onSort={setSort}
        onSelect={selectArea}
      />
    )
  }

  return (
    <div className={`wl-app wl-mode-${mode}`}>
      <SiteHeader modes={MODES} mode={worklogMode ? null : mode} onMode={changeMode}>
        {worklogMode
          ? <span className="wl-mono">Arbeidslogg</span>
          : !isMobile && <a href="?modus=arbeidslogg" className="wl-header-link" onClick={(event) => { event.preventDefault(); changeMode('arbeidslogg') }}>Arbeidslogg</a>}
      </SiteHeader>

      <div
        ref={bodyRef}
        className={`wl-body ${isMobile && panelCollapsed ? 'panel-collapsed' : ''} ${isMobile && sheetMapH !== null ? 'sheet-sized' : ''}`}
        style={sheetMapH !== null ? { '--map-h': `${sheetMapH}px` } : undefined}
      >
        <aside className="wl-aside" style={{ '--aside-w': `${sidebarWidth}px` }}>
          {!isMobile && (
            <div className={`wl-resize-handle ${resizing ? 'active' : ''}`} onMouseDown={startResize} onTouchStart={startResize} />
          )}
          {isMobile && (
            <div
              role="button"
              tabIndex={0}
              className="wl-sheet-handle"
              aria-expanded={!panelCollapsed}
              aria-label={panelCollapsed ? 'Vis panel' : 'Skjul panel'}
              {...sheetHandleProps}
            >
              <span className="wl-sheet-grip" />
            </div>
          )}
          <div className="wl-scroll" ref={scrollRef}>
            {renderAside()}
            {(loading || ownersLoading) && <p className="wl-empty">Laster inn…</p>}
          </div>
        </aside>

        <WorklogMap
          mode={mode}
          areas={areas}
          entries={mode === 'finnes' ? infoEntries : entries}
          parcels={parcels}
          owners={ownerViews}
          routes={mode === 'ruter' ? shownRoutes : routes}
          layers={layers}
          areaId={areaId}
          entryId={worklogMode ? entryId : nav.point}
          ownerId={ownerId}
          routeId={nav.route}
          filter={filter}
          version={version}
          isMobile={isMobile}
          geo={geo}
          onAreaClick={selectArea}
          onEntryClick={onMapEntryClick}
          onOwnerClick={selectOwner}
          onRouteClick={selectRoute}
        >
          {isMobile ? (
            <MapFilterMenu
              areas={areas}
              areaValue={infoAreas}
              onAreaChange={setInfoAreas}
              showAreas={mode === 'finnes'}
              layers={layers}
              usedTypes={usedTypes}
              onToggle={toggleLayer}
              onToggleKind={toggleKind}
              keys={LAYER_KEYS[mode]}
              hasOwners={owners.length > 0}
              mode={mode}
            />
          ) : (
            <>
              <div className="wl-map-overlay-left">
                <MapLegend isMobile={isMobile} usedTypes={usedTypes} layers={layers} hasOwners={owners.length > 0} mode={mode} />
              </div>
              <MapLayerChips layers={layers} usedTypes={usedTypes} onToggle={toggleLayer} onToggleKind={toggleKind} keys={LAYER_KEYS[mode]} />
              {mode === 'finnes' && <MapAreaFilter areas={areas} value={infoAreas} onChange={setInfoAreas} />}
            </>
          )}
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

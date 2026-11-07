import './App.css'
import 'leaflet/dist/leaflet.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import milestoneIcon from 'lucide-static/icons/milestone.svg?raw'
import routeIcon from 'lucide-static/icons/route.svg?raw'
import landPlotIcon from 'lucide-static/icons/land-plot.svg?raw'
import waypointsIcon from 'lucide-static/icons/waypoints.svg?raw'
import { useWorklog } from './hooks/useWorklog'
import { useOwners } from './hooks/useOwners'
import { useRoutes } from './hooks/useRoutes'
import { useNetworks } from './hooks/useNetworks'
import { useIsMobile } from './hooks/useIsMobile'
import { useSidebarWidth } from './hooks/useSidebarWidth'
import { useGeolocation } from './hooks/useGeolocation'
import {
  GEOM_MIN, buildAreaViews, deleteArea, deleteEntry, entryGeomType, missingFields, needsRedraw, saveArea, saveEntry,
} from './models/worklog'
import { deleteRoute, missingRouteFields, saveRoute } from './models/routes'
import {
  DEFAULT_STYLE, START_SNAP_M, addPath, deleteNetwork, insertNetworkVertex, missingNetworkFields, moveNetworkVertex, nearestOnNetwork,
  networkPath, networkStyle, readSnapM, removePart, saveNetwork, setNetworkGeometry, setNetworkStyle, setNetworkStyleAll,
  startStyle, storeSnapM,
} from './models/networks'
import { DEFAULT_LAYERS, LAYER_KEYS, toggleKindIn } from './models/layers'
import {
  OWNER_COLORS, buildOwnerViews, emptyContact, deleteOwner, deleteParcel, missingOwnerFields, missingParcelFields, ownersForArea, saveOwner, saveParcel,
} from './models/owners'
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
import { EditFooter, EditForm } from './components/worklog/EditPanel'
import { OwnerEditFooter, OwnerEditForm } from './components/worklog/EditOwnerPanel'
import { RouteEditFooter, RouteEditForm } from './components/worklog/RouteEditPanel'
import NetworkList from './components/networks/NetworkList'
import NetworkDetail from './components/networks/NetworkDetail'
import { NetworkEditFooter, NetworkEditForm } from './components/networks/NetworkEditPanel'

// Same order as the public page; Stinettverk, the first, is what it opens on
const MODES = [
  { id: 'stinettverk', label: 'Stinettverk', icon: waypointsIcon },
  { id: 'ruter', label: 'Turruter', icon: routeIcon },
  { id: 'grunneiere', label: 'Eiendommer', icon: landPlotIcon },
  { id: 'finnes', label: 'Hva finnes', icon: milestoneIcon },
]
// Arbeidslogg is still reachable (?modus=arbeidslogg), just not one of the primary tabs
const MODE_IDS = ['stinettverk', 'finnes', 'ruter', 'grunneiere', 'arbeidslogg']

// Mode and the selected point/route/network live in the URL so they survive reloads and Back works
const readUrl = () => {
  const q = new URLSearchParams(window.location.search)
  const mode = MODE_IDS.includes(q.get('modus')) ? q.get('modus') : MODES[0].id
  return {
    mode,
    point: mode === 'finnes' ? q.get('punkt') : null,
    route: mode === 'ruter' ? q.get('rute') : null,
    network: mode === 'stinettverk' ? q.get('nettverk') : null,
  }
}

const buildSearch = ({ mode, point, route, network }) => {
  const q = new URLSearchParams({ modus: mode })
  if (point) q.set('punkt', point)
  if (route) q.set('rute', route)
  if (network) q.set('nettverk', network)
  return `?${q.toString()}`
}


const today = () => new Date().toISOString().slice(0, 10)

const errorMessage = (error) => {
  if (!error) return 'Ukjent feil'
  const code = error.code ? `[${error.code}] ` : ''
  return `${code}${error.message || 'Ukjent feil'}`
}

const nearestArea = (areas, [lat, lng]) => {
  let best = null
  let bestDistance = Infinity
  areas.forEach((a) => {
    const d = (a.ll[0] - lat) ** 2 + (a.ll[1] - lng) ** 2
    if (d < bestDistance) { bestDistance = d; best = a.id }
  })
  return best
}

const isOwnerEdit = (edit) => edit?.kind === 'owner' || edit?.kind === 'parcel'
const isRouteEdit = (edit) => edit?.kind === 'route'
// 'network' (name etc. — plus the first path when new, or its lines to drag when not), 'network-path',
// 'network-style' (a stretch between two clicks given a colour and line type) and 'network-remove'
const isNetworkEdit = (edit) => Boolean(edit?.kind?.startsWith('network'))

// A network edit draws a path when it adds one: always for 'network-path', and for a new network
const drawsPath = (edit) => edit?.kind === 'network-path' || (edit?.kind === 'network' && !edit.id)

// The edit's geometry is built from several clicked vertices rather than a single point
const accumulatesPoints = (edit) => edit?.kind === 'parcel' || edit?.kind === 'route' || drawsPath(edit)
  || (edit?.kind === 'entry' && Boolean(edit.draft.type) && entryGeomType(edit.draft) !== 'point')

// 'poly' for closed shapes, 'line' for open ones — drives vertex minimums and the map preview
const drawnGeomType = (edit) => (edit.kind === 'parcel' ? 'poly' : edit.kind === 'route' || drawsPath(edit) ? 'line' : entryGeomType(edit.draft))

const toDraftPoints = (entry) => (entry.geomType === 'poly' ? entry.latLngs.slice(0, -1) : entry.geomType === 'line' ? entry.latLngs : [])

export default function AdminApp({ userEmail, onSignOut }) {
  const { areas, entries, loading, version, refresh } = useWorklog()
  const { owners, parcels, loading: ownersLoading, refresh: refreshOwners } = useOwners()
  const { routes, refresh: refreshRoutes } = useRoutes()
  const { networks, refresh: refreshNetworks } = useNetworks()
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

  const [edit, setEdit] = useState(null)
  const [placing, setPlacing] = useState(false)
  const [tried, setTried] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saveError, setSaveError] = useState(null)
  const [toast, setToast] = useState(null)
  const [snapM, setSnapM] = useState(readSnapM)
  const scrollRef = useRef(null)
  const toastTimer = useRef(null)

  const { mode } = nav
  const layers = layersByMode[mode]
  const worklogMode = mode === 'arbeidslogg'

  const areaViews = useMemo(() => buildAreaViews(areas, entries), [areas, entries])
  const ownerViews = useMemo(() => buildOwnerViews(owners, parcels, entries), [owners, parcels, entries])
  const area = areaViews.find((a) => a.id === areaId)
  const owner = ownerViews.find((o) => o.id === ownerId)
  const areaOwners = useMemo(() => (area ? ownersForArea(owners, parcels, area.id) : []), [area, owners, parcels])
  const usedTypes = useMemo(() => new Set(entries.map((e) => e.type)), [entries])

  // Hva finnes filters: area first (drives the chip counts), then kind and subtype. The kinds are
  // the map's kind toggles, so the sidebar chips and the map chips are one filter.
  const activeKinds = layers.kinds
  const infoEntries = useMemo(() => entries.filter((e) => activeKinds.includes(e.type)
    && (!infoAreas.length || infoAreas.includes(e.area))), [entries, activeKinds, infoAreas])
  // Eiendommer in the list follow the map's Eiendommer toggle and the area filter
  const infoOwners = useMemo(() => (layers.owners
    ? ownerViews.filter((o) => !infoAreas.length || o.hubIds.some((id) => infoAreas.includes(id)))
    : []), [layers.owners, ownerViews, infoAreas])
  const effectiveInfoSort = infoSort ?? (isMobile && geo.userLocation ? 'near' : 'type')

  const point = mode === 'finnes' ? entries.find((e) => e.key === nav.point) : null
  const route = mode === 'ruter' ? routes.find((r) => r.id === nav.route) : null
  const network = mode === 'stinettverk' ? networks.find((n) => n.id === nav.network) : null
  const shownRoutes = difficulty ? routes.filter((r) => r.difficulty === difficulty) : routes

  const navigate = useCallback((patch) => {
    setNav((prev) => {
      const next = { ...prev, point: null, route: null, network: null, ...patch }
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

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [areaId, ownerId, mode, nav.point, nav.route, nav.network, edit?.kind, edit?.id])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const flash = useCallback((message) => {
    clearTimeout(toastTimer.current)
    setToast(message)
    toastTimer.current = setTimeout(() => setToast(null), 2400)
  }, [])

  const cancelEdit = () => {
    setEdit(null)
    setPlacing(false)
    setTried(false)
    setConfirmDelete(false)
  }

  // Nothing stays selected — and no edit stays open — in a mode that can't show it
  const [shownMode, setShownMode] = useState(mode)
  if (shownMode !== mode) {
    setShownMode(mode)
    setAreaId(null)
    setOwnerId(null)
    setEntryId(null)
    setFilter(null)
    cancelEdit()
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

  const selectNetwork = useCallback((id) => {
    setOwnerId(null)
    navigate({ mode: 'stinettverk', network: id })
  }, [navigate])

  const toggleEntry = useCallback((key) => setEntryId((prev) => (prev === key ? null : key)), [])
  const toggleLayer = useCallback((key) => setLayersByMode((prev) => ({ ...prev, [mode]: { ...prev[mode], [key]: !prev[mode][key] } })), [mode])

  const toggleKind = useCallback((kind) => {
    setLayersByMode((prev) => ({ ...prev, [mode]: { ...prev[mode], kinds: toggleKindIn(prev[mode].kinds, kind) } }))
  }, [mode])

  // `placing` defaults to "start placing immediately" for single-point kinds without a location yet,
  // and is explicit for parcels (multi-point) since an existing polygon shouldn't reopen drawing.
  const startEdit = (kind, id, draft, options = {}) => {
    const fly = options.initialLL ?? draft.ll ?? null
    setEdit({ kind, id, draft, initialLL: fly, startedAt: Date.now() })
    setPlacing(options.placing ?? ((kind === 'area' || kind === 'entry') && !draft.ll))
    setTried(false)
    setConfirmDelete(false)
    setSaveError(null)
  }

  const newEntry = () => startEdit('entry', null, {
    area: areaId || '', type: null, subtypes: [], subtypeOther: '', hund: '', plasser: '', title: '', date: today(), desc: '', images: [], ll: null,
    geomType: 'point', geomChosen: false, points: [],
  })

  const newArea = () => {
    selectArea(null)
    startEdit('area', null, { name: '', desc: '', images: [], ll: null })
  }

  const editArea = () => startEdit('area', area.id, { name: area.name, desc: area.desc, images: [...area.images], ll: area.ll })

  const editEntry = (entry) => {
    setEntryId(entry.key)
    startEdit('entry', entry.key, {
      area: entry.area, type: entry.type, subtypes: [...entry.subtypes], subtypeOther: entry.subtypeOther, hund: entry.hund, plasser: entry.plasser,
      title: entry.title, date: entry.date || '', desc: entry.desc, images: [...entry.images], ll: entry.ll,
      geomType: entry.geomType, geomChosen: true, points: toDraftPoints(entry),
      oldGeom: needsRedraw(entry) ? { type: entry.type, geomType: entry.geomType } : null,
    })
  }

  // Opens the entry being edited — unsaved changes included — as a new, unsaved entry. Its images are
  // marked shared and only copied in storage on save (see saveEntry). A point copy starts in placing
  // mode so the next map click puts it where it belongs; lines and areas keep their shape to be
  // dragged into place.
  const duplicateEntry = () => {
    const { draft } = edit
    setEntryId(null)
    startEdit('entry', null, {
      ...draft, title: `${draft.title} (kopi)`, images: [...draft.images], sharedImages: [...draft.images], points: [...(draft.points || [])],
    }, {
      initialLL: draft.ll,
      placing: draft.geomType === 'point',
    })
    flash(draft.geomType === 'point' ? 'Kopi laget – klikk i kartet for å plassere den' : 'Kopi laget – flytt den og lagre')
  }

  const newOwner = () => {
    selectOwner(null)
    startEdit('owner', null, {
      name: '', hubIds: areaId ? [areaId] : [], color: OWNER_COLORS[owners.length % OWNER_COLORS.length],
      contacts: [emptyContact()], note: '', dyr: '',
    })
  }

  const editOwner = () => startEdit('owner', owner.id, {
    name: owner.name, hubIds: [...owner.hubIds], color: owner.color,
    contacts: owner.contacts.length ? owner.contacts.map((c) => ({ ...c })) : [emptyContact()], note: owner.note, dyr: owner.dyr,
  })

  const newParcel = (forOwnerId) => {
    const forOwner = ownerViews.find((o) => o.id === forOwnerId)
    startEdit('parcel', null, {
      ownerId: forOwnerId, teig: (forOwner?.parcels.length || 0) + 1, points: [],
    }, { placing: true, initialLL: forOwner?.parcels[0]?.center || null })
  }

  const editParcel = (parcel) => startEdit('parcel', parcel.id, {
    ownerId: parcel.ownerId, teig: parcel.teig, points: (parcel.latLngRings[0]?.[0] || []).slice(0, -1),
  }, { placing: false })

  const newRoute = () => {
    startEdit('route', null, {
      title: '', difficulty: 'gronn', shape: 'rundtur', hub: '', climb: '', direction: '', desc: '', images: [], points: [],
    }, { placing: true, initialLL: area?.ll || null })
  }

  const editRoute = (r) => startEdit('route', r.id, {
    title: r.title, difficulty: r.difficulty, shape: r.shape, hub: r.hubId || '', climb: r.climb,
    direction: r.direction, desc: r.desc, images: [...r.images], points: r.latLngs,
  }, { placing: false })

  const newNetwork = () => {
    startEdit('network', null, { name: '', hub: '', desc: '', points: [], ...DEFAULT_STYLE }, { placing: true, initialLL: area?.ll || null })
  }

  // The colour/type pickers show the network's own where it has one throughout, else nothing chosen;
  // picking one sets it for the whole network on save
  const editNetwork = (n) => startEdit('network', n.id, {
    name: n.name, hub: n.hubId || '', desc: n.desc, ...networkStyle(n),
    segments: n.segments.map((s) => ({ ...s, line: s.line.map((ll) => [...ll]) })),
  }, { placing: false })

  const addNetworkPath = (n) => startEdit('network-path', n.id, { points: [], ...startStyle(n) }, { placing: true })

  const markNetworkStretch = (n) => startEdit('network-style', n.id, { from: null, to: null, ...startStyle(n) }, { placing: true })

  const restartStretch = () => {
    updateDraft({ from: null, to: null })
    setPlacing(true)
  }

  const removeNetworkPart = (n) => startEdit('network-remove', n.id, { part: null }, { placing: false })

  // "Legg til sti" starts on the network: the first vertex goes onto its nearest line, or nowhere if
  // the click is too far off. The rest stay where they are put, so a path can run close to the network
  // as it leaves it; the database ties an end that stops near the network onto it. Returns null for a
  // click that should be ignored.
  const snapVertex = useCallback((current, ll, index) => {
    if (current?.kind !== 'network-path' || index !== 0) return ll
    const target = networks.find((n) => n.id === current.id)
    const near = target && nearestOnNetwork(ll, target.parts)
    return near && near.distM <= START_SNAP_M ? near.ll : null
  }, [networks])

  const updateDraft = useCallback((patch) => {
    setEdit((prev) => prev && { ...prev, draft: { ...prev.draft, ...patch } })
  }, [])

  const handlePartClick = useCallback((part) => updateDraft({ part }), [updateDraft])

  // The editor drags the stretches' lines; the styles stay with them
  const handleNetworkVertexMove = useCallback((from, to) => {
    setEdit((prev) => {
      if (!prev) return prev
      const lines = moveNetworkVertex(prev.draft.segments.map((s) => s.line), from, to, snapM)
      return { ...prev, draft: { ...prev.draft, segments: prev.draft.segments.map((s, i) => ({ ...s, line: lines[i] })) } }
    })
  }, [snapM])

  const changeSnapM = (m) => {
    setSnapM(m)
    storeSnapM(m)
  }

  const handleNetworkVertexInsert = useCallback((segmentIndex, index, ll) => {
    setEdit((prev) => {
      if (!prev) return prev
      const lines = insertNetworkVertex(prev.draft.segments.map((s) => s.line), segmentIndex, index, ll)
      return { ...prev, draft: { ...prev.draft, segments: prev.draft.segments.map((s, i) => ({ ...s, line: lines[i] })) } }
    })
  }, [])

  const handlePlace = useCallback((ll) => {
    // Marking a stretch: two clicks on the network, its start and its end
    if (edit?.kind === 'network-style') {
      const target = networks.find((n) => n.id === edit.id)
      const near = target && nearestOnNetwork(ll, target.parts)
      if (!near || near.distM > START_SNAP_M) {
        flash('Trykk på en sti i nettverket')
        return
      }
      updateDraft(edit.draft.from ? { to: near.ll } : { from: near.ll })
      if (edit.draft.from) setPlacing(false)
      return
    }
    const vertex = accumulatesPoints(edit) ? snapVertex(edit, ll, edit.draft.points.length) : ll
    if (!vertex) {
      flash('Start med å trykke på en sti i nettverket')
      return
    }
    setEdit((prev) => {
      if (!prev) return prev
      if (accumulatesPoints(prev)) {
        const patch = { points: [...prev.draft.points, vertex] }
        // A line/area entry gets its turområde from its first vertex, like a point does from its position
        if (prev.kind === 'entry' && !prev.draft.area && prev.draft.points.length === 0) patch.area = nearestArea(areas, ll)
        return { ...prev, draft: { ...prev.draft, ...patch } }
      }
      const patch = { ll }
      if (prev.kind === 'entry' && !prev.draft.area) patch.area = nearestArea(areas, ll)
      return { ...prev, draft: { ...prev.draft, ...patch } }
    })
    if (!accumulatesPoints(edit)) setPlacing(false)
  }, [areas, edit, networks, snapVertex, flash, updateDraft])

  const handleDraftMove = useCallback((ll) => updateDraft({ ll }), [updateDraft])

  const handleDraftVertexMove = useCallback((index, ll) => {
    setEdit((prev) => {
      if (!prev) return prev
      const points = [...prev.draft.points]
      points[index] = snapVertex(prev, ll, index) ?? points[index]
      return { ...prev, draft: { ...prev.draft, points } }
    })
  }, [snapVertex])

  const handleInsertVertex = useCallback((index, ll) => {
    setEdit((prev) => {
      if (!prev) return prev
      const points = [...prev.draft.points]
      points.splice(index, 0, snapVertex(prev, ll, index) ?? ll)
      return { ...prev, draft: { ...prev.draft, points } }
    })
  }, [snapVertex])

  const undoPoint = () => setEdit((prev) => prev && ({ ...prev, draft: { ...prev.draft, points: prev.draft.points.slice(0, -1) } }))
  const restartDrawing = () => { setEdit((prev) => prev && ({ ...prev, draft: { ...prev.draft, points: [] } })); setPlacing(true) }
  const finishDrawing = () => setPlacing(false)
  // Clicking the first vertex of a polygon with enough corners closes it
  const handleCloseShape = useCallback(() => setPlacing(false), [])

  const handleSave = async () => {
    const missing = edit.kind === 'owner' ? missingOwnerFields(edit.draft)
      : edit.kind === 'parcel' ? missingParcelFields(edit.draft)
        : edit.kind === 'route' ? missingRouteFields(edit.draft)
          : isNetworkEdit(edit) ? missingNetworkFields(edit)
            : missingFields(edit)
    if (missing.length) {
      setTried(true)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      if (edit.kind === 'entry') {
        const original = edit.id ? entries.find((e) => e.key === edit.id) : null
        const key = await saveEntry(original, edit.draft)
        await Promise.all([refresh(), refreshRoutes()])
        if (worklogMode) {
          setAreaId(edit.draft.area)
          setEntryId(key)
          setFilter(null)
        } else {
          navigate({ mode: 'finnes', point: key })
        }
        flash(edit.id ? 'Endringer lagret' : 'Arbeid registrert')
      } else if (edit.kind === 'area') {
        const original = edit.id ? areas.find((a) => a.id === edit.id) : null
        const id = await saveArea(original, edit.draft)
        await refresh()
        selectArea(id)
        flash(edit.id ? 'Området er oppdatert' : 'Nytt område opprettet')
      } else if (edit.kind === 'owner') {
        const original = edit.id ? owners.find((o) => o.id === edit.id) : null
        const id = await saveOwner(original, edit.draft)
        await refreshOwners()
        if (!original) {
          // A brand new owner has no land yet — go straight into drawing their first parcel
          // instead of stopping on their (still empty) detail page.
          flash('Eiendom opprettet – tegn teigen i kartet')
          newParcel(id)
          return
        }
        selectOwner(id)
        flash('Eiendommen er oppdatert')
      } else if (edit.kind === 'route') {
        const original = edit.id ? routes.find((r) => r.id === edit.id) : null
        const draft = { ...edit.draft, hub: edit.draft.hub || nearestArea(areas, edit.draft.points[0]) || '' }
        const id = await saveRoute(original, draft)
        await refreshRoutes()
        selectRoute(id)
        flash(edit.id ? 'Ruta er oppdatert' : 'Ny rute opprettet')
      } else if (edit.kind === 'network') {
        const original = edit.id ? networks.find((n) => n.id === edit.id) : null
        const first = edit.draft.points?.[0]
        const draft = { ...edit.draft, hub: edit.draft.hub || (first ? nearestArea(areas, first) : '') || '' }
        const id = await saveNetwork(original, draft)
        if (!original) {
          try {
            await addPath(id, edit.draft.points, snapM, { color: edit.draft.color, kind: edit.draft.kind })
          } catch (error) {
            // Don't leave an empty network behind when its first path couldn't be saved
            await deleteNetwork({ id }).catch(() => {})
            throw error
          }
        } else {
          // Only send the lines back when a vertex was actually moved, so a rename never re-merges them
          if (JSON.stringify(edit.draft.segments) !== JSON.stringify(original.segments)) await setNetworkGeometry(id, edit.draft.segments, snapM)
          // …and the style only when one was picked that differs from what the network had throughout
          const had = networkStyle(original)
          const style = {
            color: edit.draft.color && edit.draft.color !== had.color ? edit.draft.color : null,
            kind: edit.draft.kind && edit.draft.kind !== had.kind ? edit.draft.kind : null,
          }
          if (style.color || style.kind) await setNetworkStyleAll(id, style)
        }
        await refreshNetworks()
        selectNetwork(id)
        flash(edit.id ? 'Stinettverket er oppdatert' : 'Nytt stinettverk opprettet')
      } else if (edit.kind === 'network-path') {
        await addPath(edit.id, edit.draft.points, snapM, { color: edit.draft.color, kind: edit.draft.kind })
        await refreshNetworks()
        selectNetwork(edit.id)
        flash('Stien er lagt til i nettverket')
      } else if (edit.kind === 'network-style') {
        const target = networks.find((n) => n.id === edit.id)
        const path = networkPath(target.parts, edit.draft.from, edit.draft.to)
        if (!path) throw new Error('Fant ingen vei langs nettverket mellom de to punktene')
        await setNetworkStyle(edit.id, path, { color: edit.draft.color, kind: edit.draft.kind })
        await refreshNetworks()
        selectNetwork(edit.id)
        flash('Strekningen er oppdatert')
      } else if (edit.kind === 'network-remove') {
        await removePart(edit.id, edit.draft.part, snapM)
        await refreshNetworks()
        selectNetwork(edit.id)
        flash('Biten er fjernet')
      } else {
        const original = edit.id ? parcels.find((p) => p.id === edit.id) : null
        await saveParcel(original, edit.draft)
        await refreshOwners()
        selectOwner(edit.draft.ownerId)
        flash(edit.id ? 'Teigen er oppdatert' : 'Ny teig opprettet')
      }
      cancelEdit()
    } catch (error) {
      console.error('Saving failed:', error)
      setSaveError(`Kunne ikke lagre: ${errorMessage(error)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    setSaving(true)
    setSaveError(null)
    try {
      if (edit.kind === 'entry') {
        await deleteEntry(entries.find((e) => e.key === edit.id))
        if (worklogMode) setEntryId(null)
        else navigate({ mode: 'finnes' })
        flash('Arbeidet er slettet')
        await refresh()
      } else if (edit.kind === 'area') {
        await deleteArea(areas.find((a) => a.id === edit.id))
        selectArea(null)
        flash('Området er slettet')
        await refresh()
      } else if (edit.kind === 'owner') {
        await deleteOwner(owners.find((o) => o.id === edit.id))
        selectOwner(null)
        flash('Eiendommen er slettet')
        await refreshOwners()
      } else if (edit.kind === 'route') {
        await deleteRoute(routes.find((r) => r.id === edit.id))
        navigate({ mode: 'ruter' })
        flash('Ruta er slettet')
        await refreshRoutes()
      } else if (edit.kind === 'network') {
        await deleteNetwork(networks.find((n) => n.id === edit.id))
        navigate({ mode: 'stinettverk' })
        flash('Stinettverket er slettet')
        await refreshNetworks()
      } else {
        await deleteParcel(parcels.find((p) => p.id === edit.id))
        flash('Teigen er slettet')
        await refreshOwners()
      }
      cancelEdit()
    } catch (error) {
      console.error('Deleting failed:', error)
      setSaveError(`Kunne ikke slette: ${errorMessage(error)}`)
    } finally {
      setSaving(false)
    }
  }

  const placeName = edit?.kind === 'entry' ? 'punktet' : 'området'
  const drawing = edit && accumulatesPoints(edit)
  const drawGeom = drawing ? drawnGeomType(edit) : null
  const drawCount = drawing ? edit.draft.points.length : 0
  const blockedDeleteCount = edit?.kind === 'area' && edit.id ? entries.filter((e) => e.area === edit.id).length : 0
  // Deleting an owner cascades onto their parcels in the DB, so this only informs — it never blocks.
  const ownerParcelCount = edit?.kind === 'owner' && edit.id ? parcels.filter((p) => p.ownerId === edit.id).length : 0

  const renderAside = () => {
    if (edit) {
      return isOwnerEdit(edit) ? (
        <OwnerEditForm
          edit={edit}
          areas={areas}
          owners={owners}
          placing={placing}
          tried={tried}
          onCancel={cancelEdit}
          onChange={updateDraft}
          onStartDraw={restartDrawing}
          onUndoPoint={undoPoint}
          onFinishDraw={finishDrawing}
        />
      ) : isNetworkEdit(edit) ? (
        <NetworkEditForm
          edit={edit}
          network={networks.find((n) => n.id === edit.id)}
          areas={areas}
          snapM={snapM}
          onSnapM={changeSnapM}
          onRestartStretch={restartStretch}
          placing={placing}
          tried={tried}
          onCancel={cancelEdit}
          onChange={updateDraft}
          onStartDraw={restartDrawing}
          onUndoPoint={undoPoint}
          onFinishDraw={finishDrawing}
        />
      ) : isRouteEdit(edit) ? (
        <RouteEditForm
          edit={edit}
          areas={areas}
          placing={placing}
          tried={tried}
          onCancel={cancelEdit}
          onChange={updateDraft}
          onStartDraw={restartDrawing}
          onUndoPoint={undoPoint}
          onFinishDraw={finishDrawing}
          onUploadingChange={setUploading}
        />
      ) : (
        <EditForm
          key={edit.startedAt}
          edit={edit}
          areas={areas}
          placing={placing}
          tried={tried}
          onCancel={cancelEdit}
          onChange={updateDraft}
          onTogglePlace={() => setPlacing((p) => !p)}
          onSetPlacing={setPlacing}
          onStartDraw={restartDrawing}
          onUndoPoint={undoPoint}
          onFinishDraw={finishDrawing}
          onUploadingChange={setUploading}
        />
      )
    }

    if (owner) {
      return (
        <OwnerDetail
          owner={owner}
          areas={areaViews}
          routes={routes}
          entryId={entryId}
          backLabel={worklogMode ? '← Alle områder' : mode === 'grunneiere' ? '← Alle eiendommer' : '← Tilbake'}
          onBack={() => selectOwner(null)}
          onToggleEntry={toggleEntry}
          onSelectPoint={worklogMode ? undefined : selectPoint}
          userLocation={geo.userLocation}
          onSelectArea={worklogMode ? selectArea : (id) => { setOwnerId(null); setInfoAreas([id]); navigate({ mode: 'finnes' }) }}
          onSelectRoute={selectRoute}
          onEditOwner={editOwner}
          onNewParcel={() => newParcel(owner.id)}
          onEditParcel={editParcel}
        />
      )
    }

    if (mode === 'stinettverk') {
      if (network) {
        return (
          <NetworkDetail
            network={network}
            areas={areas}
            onBack={() => navigate({ mode: 'stinettverk' })}
            onEdit={() => editNetwork(network)}
            onAddPath={() => addNetworkPath(network)}
            onMarkStretch={() => markNetworkStretch(network)}
            onRemovePart={() => removeNetworkPart(network)}
          />
        )
      }
      return <NetworkList networks={networks} areas={areas} onSelect={selectNetwork} onNewNetwork={newNetwork} />
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
            onEditEntry={editEntry}
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
          showRedraw
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
            onEditRoute={() => editRoute(route)}
          />
        )
      }
      return <RouteList routes={routes} difficulty={difficulty} onDifficulty={setDifficulty} onSelect={selectRoute} onNewRoute={newRoute} />
    }

    if (mode === 'grunneiere') return <OwnerList owners={ownerViews} areas={areas} onSelect={selectOwner} onNewOwner={newOwner} />

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
          onEditArea={editArea}
          onNewEntry={newEntry}
          onEditEntry={editEntry}
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
        onNewArea={newArea}
      />
    )
  }

  return (
    <div className={`wl-app wl-mode-${mode}`}>
      <SiteHeader badge="Adminmodus" modes={MODES} mode={worklogMode ? null : mode} onMode={changeMode}>
        {!isMobile && <span className="wl-mono">{userEmail}</span>}
        {worklogMode
          ? <span className="wl-mono">Arbeidslogg</span>
          : !isMobile && <a href="?modus=arbeidslogg" className="wl-header-link" onClick={(event) => { event.preventDefault(); changeMode('arbeidslogg') }}>Arbeidslogg</a>}
        <a href="/" className="wl-header-link">Se nettside</a>
        <button type="button" className="wl-btn small" onClick={onSignOut}>Logg ut</button>
      </SiteHeader>

      <div className="wl-body">
        <aside className="wl-aside" style={{ '--aside-w': `${sidebarWidth}px` }}>
          {!isMobile && (
            <div className={`wl-resize-handle ${resizing ? 'active' : ''}`} onMouseDown={startResize} onTouchStart={startResize} />
          )}
          <div className="wl-scroll" ref={scrollRef}>
            {renderAside()}
            {(loading || ownersLoading) && <p className="wl-empty">Laster inn…</p>}
          </div>
          {edit && (
            isOwnerEdit(edit) ? (
              <OwnerEditFooter
                edit={edit}
                tried={tried}
                saving={saving}
                confirmDelete={confirmDelete}
                ownerParcelCount={ownerParcelCount}
                saveError={saveError}
                onSave={handleSave}
                onDelete={handleDelete}
                onCancel={cancelEdit}
              />
            ) : isNetworkEdit(edit) ? (
              <NetworkEditFooter
                edit={edit}
                tried={tried}
                saving={saving}
                confirmDelete={confirmDelete}
                saveError={saveError}
                onSave={handleSave}
                onDelete={handleDelete}
                onCancel={cancelEdit}
              />
            ) : isRouteEdit(edit) ? (
              <RouteEditFooter
                edit={edit}
                tried={tried}
                saving={saving}
                uploading={uploading}
                confirmDelete={confirmDelete}
                saveError={saveError}
                onSave={handleSave}
                onDelete={handleDelete}
                onCancel={cancelEdit}
              />
            ) : (
              <EditFooter
                edit={edit}
                tried={tried}
                saving={saving}
                uploading={uploading}
                confirmDelete={confirmDelete}
                blockedDeleteCount={blockedDeleteCount}
                saveError={saveError}
                onSave={handleSave}
                onDelete={handleDelete}
                onDuplicate={duplicateEntry}
                onCancel={cancelEdit}
              />
            )
          )}
        </aside>

        <WorklogMap
          mode={mode}
          areas={areas}
          entries={mode === 'finnes' ? infoEntries : entries}
          parcels={parcels}
          owners={ownerViews}
          routes={mode === 'ruter' ? shownRoutes : routes}
          networks={networks}
          layers={layers}
          areaId={areaId}
          entryId={worklogMode ? entryId : nav.point}
          ownerId={ownerId}
          routeId={nav.route}
          networkId={nav.network}
          filter={filter}
          edit={edit}
          drawGeom={drawGeom}
          placing={placing}
          version={version}
          isMobile={isMobile}
          geo={geo}
          onAreaClick={selectArea}
          onEntryClick={worklogMode ? toggleEntry : selectPoint}
          onOwnerClick={selectOwner}
          onRouteClick={selectRoute}
          onNetworkClick={selectNetwork}
          onPartClick={handlePartClick}
          onNetworkVertexMove={handleNetworkVertexMove}
          onNetworkVertexInsert={handleNetworkVertexInsert}
          onPlace={handlePlace}
          onDraftMove={handleDraftMove}
          onDraftVertexMove={handleDraftVertexMove}
          onInsertVertex={handleInsertVertex}
          onCloseShape={handleCloseShape}
        >
          {isMobile ? (
            <MapFilterMenu
              areas={areas}
              areaValue={infoAreas}
              onAreaChange={setInfoAreas}
              showAreas={mode === 'finnes' && !edit}
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
              {mode === 'finnes' && !edit && <MapAreaFilter areas={areas} value={infoAreas} onChange={setInfoAreas} />}
            </>
          )}

          {!edit && (
            <div className="wl-map-actions">
              {(mode === 'finnes' || worklogMode) && <button type="button" className="wl-map-btn dark" onClick={newEntry}>+ Nytt punkt</button>}
              {mode === 'ruter' && <button type="button" className="wl-map-btn" onClick={newRoute}>+ Ny turrute</button>}
              {mode === 'stinettverk' && network && <button type="button" className="wl-map-btn dark" onClick={() => addNetworkPath(network)}>+ Legg til sti</button>}
              {mode === 'stinettverk' && <button type="button" className="wl-map-btn" onClick={newNetwork}>+ Nytt stinettverk</button>}
              {worklogMode && <button type="button" className="wl-map-btn" onClick={newArea}>+ Nytt område</button>}
              {(worklogMode || mode === 'grunneiere') && <button type="button" className="wl-map-btn" onClick={newOwner}>+ Ny eiendom</button>}
            </div>
          )}

          {drawing ? (
            <div className={`wl-place-banner ${placing ? 'active' : ''}`}>
              <span>{placing && edit.kind === 'network-path' && drawCount === 0
                ? 'Trykk på en sti i nettverket for å starte'
                : placing
                ? `${drawCount} punkter · klikk i kartet for å legge til${drawGeom === 'poly' && drawCount >= GEOM_MIN.poly ? ', eller klikk første punkt for å lukke' : ''}`
                : `${drawCount} punkter plassert`}</span>
              {placing && drawCount > 0 && <button type="button" onClick={undoPoint}>Angre siste</button>}
              {placing
                ? <button type="button" disabled={drawCount < GEOM_MIN[drawGeom]} onClick={finishDrawing}>Fullfør</button>
                : <button type="button" onClick={restartDrawing}>Tegn på nytt</button>}
            </div>
          ) : edit?.kind === 'network' && edit.id ? (
            <div className="wl-place-banner active">
              <span>Dra punktene for å flytte linjene</span>
            </div>
          ) : edit?.kind === 'network-style' ? (
            <div className={`wl-place-banner ${placing ? 'active' : ''}`}>
              <span>{!edit.draft.from ? 'Trykk der strekningen starter' : !edit.draft.to ? 'Trykk der strekningen slutter' : 'Strekning valgt'}</span>
              {!placing && <button type="button" onClick={restartStretch}>Velg på nytt</button>}
            </div>
          ) : edit?.kind === 'network-remove' ? (
            <div className="wl-place-banner active">
              <span>{edit.draft.part == null ? 'Trykk på biten du vil fjerne' : 'Trykk på en annen bit for å velge den i stedet'}</span>
            </div>
          ) : edit && edit.kind !== 'owner' && !isNetworkEdit(edit) && (
            <div className={`wl-place-banner ${placing ? 'active' : ''}`}>
              <span>{placing ? `Klikk i kartet for å plassere ${placeName}` : `Dra markøren for å justere ${placeName}`}</span>
              <button type="button" onClick={() => setPlacing((p) => !p)}>{placing ? 'Avbryt' : 'Plasser på nytt'}</button>
            </div>
          )}

          {toast && <div className="wl-toast">✓ {toast}</div>}
        </WorklogMap>
      </div>
    </div>
  )
}

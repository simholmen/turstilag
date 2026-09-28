import L from 'leaflet'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AttributionControl, MapContainer, TileLayer, useMap, useMapEvent } from 'react-leaflet'
import pinIcon from 'lucide-static/icons/map-pin.svg?raw'
import { TYPES } from '../../models/worklog'
import { useGeolocation } from '../../hooks/useGeolocation'
import { useFullscreen } from '../../hooks/useFullscreen'
import { UserLocationMarker } from '../UserLocation'
import { BASE_LAYERS } from './baseLayers'
import MapControls from './MapControls'

const CENTER = [58.772, 5.855]
const PIN = pinIcon.slice(pinIcon.indexOf('<svg'))
const LAYER_KEY = 'arbeidslogg-bakgrunnskart'

// The chosen background map is a per-browser preference; storage can be unavailable (e.g. in iframes)
const readLayer = () => {
  try {
    const saved = localStorage.getItem(LAYER_KEY)
    return BASE_LAYERS.some((l) => l.id === saved) ? saved : BASE_LAYERS[0].id
  } catch {
    return BASE_LAYERS[0].id
  }
}

const round = (n) => Number(n.toFixed(5))
const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

const areaHtml = (name, count, small, faded) => `
  <div class="wl-area-pin ${small ? 'small' : ''}" style="opacity:${faded ? 0.7 : 1}">
    <span class="wl-area-pin-count">${count}</span>${escapeHtml(name)}
  </div>`

const draftAreaHtml = (name) => `
  <div class="wl-area-pin draft">
    <span class="wl-area-pin-count"><span class="wl-ico">${PIN}</span></span>${escapeHtml(name || 'Nytt område')}
  </div>`

const entryHtml = (type, size, selected, draft) => {
  const t = TYPES[type] || { color: '#5b6259', icon: PIN }
  const ring = draft
    ? '0 0 0 3px #fff,0 0 0 6px #1b2620,0 3px 8px rgba(0,0,0,.4)'
    : `0 0 0 ${selected ? 3 : 2}px #fff,0 0 0 ${selected ? 7 : 2}px ${t.color}55,0 2px 5px rgba(0,0,0,.35)`
  const icon = Math.round(size * 0.5)
  return `
    <div class="wl-entry-pin ${draft ? 'draft' : ''}" style="width:${size}px;height:${size}px;background:${t.color};box-shadow:${ring}">
      <span class="wl-ico" style="width:${icon}px;height:${icon}px">${t.icon}</span>
    </div>`
}

const ownerLabelHtml = (name, color, hi, faded) => (hi
  ? `<div class="wl-owner-pin hi"><span class="wl-owner-swatch hi" style="background:${color}"></span>${escapeHtml(name)}</div>`
  : `<div class="wl-owner-pin" style="opacity:${faded ? 0.7 : 1}"><span class="wl-owner-swatch" style="background:${color}"></span>${escapeHtml(name)}</div>`)

const vertexHtml = (i) => `<div class="wl-vertex-pin">${i + 1}</div>`
const midpointHtml = () => '<div class="wl-midpoint-pin"></div>'

const areaIcon = (html) => L.divIcon({ className: 'wl-divicon', html, iconSize: [0, 0] })
const entryIcon = (html, size) => L.divIcon({ className: 'wl-divicon', html, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })
const vertexIcon = (html) => L.divIcon({ className: 'wl-divicon', html, iconSize: [22, 22], iconAnchor: [11, 11] })
const midpointIcon = () => L.divIcon({ className: 'wl-divicon', html: midpointHtml(), iconSize: [14, 14], iconAnchor: [7, 7] })

function Markers({
  areas, entries, parcels, owners, layers, areaId, entryId, ownerId, filter, edit, placing,
  onAreaClick, onEntryClick, onOwnerClick, onPlace, onDraftMove, onDraftVertexMove, onInsertVertex,
}) {
  const map = useMap()
  const groupRef = useRef(null)

  useEffect(() => {
    const group = L.layerGroup().addTo(map)
    groupRef.current = group
    return () => group.remove()
  }, [map])

  useMapEvent('click', (event) => {
    if (placing) onPlace([round(event.latlng.lat), round(event.latlng.lng)])
  })

  useEffect(() => {
    map.getContainer().style.cursor = placing ? 'crosshair' : ''
  }, [map, placing])

  useEffect(() => {
    const group = groupRef.current
    if (!group) return
    group.clearLayers()

    const interactive = !edit
    const draft = edit?.draft
    const onDragEnd = (marker) => marker.on('dragend', () => {
      const p = marker.getLatLng()
      onDraftMove([round(p.lat), round(p.lng)])
    })

    const selectedArea = areas.find((a) => a.id === areaId)
    if (selectedArea?.polygon && !edit) {
      L.geoJSON(selectedArea.polygon, {
        interactive: false,
        style: { color: '#1b2620', weight: 2, opacity: 0.45, dashArray: '5 5', fillColor: '#2f5d3a', fillOpacity: 0.05 },
      }).addTo(group)
    }

    if (layers.owners) {
      const editingParcelId = edit?.kind === 'parcel' ? edit.id : null
      parcels.forEach((parcel) => {
        if (parcel.id === editingParcelId) return
        const owner = owners.find((o) => o.id === parcel.ownerId)
        if (!owner || !parcel.latLngRings.length) return
        const hi = ownerId === owner.id
        const faded = (ownerId && !hi) || Boolean(edit)
        const poly = L.polygon(parcel.latLngRings, {
          color: owner.color,
          weight: hi ? 3 : 2,
          opacity: faded ? 0.55 : 0.95,
          fillColor: owner.color,
          fillOpacity: hi ? 0.3 : faded ? 0.08 : 0.18,
          interactive,
        })
        if (interactive) poly.on('click', () => onOwnerClick(owner.id))
        poly.addTo(group)

        if (parcel.center) {
          const marker = L.marker(parcel.center, { icon: areaIcon(ownerLabelHtml(owner.name, owner.color, hi, faded)), zIndexOffset: hi ? 1500 : 800, interactive })
          if (interactive) marker.on('click', () => onOwnerClick(owner.id))
          marker.addTo(group)
        }
      })
    }

    if (layers.work) {
      areas.forEach((area) => {
        if (area.id === areaId) return
        if (edit?.kind === 'area' && edit.id === area.id) return
        const count = entries.filter((e) => e.area === area.id).length
        const small = Boolean(areaId) || edit?.kind === 'entry'
        const marker = L.marker(area.ll, { icon: areaIcon(areaHtml(area.name, count, small, Boolean(edit))), zIndexOffset: 1000, interactive })
        if (interactive) marker.on('click', () => onAreaClick(area.id))
        marker.addTo(group)
      })
    }

    if (edit?.kind === 'area' && draft.ll) {
      const marker = L.marker(draft.ll, { icon: areaIcon(draftAreaHtml(draft.name)), draggable: true, zIndexOffset: 3000 })
      onDragEnd(marker)
      marker.addTo(group)
    }

    if (layers.work) {
      const shownArea = edit?.kind === 'entry' ? draft.area : areaId
      entries.forEach((entry) => {
        if (!shownArea || entry.area !== shownArea) return
        if (!edit && filter && entry.type !== filter) return
        if (edit?.kind === 'entry' && edit.id === entry.key) return
        const selected = !edit && entryId === entry.key
        const size = selected ? 36 : 28
        const html = `<div style="opacity:${edit ? 0.55 : 1}">${entryHtml(entry.type, size, selected)}</div>`
        const marker = L.marker(entry.ll, { icon: entryIcon(html, size), zIndexOffset: selected ? 2000 : 500, interactive })
        if (interactive) marker.on('click', () => onEntryClick(entry.key))
        marker.addTo(group)
      })
    }

    if (edit?.kind === 'entry' && draft.ll) {
      const marker = L.marker(draft.ll, { icon: entryIcon(entryHtml(draft.type, 38, true, true), 38), draggable: true, zIndexOffset: 3000 })
      onDragEnd(marker)
      marker.addTo(group)
    }

    if (edit?.kind === 'parcel') {
      const points = draft.points || []
      if (points.length >= 2) {
        L.polygon(points, { color: '#1b2620', weight: 2, dashArray: '5 5', fillColor: '#1b2620', fillOpacity: 0.12, interactive: false }).addTo(group)
      }
      points.forEach((point, i) => {
        const marker = L.marker(point, { icon: vertexIcon(vertexHtml(i)), draggable: true, zIndexOffset: 3000 })
        marker.on('dragend', () => {
          const p = marker.getLatLng()
          onDraftVertexMove(i, [round(p.lat), round(p.lng)])
        })
        marker.addTo(group)
      })
      // Once the outline is closed, a handle on each edge lets you drag it outward to grow
      // the shape — dropping it inserts a new corner there, same as dragging a placed one.
      if (!placing && points.length >= 3) {
        points.forEach((point, i) => {
          const next = points[(i + 1) % points.length]
          const mid = [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2]
          const marker = L.marker(mid, { icon: midpointIcon(), draggable: true, zIndexOffset: 2800 })
          marker.on('dragend', () => {
            const p = marker.getLatLng()
            onInsertVertex(i + 1, [round(p.lat), round(p.lng)])
          })
          marker.addTo(group)
        })
      }
    }
  }, [areas, entries, parcels, owners, layers, areaId, entryId, ownerId, filter, edit, placing, onAreaClick, onEntryClick, onOwnerClick, onDraftMove, onDraftVertexMove, onInsertVertex])

  return null
}

// Moves the map whenever `view.key` changes: fits to a set of points or flies to one
function Viewport({ view, isMobile }) {
  const map = useMap()
  const lastKey = useRef(null)

  useEffect(() => {
    const container = map.getContainer()
    const observer = new ResizeObserver(() => map.invalidateSize())
    observer.observe(container)
    return () => observer.disconnect()
  }, [map])

  useEffect(() => {
    if (lastKey.current === view.key) return
    lastKey.current = view.key
    if (view.fly) {
      map.flyTo(view.fly, view.zoom, { duration: 0.6 })
    } else if (view.fit?.length) {
      const padding = isMobile ? [36, 36] : [60, 60]
      map.fitBounds(L.latLngBounds(view.fit), { padding, maxZoom: 16 })
    }
  }, [map, view, isMobile])

  return null
}

export default function WorklogMap({
  areas, entries, parcels = [], owners = [], layers = { work: true, owners: true, routes: false },
  areaId, entryId, ownerId, filter, edit, placing, version, isMobile,
  onAreaClick, onEntryClick, onOwnerClick, onPlace, onDraftMove, onDraftVertexMove, onInsertVertex, children,
}) {
  const view = useMemo(() => {
    if (edit) {
      if (edit.kind === 'parcel') {
        // Move the map once, before any corners are placed, to get the admin looking at
        // roughly the right spot — then leave it alone. Re-fitting on every click would fight
        // the admin's own panning/zooming while they place points.
        if ((edit.draft.points || []).length === 0 && edit.initialLL) {
          return { key: `edit:parcel:${edit.id ?? 'new'}:${edit.startedAt}:start`, fly: edit.initialLL, zoom: 15 }
        }
        return { key: `edit:parcel:${edit.id ?? 'new'}:${edit.startedAt}:drawing` }
      }
      const ll = edit.initialLL
      return { key: `edit:${edit.kind}:${edit.id ?? 'new'}:${edit.startedAt}`, fly: ll, zoom: edit.kind === 'area' ? 14 : 16 }
    }
    const entry = entryId && entries.find((e) => e.key === entryId)
    if (entry) return { key: `entry:${entryId}`, fly: entry.ll, zoom: 16 }

    const owner = ownerId && owners.find((o) => o.id === ownerId)
    if (owner) {
      const fit = parcels.filter((p) => p.ownerId === owner.id).flatMap((p) => p.latLngRings.flat())
      return { key: `owner:${ownerId}`, fit }
    }

    const area = areaId && areas.find((a) => a.id === areaId)
    const fit = area
      ? [area.ll, ...entries.filter((e) => e.area === area.id).map((e) => e.ll)]
      : [
        ...(layers.work ? areas.map((a) => a.ll) : []),
        ...(layers.owners ? parcels.flatMap((p) => p.latLngRings.flat()) : []),
      ]
    return { key: `fit:${areaId ?? 'all'}:${version}:${layers.work}:${layers.owners}`, fit }
  }, [edit, entryId, entries, areaId, areas, ownerId, owners, parcels, layers, version])

  const [map, setMap] = useState(null)
  const [baseLayer, setBaseLayer] = useState(readLayer)
  const layer = BASE_LAYERS.find((l) => l.id === baseLayer)
  const { userLocation, geoError, requestLocation } = useGeolocation()
  const fullscreenRef = useRef(document.documentElement)
  const { isFullscreen, toggleFullscreen } = useFullscreen(fullscreenRef)

  const chooseLayer = (id) => {
    setBaseLayer(id)
    try { localStorage.setItem(LAYER_KEY, id) } catch { /* not persisted */ }
  }

  return (
    <div className="wl-map">
      <MapContainer ref={setMap} center={CENTER} zoom={13} zoomControl={false} attributionControl={false} className="wl-map-canvas">
        <TileLayer key={layer.id} url={layer.url} maxZoom={18} />
        {/* Leaflet leaves the old credit behind when a layer is swapped, so the control carries it instead */}
        <AttributionControl key={layer.id} position="bottomleft" prefix={layer.attribution} />
        <Markers
          areas={areas}
          entries={entries}
          parcels={parcels}
          owners={owners}
          layers={layers}
          areaId={areaId}
          entryId={entryId}
          ownerId={ownerId}
          filter={filter}
          edit={edit}
          placing={placing}
          onAreaClick={onAreaClick}
          onEntryClick={onEntryClick}
          onOwnerClick={onOwnerClick}
          onPlace={onPlace}
          onDraftMove={onDraftMove}
          onDraftVertexMove={onDraftVertexMove}
          onInsertVertex={onInsertVertex}
        />
        <Viewport view={view} isMobile={isMobile} />
        {userLocation && <UserLocationMarker position={userLocation} />}
      </MapContainer>
      <MapControls
        map={map}
        baseLayer={baseLayer}
        onBaseLayer={chooseLayer}
        userLocation={userLocation}
        geoError={geoError}
        onLocate={requestLocation}
        isFullscreen={isFullscreen}
        onFullscreen={toggleFullscreen}
      />
      {children}
    </div>
  )
}

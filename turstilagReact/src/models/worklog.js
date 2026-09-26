import { supabase } from '../lib/supabase'
import { deleteImages } from '../lib/images'
import { featureMatchesHub } from './features'
import fence from 'lucide-static/icons/fence.svg?raw'
import droplets from 'lucide-static/icons/droplets.svg?raw'
import shovel from 'lucide-static/icons/shovel.svg?raw'
import signpost from 'lucide-static/icons/signpost.svg?raw'
import axe from 'lucide-static/icons/axe.svg?raw'
import mapIcon from 'lucide-static/icons/map.svg?raw'
import footprints from 'lucide-static/icons/footprints.svg?raw'
import circleDot from 'lucide-static/icons/circle-dot.svg?raw'

// Drop the license comment so the markup can be inlined anywhere
const svg = (raw) => raw.slice(raw.indexOf('<svg'))

// Work types. `gjerdeklyver` lives in its own table, everything else in other_points.kind.
export const TYPES = {
  gjerdeklyver: { label: 'Gjerdeklyver', color: '#b4532a', icon: svg(fence) },
  drenering: { label: 'Drenering', color: '#2c6e8a', icon: svg(droplets) },
  grus: { label: 'Grus / underlag', color: '#a8841f', icon: svg(shovel) },
  merking: { label: 'Merking', color: '#c8242b', icon: svg(signpost) },
  rydding: { label: 'Rydding', color: '#4f7a36', icon: svg(axe) },
  turinfo: { label: 'Turinfo', color: '#6a4f8c', icon: svg(mapIcon) },
  nysti: { label: 'Ny sti', color: '#1b2620', icon: svg(footprints) },
  // Older rows with a kind that isn't one of the above (e.g. 'poi', 'trail')
  annet: { label: 'Annet', color: '#5b6259', icon: svg(circleDot) },
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

export const formatDate = (date) => {
  if (!date) return 'Dato ukjent'
  const [y, m, d] = date.split('-')
  return `${Number(d)}. ${MONTHS[m - 1]} ${y}`
}

export const byDateDesc = (a, b) => (b.date || '0').localeCompare(a.date || '0')

// Adds the per-area numbers shown in the list and detail views
export const buildAreaViews = (areas, entries) => areas.map((area) => {
  const list = entries.filter((e) => e.area === area.id).sort(byDateDesc)
  const counts = {}
  list.forEach((e) => { counts[e.type] = (counts[e.type] || 0) + 1 })
  const types = Object.keys(TYPES)
    .filter((key) => counts[key])
    .map((key) => ({ key, label: TYPES[key].label, count: counts[key] }))
  const lastDated = list.find((e) => e.date)

  return {
    ...area,
    list,
    types,
    count: list.length,
    lastRaw: lastDated?.date || '',
    last: lastDated ? formatDate(lastDated.date) : '—',
  }
})

export const tableForType =(type) => (type === 'gjerdeklyver' ? 'gjerdeklyvere' : 'other_points')

const entryKey = (table, id) => `${table}:${id}`

// GeoJSON is [lng, lat], Leaflet is [lat, lng]
const toLatLng = (point) => (point?.coordinates ? [point.coordinates[1], point.coordinates[0]] : null)
const toPoint = ([lat, lng]) => ({ type: 'Point', coordinates: [lng, lat] })

// Used until the hub_location migration has run and the view returns `location`
const polygonCenter = (geometry) => {
  const coords = geometry?.type === 'Polygon'
    ? geometry.coordinates[0]
    : geometry?.type === 'MultiPolygon' ? geometry.coordinates[0]?.[0] : null
  if (!coords?.length) return null
  const [sumLng, sumLat] = coords.reduce(([x, y], [lng, lat]) => [x + lng, y + lat], [0, 0])
  return [sumLat / coords.length, sumLng / coords.length]
}

const entryType = (row) => {
  if (row.kind === 'gjerdeklyver' || row.icon === 'gjerdeklyver') return 'gjerdeklyver'
  return TYPES[row.kind] ? row.kind : 'annet'
}

const rowToArea = (row) => ({
  id: row.id,
  slug: row.slug,
  name: row.title,
  desc: row.description || '',
  images: row.images || [],
  ll: toLatLng(row.location) || polygonCenter(row.geometry),
  polygon: row.geometry,
})

const rowToEntry = (row, area) => {
  const table = row.kind === 'gjerdeklyver' ? 'gjerdeklyvere' : 'other_points'
  return {
    key: entryKey(table, row.id),
    id: row.id,
    table,
    area: area?.id ?? null,
    type: entryType(row),
    title: row.title,
    date: row.last_updated,
    desc: row.description || '',
    images: row.images || [],
    ll: toLatLng(row.geometry),
  }
}

// Entries without a hub_id are matched to the area whose polygon contains them
const findArea = (row, areas) => (
  areas.find((a) => row.feature_group && a.slug === row.feature_group)
  || areas.find((a) => a.polygon && featureMatchesHub(
    { properties: { kind: 'hub' }, geometry: a.polygon },
    { properties: { kind: row.kind }, geometry: row.geometry },
  ))
)

export const loadWorklog = async () => {
  const { data, error } = await supabase.from('all_features_geojson').select('*')
  if (error) throw error

  const rows = data || []
  const areas = rows.filter((row) => row.kind === 'hub').map(rowToArea).filter((a) => a.ll)
  const entries = rows
    .filter((row) => row.kind !== 'hub' && row.geometry?.type === 'Point')
    .map((row) => rowToEntry(row, findArea(row, areas)))
    .filter((e) => e.area)

  return { areas, entries }
}

const removedImages = (before, after) => before.filter((img) => !after.includes(img))

const cleanupImages = async (images) => {
  try {
    await deleteImages(images)
  } catch (error) {
    console.error('Deleting removed images failed:', error)
  }
}

const slugify = (name) => name
  .toLowerCase()
  .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'a')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

// Returns the id of the saved area
export const saveArea = async (original, draft) => {
  const payload = {
    title: draft.name.trim(),
    description: draft.desc.trim() || null,
    images: draft.images,
    location: toPoint(draft.ll),
  }

  if (!original) {
    const name = `${slugify(payload.title) || 'omrade'}-${Date.now().toString(36)}`
    const { data, error } = await supabase.from('hubs').insert({ ...payload, name }).select('id').single()
    if (error) throw error
    return String(data.id)
  }

  const { error } = await supabase.from('hubs').update(payload).eq('id', original.id)
  if (error) throw error
  await cleanupImages(removedImages(original.images, draft.images))
  return original.id
}

export const deleteArea = async (area) => {
  const { error } = await supabase.from('hubs').delete().eq('id', area.id)
  if (error) throw error
  await cleanupImages(area.images)
}

// Returns the key of the saved entry. Changing to or from gjerdeklyver moves the row between tables.
export const saveEntry = async (original, draft) => {
  const table = tableForType(draft.type)
  const payload = {
    title: draft.title.trim(),
    description: draft.desc.trim() || null,
    last_updated: draft.date || null,
    images: draft.images,
    geom: toPoint(draft.ll),
    hub_id: Number(draft.area),
  }
  if (table === 'other_points') payload.kind = draft.type

  if (!original || original.table !== table) {
    const { data, error } = await supabase.from(table).insert(payload).select('id').single()
    if (error) throw error

    if (original) {
      const { error: deleteError } = await supabase.from(original.table).delete().eq('id', original.id)
      if (deleteError) throw deleteError
      await cleanupImages(removedImages(original.images, draft.images))
    }
    return entryKey(table, data.id)
  }

  const { error } = await supabase.from(table).update(payload).eq('id', original.id)
  if (error) throw error
  await cleanupImages(removedImages(original.images, draft.images))
  return original.key
}

export const deleteEntry = async (entry) => {
  const { error } = await supabase.from(entry.table).delete().eq('id', entry.id)
  if (error) throw error
  await cleanupImages(entry.images)
}

export const missingFields = ({ kind, draft }) => {
  const missing = []
  if (kind === 'entry') {
    if (!draft.area) missing.push('turområde')
    if (!draft.type) missing.push('type arbeid')
    if (!draft.title.trim()) missing.push('tittel')
  } else if (!draft.name.trim()) {
    missing.push('navn')
  }
  if (!draft.ll) missing.push('plassering')
  return missing
}

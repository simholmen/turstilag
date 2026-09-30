import { supabase } from '../lib/supabase'
import { deleteImages } from '../lib/images'
import { pointsToLineGeometry } from './geometry'
import { TYPES, fmtKm, subtypesLabel } from './worklog'

export { pointsToLineGeometry }

// Line colour = difficulty, as standard Norwegian trail marking. rød is the same red as the old
// merking type — that type is gone, so the two never meet.
export const DIFFICULTY = {
  gronn: { label: 'Grønn', color: '#2f8f46' },
  bla: { label: 'Blå', color: '#1f63b4' },
  rod: { label: 'Rød', color: '#c8242b' },
  svart: { label: 'Svart', color: '#1b2620' },
}

export const SHAPES = { rundtur: 'Rundtur', turretur: 'Tur-retur', ab: 'A–B' }

// Facilitated stretches along a route: solid for a bridge, planks for everything else. The map
// (dashArray) and the sidebar strip (this gradient) must read alike.
export const BRIDGE_COLOR = TYPES.tilrettelegging.color
export const PLANK_BG = `repeating-linear-gradient(90deg,${BRIDGE_COLOR} 0 3px,#fff 3px 5px)`
export const spanBg = (subtypes) => (subtypes?.includes('bru') ? BRIDGE_COLOR : PLANK_BG)

// A start and end this close on a rundtur are the same spot
const LOOP_SNAP_KM = 0.02

// GeoJSON LineString -> Leaflet [lat, lng] vertices. A MultiLineString gives its first part.
export const toLatLngLine = (geometry) => {
  if (!geometry) return []
  if (geometry.type === 'LineString') return (geometry.coordinates || []).map(([lng, lat]) => [lat, lng])
  if (geometry.type === 'MultiLineString') return (geometry.coordinates?.[0] || []).map(([lng, lat]) => [lat, lng])
  return []
}

// Walking time: 4 km/h plus 10 min per 100 m of climb. `climb` is free text like '140 m'.
export const fmtTime = (km, climb) => {
  const ascent = parseInt(climb, 10) || 0
  const minutes = Math.round(((km / 4) * 60 + ascent / 10) / 5) * 5
  if (minutes < 60) return `ca. ${Math.max(minutes, 5)} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `ca. ${h} t ${m}` : `ca. ${h} t`
}

const rowToFeature = (row) => ({
  routeId: row.route_id,
  key: `${row.feature_table}:${row.feature_id}`,
  kind: TYPES[row.kind] ? row.kind : 'annet',
  subtypes: row.subtypes || [],
  subtypeOther: row.subtype_other || '',
  title: row.title,
  km: row.km || 0,
  kmFra: row.km_fra ?? null,
  kmTil: row.km_til ?? null,
  lengthM: row.length_m || 0,
})

export const rowToRoute = (row, features = [], ownerIds = []) => {
  const difficulty = DIFFICULTY[row.difficulty] ? row.difficulty : 'gronn'
  const shape = SHAPES[row.shape] ? row.shape : 'rundtur'
  return {
    id: String(row.id),
    hubId: row.hub_id ? String(row.hub_id) : null,
    title: row.title,
    desc: row.description || '',
    images: row.images || [],
    difficulty,
    shape,
    climb: row.climb || '',
    direction: row.direction || '',
    km: row.km || 0,
    latLngs: toLatLngLine(row.geometry),
    badge: `${DIFFICULTY[difficulty].label} · ${SHAPES[shape]}`,
    features,
    ownerIds,
    gjerdeCount: features.filter((f) => f.kind === 'gjerdeklyver').length,
    tilretteCount: features.filter((f) => f.kind === 'tilrettelegging').length,
    updatedAt: row.updated_at,
  }
}

export const loadRoutes = async () => {
  const [
    { data: routeRows, error: routeError },
    { data: featureRows, error: featureError },
    { data: ownerRows, error: ownerError },
  ] = await Promise.all([
    supabase.from('routes_geojson').select('*'),
    supabase.from('route_features').select('*'),
    supabase.from('route_owners').select('*'),
  ])
  if (routeError) throw routeError
  if (featureError) throw featureError
  if (ownerError) throw ownerError

  const features = (featureRows || []).map(rowToFeature)
  return (routeRows || []).map((row) => rowToRoute(
    row,
    features.filter((f) => f.routeId === String(row.id)),
    (ownerRows || []).filter((o) => o.route_id === String(row.id)).map((o) => String(o.owner_id)),
  ))
}

// Everything along a route in km order. Linear features (km_fra/km_til) are spans, the rest points.
export const buildAlong = (route, features = route.features) => features
  .map((f) => {
    const t = TYPES[f.kind] || TYPES.annet
    const label = subtypesLabel(f.kind, f.subtypes, f.subtypeOther)
    const span = f.kmFra != null && f.kmTil != null
    let km = span ? f.kmFra : f.km
    if (!span && route.shape === 'rundtur' && route.km - km < LOOP_SNAP_KM) km = 0
    return {
      key: f.key,
      kind: f.kind,
      subtypes: f.subtypes,
      color: t.color,
      icon: t.icon,
      km,
      kmTo: span ? f.kmTil : null,
      title: f.title,
      sub: span ? `${label || t.label} · ${Math.round(f.lengthM)} m` : label || t.label,
    }
  })
  .sort((a, b) => a.km - b.km)

const pct = (km, total) => `${Math.min(100, Math.max(0, total ? (km / total) * 100 : 0))}%`

// Positions for the "Langs ruta" strip: point markers and facilitated-stretch bands
export const buildStrip = (route, along = buildAlong(route)) => ({
  markers: along.filter((a) => a.kmTo == null).map((a) => ({ ...a, left: pct(a.km, route.km) })),
  bands: along.filter((a) => a.kmTo != null).map((a) => ({
    key: a.key,
    left: pct(a.km, route.km),
    width: pct(a.kmTo - a.km, route.km),
    bg: spanBg(a.subtypes),
  })),
  axis: ['0', fmtKm(route.km / 2), fmtKm(route.km)],
})

const removedImages = (before, after) => before.filter((img) => !after.includes(img))

const cleanupImages = async (images) => {
  try {
    await deleteImages(images)
  } catch (error) {
    console.error('Deleting removed images failed:', error)
  }
}

export const saveRoute = async (original, draft) => {
  const payload = {
    title: draft.title.trim(),
    description: draft.desc.trim() || null,
    images: draft.images,
    difficulty: draft.difficulty,
    shape: draft.shape,
    hub_id: draft.hub ? Number(draft.hub) : null,
    climb: draft.climb.trim() || null,
    direction: draft.direction.trim() || null,
    geom: pointsToLineGeometry(draft.points),
  }

  if (!original) {
    const { data, error } = await supabase.from('routes').insert(payload).select('id').single()
    if (error) throw error
    return String(data.id)
  }

  const { error } = await supabase.from('routes').update(payload).eq('id', original.id)
  if (error) throw error
  await cleanupImages(removedImages(original.images, draft.images))
  return original.id
}

export const deleteRoute = async (route) => {
  const { error } = await supabase.from('routes').delete().eq('id', route.id)
  if (error) throw error
  await cleanupImages(route.images)
}

export const missingRouteFields = (draft) => {
  const missing = []
  if (!draft.title.trim()) missing.push('navn')
  if (!draft.points || draft.points.length < 2) missing.push('rute i kartet (minst 2 punkter)')
  return missing
}

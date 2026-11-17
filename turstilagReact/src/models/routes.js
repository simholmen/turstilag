import { supabase } from '../lib/supabase'
import { deleteImages } from '../lib/images'
import { pointsToLineGeometry } from './geometry'
import { START_SNAP_M, nearestOnNetwork } from './networks'
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
export const BRIDGE_COLOR = TYPES.stiforbedring.color
export const PLANK_BG = `repeating-linear-gradient(90deg,${BRIDGE_COLOR} 0 3px,#fff 3px 5px)`
export const spanBg = (subtypes) => (subtypes?.includes('bru') ? BRIDGE_COLOR : PLANK_BG)

// How a linear entry is drawn: a stack of polyline styles, bottom first. Turruter keeps to the simple
// bru/planks pair above, read while walking; Hva finnes and the admin views get one look per
// stiforbedring subtype, loosely after the real thing. The legend draws the same stacks as SVG.
const PLANKS = [{ color: '#fff', weight: 8 }, { color: BRIDGE_COLOR, weight: 6, dashArray: '3 2' }]
const BRIDGE = [{ color: BRIDGE_COLOR, weight: 7 }]

export const STRETCH_STYLES = {
  bru: BRIDGE,
  klopp: PLANKS,
  // Rungs across a thin line
  trapp: [{ color: '#fff', weight: 9 }, { color: BRIDGE_COLOR, weight: 3 }, { color: '#3b3128', weight: 9, dashArray: '2 4' }],
  // A row of round links beside the path
  kjetting: [{ color: '#fff', weight: 7 }, { color: '#3b3f44', weight: 2 }, { color: '#3b3f44', weight: 5, dashArray: '0.1 7', lineCap: 'round' }],
  // Grey stones with dark joints
  naturstein: [{ color: '#6f6a62', weight: 9 }, { color: '#bdb7ab', weight: 6, dashArray: '6 3' }],
  // Short blue pipes across the path
  stikkror: [{ color: '#fff', weight: 7 }, { color: BRIDGE_COLOR, weight: 2 }, { color: '#3a7ca5', weight: 11, dashArray: '3 7' }],
  // Speckled beige
  grus: [{ color: '#8f7a52', weight: 9 }, { color: '#d2bf93', weight: 6 }, { color: '#8f7a52', weight: 2, dashArray: '0.1 5', lineCap: 'round' }],
  // Broken warm brown chips
  treflis: [{ color: '#5b3a1a', weight: 9 }, { color: '#a8743f', weight: 6, dashArray: '4 2' }],
  // Smooth pale grey
  steinstov: [{ color: '#8c8a85', weight: 9 }, { color: '#dcd9d2', weight: 6 }],
}

// `detailed` picks the per-subtype look. A line of another kind (annet) is drawn in its kind colour.
export const stretchStyle = (kind, subtypes, detailed) => {
  if (kind !== 'stiforbedring') return [{ color: '#fff', weight: 7 }, { color: (TYPES[kind] || TYPES.annet).color, weight: 4 }]
  const bridge = subtypes?.includes('bru')
  if (!detailed) return bridge ? BRIDGE : PLANKS
  return STRETCH_STYLES[subtypes?.[0]] || PLANKS
}

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

// Alternative stretches: an omvei comes back onto the route and replaces the part between its ends, an
// avstikker leaves it and is walked out and back. Which one is worked out by the database.
export const ALTERNATIVE_KINDS = { omvei: 'Omvei', avstikker: 'Avstikker' }
export const STANDARD_VARIANT_NAME = 'Standard'

const rowToAlternative = (row) => ({
  id: String(row.id),
  label: row.label || '',
  kind: ALTERNATIVE_KINDS[row.kind] ? row.kind : 'omvei',
  km: row.km || 0,
  latLngs: toLatLngLine(row.geometry),
  detached: Boolean(row.detached),
})

// difficulty and climb are null/'' where the variant goes by the route's (see routeVariant)
const rowToVariant = (row, features = [], ownerIds = []) => ({
  id: String(row.id),
  name: row.name,
  difficulty: DIFFICULTY[row.difficulty] ? row.difficulty : null,
  climb: row.climb || '',
  desc: row.description || '',
  sortOrder: row.sort_order || 0,
  km: row.km || 0,
  latLngs: toLatLngLine(row.geometry),
  features,
  ownerIds,
  alternativeIds: (row.alternative_ids || []).map(String),
})

const counts = (features) => ({
  gjerdeCount: features.filter((f) => f.kind === 'gjerdeklyver').length,
  stiforbedringCount: features.filter((f) => f.kind === 'stiforbedring').length,
})

const badgeOf = (difficulty, shape) => `${DIFFICULTY[difficulty].label} · ${SHAPES[shape]}`

// The route as stored is its Standard variant: `km`, `latLngs`, `features` and the rest are always
// Standard's, so code that knows nothing of variants keeps working. `variants` lists every way to walk
// it, Standard first (id null); routeVariant() gives the route as another variant walks it.
export const rowToRoute = (row, features = [], ownerIds = [], variantRows = [], alternativeRows = []) => {
  const difficulty = DIFFICULTY[row.difficulty] ? row.difficulty : 'gronn'
  const shape = SHAPES[row.shape] ? row.shape : 'rundtur'
  const km = row.km || 0
  const latLngs = toLatLngLine(row.geometry)
  const standard = {
    id: null, name: row.variant_name || STANDARD_VARIANT_NAME, difficulty, climb: row.climb || '', desc: '',
    sortOrder: -Infinity, km, latLngs, features, ownerIds, alternativeIds: [],
  }
  const variants = [standard, ...variantRows
    .map((v) => rowToVariant(v, v.features, v.ownerIds))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'nb'))]
  const kms = variants.map((v) => v.km)
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
    km,
    latLngs,
    badge: badgeOf(difficulty, shape),
    features,
    ownerIds,
    ...counts(features),
    variantId: null,
    variantName: row.variant_name || '',
    variants,
    alternatives: alternativeRows.map(rowToAlternative),
    kmRange: [Math.min(...kms), Math.max(...kms)],
    // Along any of its variants: which routes pass a point or a property
    anyFeatureKeys: [...new Set(variants.flatMap((v) => v.features.map((f) => f.key)))],
    anyOwnerIds: [...new Set(variants.flatMap((v) => v.ownerIds))],
    updatedAt: row.updated_at,
  }
}

// The route as `variantId` walks it: its length, line, difficulty, climb and what lies along it. An
// unknown or null id gives Standard, the route itself.
export const routeVariant = (route, variantId) => {
  const v = variantId ? route.variants.find((x) => x.id === variantId) : null
  if (!v) return route
  const difficulty = v.difficulty || route.difficulty
  return {
    ...route,
    variantId: v.id,
    difficulty,
    climb: v.climb || route.climb,
    km: v.km,
    latLngs: v.latLngs,
    features: v.features,
    ownerIds: v.ownerIds,
    badge: badgeOf(difficulty, route.shape),
    ...counts(v.features),
  }
}

// A route matches a difficulty if any of its variants is of it
export const routeHasDifficulty = (route, difficulty) => !difficulty
  || route.variants.some((v) => (v.difficulty || route.difficulty) === difficulty)

// The variant a tap on an alternative stretch picks: the first, in the list's order, that uses it
export const variantForAlternative = (route, alternativeId) => route.variants
  .find((v) => v.alternativeIds.includes(alternativeId))?.id ?? null

const byRouteVariant = (rows, map = (r) => r) => {
  const grouped = new Map()
  rows.forEach((row) => {
    const key = `${row.route_id}:${row.variant_id ?? ''}`
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(map(row))
  })
  return (routeId, variantId) => grouped.get(`${routeId}:${variantId ?? ''}`) || []
}

export const loadRoutes = async () => {
  const results = await Promise.all([
    supabase.from('routes_geojson').select('*'),
    supabase.from('route_features').select('*'),
    supabase.from('route_owners').select('*'),
    supabase.from('route_variants_geojson').select('*'),
    supabase.from('route_alternatives_geojson').select('*'),
  ])
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
  const [routeRows, featureRows, ownerRows, variantRows, alternativeRows] = results.map((r) => r.data || [])

  const featuresOf = byRouteVariant(featureRows, rowToFeature)
  const ownersOf = byRouteVariant(ownerRows, (o) => String(o.owner_id))
  return routeRows.map((row) => {
    const id = String(row.id)
    const variants = variantRows
      .filter((v) => String(v.route_id) === id)
      .map((v) => ({ ...v, features: featuresOf(id, String(v.id)), ownerIds: ownersOf(id, String(v.id)) }))
    return rowToRoute(
      row,
      featuresOf(id, null),
      ownersOf(id, null),
      variants,
      alternativeRows.filter((a) => String(a.route_id) === id),
    )
  })
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
    variant_name: draft.variantName?.trim() || null,
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

// ── Alternative stretches and variants (admin) ─────────────────────────────────────────────────────

// A stretch starts on the route: its first point must be this close and is moved onto it. A last point
// this close is moved onto it too, and makes the stretch an omvei; further off, it's an avstikker.
export const ALTERNATIVE_SNAP_M = START_SNAP_M

// The nearest point on the route to `ll`, and how far off it is
export const nearestOnRoute = (ll, route) => nearestOnNetwork(ll, [route.latLngs])

// The drawn points with their ends put on the route where they reach it, and the kind that makes
// (null until there are two points). The database reads the kind from the ends the same way.
export const placeAlternative = (points, route) => {
  if (points.length < 2) return { points, kind: null }
  const out = [...points]
  const first = nearestOnRoute(out[0], route)
  if (first && first.distM <= ALTERNATIVE_SNAP_M) out[0] = first.ll
  const last = nearestOnRoute(out[out.length - 1], route)
  if (last && last.distM <= ALTERNATIVE_SNAP_M) {
    out[out.length - 1] = last.ll
    return { points: out, kind: 'omvei' }
  }
  return { points: out, kind: 'avstikker' }
}

export const alternativeName = (route, alt) => alt.label || `Strekning ${route.alternatives.indexOf(alt) + 1}`

// The variants (not Standard) that use a stretch
export const variantsUsing = (route, alternativeId) => route.variants.filter((v) => v.id && v.alternativeIds.includes(alternativeId))

export const missingAlternativeFields = (draft) => (draft.points.length < 2 ? ['strekning i kartet (minst 2 punkter)'] : [])

export const missingVariantFields = (draft) => {
  const missing = []
  if (!draft.name.trim()) missing.push('navn')
  if (!draft.alternativeIds.length) missing.push('minst én strekning')
  return missing
}

export const saveAlternative = async (original, draft, route) => {
  const payload = {
    route_id: Number(route.id),
    label: draft.label.trim() || null,
    geom: pointsToLineGeometry(placeAlternative(draft.points, route).points),
  }
  if (!original) {
    const { data, error } = await supabase.from('route_alternatives').insert(payload).select('id').single()
    if (error) throw error
    return String(data.id)
  }
  const { error } = await supabase.from('route_alternatives').update(payload).eq('id', original.id)
  if (error) throw error
  return original.id
}

// Variants that used it lose it with it (ON DELETE CASCADE)
export const deleteAlternative = async (alt) => {
  const { error } = await supabase.from('route_alternatives').delete().eq('id', alt.id)
  if (error) throw error
}

// The variant and its stretches in one transaction (save_route_variant); returns its id
export const saveVariant = async (original, draft, route) => {
  const { data, error } = await supabase.rpc('save_route_variant', {
    variant_id: original ? Number(original.id) : null,
    route_id: Number(route.id),
    name: draft.name.trim(),
    difficulty: draft.difficulty || null,
    climb: draft.climb.trim() || null,
    description: draft.desc.trim() || null,
    alternative_ids: draft.alternativeIds.map(Number),
  })
  if (error) throw error
  return String(data)
}

export const deleteVariant = async (variant) => {
  const { error } = await supabase.from('route_variants').delete().eq('id', variant.id)
  if (error) throw error
}

// Moves a variant one place up (-1) or down (+1) among the route's variants, numbering them all anew
export const moveVariant = async (route, variantId, step) => {
  const ids = route.variants.filter((v) => v.id).map((v) => v.id)
  const i = ids.indexOf(variantId)
  const j = i + step
  if (i < 0 || j < 0 || j >= ids.length) return
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  const results = await Promise.all(ids.map((id, n) => supabase.from('route_variants').update({ sort_order: n + 1 }).eq('id', id)))
  const failed = results.find((r) => r.error)
  if (failed) throw failed.error
}

// Length and line of a set of stretches before it's saved, from the same database function the views
// use. `skipped` > 0: the stretches overlap.
export const previewVariant = async (route, alternativeIds) => {
  const { data, error } = await supabase.rpc('route_variant_preview', {
    route_id: Number(route.id),
    alternative_ids: alternativeIds.map(Number),
  })
  if (error) throw error
  return { km: data?.km || 0, latLngs: toLatLngLine(data?.geometry), skipped: data?.skipped || 0 }
}

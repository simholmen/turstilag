import { supabase } from '../lib/supabase'
import { copyImages, deleteImages } from '../lib/images'
import {
  distanceM, geometryIntersectsPolygon, pointsToLineGeometry, pointsToPolygonGeometry, toLatLngs, toPoint,
} from './geometry'
import fence from 'lucide-static/icons/fence.svg?raw'
import bridge from 'lucide-static/icons/bridge.svg?raw'
import mapIcon from 'lucide-static/icons/map.svg?raw'
import armchair from 'lucide-static/icons/armchair.svg?raw'
import squareParking from 'lucide-static/icons/square-parking.svg?raw'
import ellipsis from 'lucide-static/icons/ellipsis.svg?raw'

// Drop the license comment so the markup can be inlined anywhere
const svg = (raw) => raw.slice(raw.indexOf('<svg'))

// Point kinds, in design order. `gjerdeklyver` lives in its own table, everything else in
// other_points.kind. benk's blue is the same as the old drenering type's — that type is now a
// tilrettelegging subtype, so the two never show side by side. Don't "fix" it.
export const TYPES = {
  gjerdeklyver: { label: 'Kryssningspunkt', plural: 'Kryssningspunkter', color: '#b4532a', icon: svg(fence) },
  tilrettelegging: { label: 'Tilrettelegging', plural: 'Tilrettelegginger', color: '#6b5a45', icon: svg(bridge) },
  turinfo: { label: 'Turinfo', plural: 'Turinfo', color: '#6a4f8c', icon: svg(mapIcon) },
  benk: { label: 'Benk', plural: 'Benker', color: '#2c6e8a', icon: svg(armchair) },
  parkering: { label: 'Parkering', plural: 'Parkeringsplasser', color: '#1f4f8a', icon: svg(squareParking) },
  // Also where rows with an unknown kind end up (e.g. old 'poi', 'trail', 'merking')
  annet: { label: 'Annet', plural: 'Annet', color: '#5b6259', icon: svg(ellipsis) },
}

// kind -> subtype -> { label, about }. `about` feeds the "Om <undertype>" box and is omitted when empty.
export const SUBTYPES = {
  gjerdeklyver: {
    turstitrapp: { label: 'Turstitrapp', about: 'Bred trapp med rekkverk over gjerdet eller steingarden.' },
    turstiport: { label: 'Turstiport', about: 'Selvlukkende port i gjerdet – ingen klatring. Egner seg for barnevogn, hund og de som ikke vil over en stige.' },
    hundeluke: { label: 'Hundeluke', about: 'Egen luke i gjerdet, så hunden slipper å løftes over.' },
    // Named per entry (subtypeOther), so there is no shared copy
    annen: { label: 'Annen type', about: '' },
  },
  tilrettelegging: {
    bru: { label: 'Bru', about: 'Bru over bekk eller elv.' },
    klopp: { label: 'Klopp', about: 'Planker lagt over vått parti. Kan være glatt i regnvær.' },
    trapp: { label: 'Trapp', about: 'Trinn i bratt terreng.' },
    rekkverk: { label: 'Rekkverk', about: 'Kjetting eller rekkverk å holde seg i der det er bratt eller glatt.' },
    steinsetting: { label: 'Steinsetting', about: 'Stein lagt ut som fast dekke i vått eller slitt terreng.' },
    // Carried over from the old worklog types, no design copy
    drenering: { label: 'Drenering', about: '' },
    grus: { label: 'Grus', about: '' },
    treflis: { label: 'Treflis', about: '' },
    underlag: { label: 'Underlag', about: '' },
  },
}

// Extra fields shown only for some kinds (gated on kind, not subtype)
export const CONDITIONAL_FIELDS = { parkering: ['plasser'], gjerdeklyver: ['hund'] }

export const hasField = (kind, field) => Boolean(CONDITIONAL_FIELDS[kind]?.includes(field))

export const hasSubtypes = (kind) => Boolean(SUBTYPES[kind])

export const subtypeLabel = (kind, subtype) => (subtype ? SUBTYPES[kind]?.[subtype]?.label : undefined)

export const subtypeAbout = (kind, subtype) => (subtype ? SUBTYPES[kind]?.[subtype]?.about : undefined)

// A subtype only survives if it belongs to the kind — the database CHECK rejects anything else
export const validSubtype = (kind, subtype) => (subtype && SUBTYPES[kind]?.[subtype] ? subtype : null)

// The free-text subtype: choosing it requires a name (subtypeOther) and a description
export const OTHER_SUBTYPE = 'annen'

// Kinds where several subtypes can apply at once, e.g. a turstitrapp with a hundeluke. Stored as
// gjerdeklyvere.subtypes (text[]); every other kind has a single other_points.subtype.
const MULTI_SUBTYPE_KINDS = ['gjerdeklyver']

export const isMultiSubtype = (kind) => MULTI_SUBTYPE_KINDS.includes(kind)

// The subtypes that belong to the kind, in SUBTYPES order. Single-subtype kinds keep at most one.
export const validSubtypes = (kind, subtypes) => {
  const list = Object.keys(SUBTYPES[kind] || {}).filter((key) => (subtypes || []).includes(key))
  return isMultiSubtype(kind) ? list : list.slice(0, 1)
}

export const hasOtherSubtype = (subtypes) => Boolean(subtypes?.includes(OTHER_SUBTYPE))

// "Turstitrapp, Hundeluke". Annen type shows its typed-out name when there is one.
export const subtypesLabel = (kind, subtypes, other) => (subtypes || [])
  .map((s) => (s === OTHER_SUBTYPE && other ? other : subtypeLabel(kind, s)))
  .filter(Boolean)
  .join(', ')

export const entrySubtypeLabel = (entry) => subtypesLabel(entry.type, entry.subtypes, entry.subtypeOther)

// Which geometry each kind may have. Enforced in the database (other_points_geom_kind_chk).
export const GEOM_BY_KIND = {
  tilrettelegging: ['point', 'line', 'poly'],
  annet: ['point', 'line', 'poly'],
  // gjerdeklyver, turinfo, benk, parkering fall through to the default
}
export const DEFAULT_GEOM = ['point']

// Preselected drawing tool, overridable in the form. Not a constraint: a bru can be either.
export const DEFAULT_GEOM_BY_SUBTYPE = {
  klopp: 'line', rekkverk: 'line', drenering: 'line', grus: 'line', treflis: 'line', underlag: 'line',
  steinsetting: 'poly',
  bru: 'point', trapp: 'point',
}

export const GEOM_LABELS = { point: 'Punkt', line: 'Linje', poly: 'Flate' }
export const GEOM_MIN = { point: 1, line: 2, poly: 3 }

export const allowedGeoms = (kind) => GEOM_BY_KIND[kind] || DEFAULT_GEOM

export const defaultGeom = (kind, subtype) => {
  const allowed = allowedGeoms(kind)
  const preferred = DEFAULT_GEOM_BY_SUBTYPE[subtype]
  return preferred && allowed.includes(preferred) ? preferred : allowed[0]
}

const GEOM_TYPES = { POINT: 'point', LINESTRING: 'line', POLYGON: 'poly' }

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

export const formatDate = (date) => {
  if (!date) return 'Dato ukjent'
  const [y, m, d] = date.split('-')
  return `${Number(d)}. ${MONTHS[m - 1]} ${y}`
}

// Norwegian number formatting: decimal comma, 1 decimal under 10 km
export const fmtKm = (km) => km.toFixed(km < 10 ? 1 : 0).replace('.', ',')

export const fmtDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${fmtKm(m / 1000)} km`)

export const fmtArea = (m2) => (m2 < 1000
  ? `ca. ${Math.round(m2 / 10) * 10} m²`
  : `ca. ${(m2 / 1000).toFixed(m2 < 10000 ? 1 : 0).replace('.', ',').replace(/,0$/, '')} daa`)

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

// "Etter type": one group per kind that has entries, in TYPES order
export const groupEntriesByType = (entries) => Object.keys(TYPES)
  .map((key) => ({ key, ...TYPES[key], entries: entries.filter((e) => e.type === key) }))
  .filter((group) => group.entries.length > 0)

// "Nærmest meg": every entry with its distance in metres, nearest first
export const sortEntriesByDistance = (entries, from) => entries
  .filter((e) => e.ll)
  .map((e) => ({ ...e, dist: distanceM(from, e.ll) }))
  .sort((a, b) => a.dist - b.dist)

export const tableForType = (type) => (type === 'gjerdeklyver' ? 'gjerdeklyvere' : 'other_points')

const entryKey = (table, id) => `${table}:${id}`

// GeoJSON is [lng, lat], Leaflet is [lat, lng]
const toLatLng = (point) => (point?.type === 'Point' && point.coordinates ? [point.coordinates[1], point.coordinates[0]] : null)

// Used until the hub_location migration has run and the view returns `location`
const polygonCenter = (geometry) => {
  const coords = geometry?.type === 'Polygon'
    ? geometry.coordinates[0]
    : geometry?.type === 'MultiPolygon' ? geometry.coordinates[0]?.[0] : null
  if (!coords?.length) return null
  const [sumLng, sumLat] = coords.reduce(([x, y], [lng, lat]) => [x + lng, y + lat], [0, 0])
  return [sumLat / coords.length, sumLng / coords.length]
}

export const entryType = (row) => {
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

export const rowToEntry = (row, area) => {
  // A few legacy gjerdeklyvere live in other_points, so the view says where a row actually is
  const table = row.source_table || tableForType(row.kind)
  const type = entryType(row)
  const geomType = GEOM_TYPES[row.geom_type] || 'point'
  return {
    key: entryKey(table, row.id),
    id: row.id,
    table,
    area: area?.id ?? null,
    type,
    subtypes: validSubtypes(type, row.subtypes),
    subtypeOther: row.subtype_other || '',
    hund: row.hund || '',
    plasser: row.plasser || '',
    legacyKind: row.legacy_kind || null,
    title: row.title,
    date: row.last_updated,
    desc: row.description || '',
    images: row.images || [],
    geomType,
    ll: toLatLng(row.anchor) || toLatLng(row.geometry),
    latLngs: toLatLngs(row.geometry),
    lengthM: row.length_m || 0,
    areaM2: row.area_m2 || 0,
    updatedAt: row.updated_at,
  }
}

// Entries without a hub_id are matched to the area whose polygon contains them
const findArea = (row, areas) => (
  areas.find((a) => row.feature_group && a.slug === row.feature_group)
  || areas.find((a) => a.polygon && geometryIntersectsPolygon(row.geometry, a.polygon))
)

export const loadWorklog = async () => {
  const { data, error } = await supabase.from('all_features_geojson').select('*')
  if (error) throw error

  const rows = data || []
  const areas = rows.filter((row) => row.kind === 'hub').map(rowToArea).filter((a) => a.ll)
  // Lines and areas load too — they carry a view-computed anchor for their marker
  const entries = rows
    .filter((row) => row.kind !== 'hub' && row.geometry)
    .map((row) => rowToEntry(row, findArea(row, areas)))
    .filter((e) => e.area && e.ll)

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

// Point-only kinds always save a point, whatever the draft carried
export const entryGeomType = (draft) => (allowedGeoms(draft.type).includes(draft.geomType) ? draft.geomType : 'point')

export const entryGeometry = (draft) => {
  const geomType = entryGeomType(draft)
  if (geomType === 'line') return pointsToLineGeometry(draft.points)
  if (geomType === 'poly') return pointsToPolygonGeometry(draft.points)
  return toPoint(draft.ll)
}

// Returns the key of the saved entry. Changing to or from gjerdeklyver moves the row between tables.
export const saveEntry = async (original, draft) => {
  const table = tableForType(draft.type)
  // A duplicate still points at the source entry's files (draft.sharedImages) until it's saved,
  // then gets copies of its own. Copying here, not on duplicate, leaves nothing behind on cancel.
  const shared = draft.sharedImages || []
  const copies = await copyImages(draft.images.filter((img) => shared.includes(img)))
  const images = draft.images.map((img) => (shared.includes(img) ? copies.shift() : img))
  const payload = {
    title: draft.title.trim(),
    description: draft.desc.trim() || null,
    last_updated: draft.date || null,
    images,
    geom: entryGeometry(draft),
    hub_id: Number(draft.area),
  }
  const subtypes = validSubtypes(draft.type, draft.subtypes)
  // Only send columns the target table has: subtypes/subtype_other/hund are gjerdeklyvere-only,
  // subtype/kind/plasser other_points-only
  if (table === 'gjerdeklyvere') {
    payload.subtypes = subtypes
    payload.subtype_other = hasOtherSubtype(subtypes) ? draft.subtypeOther.trim() : null
    payload.hund = draft.hund?.trim() || null
  } else {
    payload.subtype = subtypes[0] ?? null
    payload.kind = draft.type
    payload.plasser = hasField(draft.type, 'plasser') ? draft.plasser?.trim() || null : null
  }

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

const GEOM_FIELD = { point: 'plassering', line: 'strekning (minst 2 punkter)', poly: 'omriss (minst 3 punkter)' }

export const missingFields = ({ kind, draft }) => {
  const missing = []
  if (kind === 'entry') {
    if (!draft.area) missing.push('turområde')
    if (!draft.type) missing.push('type')
    if (!draft.title.trim()) missing.push('tittel')
    if (hasOtherSubtype(validSubtypes(draft.type, draft.subtypes))) {
      if (!draft.subtypeOther?.trim()) missing.push('navn på annen type')
      if (!draft.desc.trim()) missing.push('beskrivelse')
    }
    const geomType = draft.type ? entryGeomType(draft) : 'point'
    if (geomType === 'point' ? !draft.ll : (draft.points || []).length < GEOM_MIN[geomType]) missing.push(GEOM_FIELD[geomType])
    return missing
  }
  if (!draft.name.trim()) missing.push('navn')
  if (!draft.ll) missing.push('plassering')
  return missing
}

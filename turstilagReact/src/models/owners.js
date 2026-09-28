import { supabase } from '../lib/supabase'
import { byDateDesc } from './worklog'

// Owner colors default to a small rotation so new owners are visually distinct on the map
export const OWNER_COLORS = ['#2f7f7a', '#a4486e', '#4a5f9e', '#7d8a2e', '#8a5a3c', '#b4532a', '#2c6e8a', '#6a4f8c']

export const withAlpha = (hex, alpha = '2e') => `${hex}${alpha}`

export const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

export const daaText = (daa) => Math.round(daa).toLocaleString('nb-NO')

const toLatLng = ([lng, lat]) => [lat, lng]

// Flattens Polygon/MultiPolygon rings into Leaflet-ready [lat,lng] arrays, preserving nesting
// so L.polygon can render either shape directly.
const toLatLngRings = (geometry) => {
  if (!geometry) return []
  if (geometry.type === 'Polygon') return geometry.coordinates.map((ring) => ring.map(toLatLng))
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.map((poly) => poly.map((ring) => ring.map(toLatLng)))
  return []
}

const ringsOf = (geometry) => {
  if (!geometry) return []
  if (geometry.type === 'Polygon') return geometry.coordinates
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat()
  return []
}

const centroid = (geometry) => {
  const ring = ringsOf(geometry)[0]
  if (!ring?.length) return null
  const [sumLng, sumLat] = ring.reduce(([x, y], [lng, lat]) => [x + lng, y + lat], [0, 0])
  return [sumLat / ring.length, sumLng / ring.length]
}

// Ray-casting point-in-polygon, GeoJSON [lng, lat] order
const pointInRing = ([x, y], ring) => {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

export const pointInGeometry = (lngLat, geometry) => ringsOf(geometry).some((ring) => pointInRing(lngLat, ring))

const rowToOwner = (row, hubIds = []) => ({
  id: String(row.id),
  name: row.name,
  hubIds,
  color: row.color,
  fill: withAlpha(row.color),
  contact: row.contact_name || '',
  phone: row.phone || '',
  email: row.email || '',
  note: row.note || '',
})

const rowToParcel = (row) => ({
  id: String(row.id),
  ownerId: String(row.owner_id),
  teig: row.teig,
  daa: row.daa || 0,
  geometry: row.geometry,
  latLngRings: toLatLngRings(row.geometry),
  center: centroid(row.geometry),
})

export const loadOwnersAndParcels = async () => {
  const [
    { data: ownerRows, error: ownerError },
    { data: parcelRows, error: parcelError },
    { data: ownerHubRows, error: ownerHubError },
  ] = await Promise.all([
    supabase.from('owners').select('*'),
    supabase.from('parcels_geojson').select('*'),
    supabase.from('owner_hubs').select('*'),
  ])
  if (ownerError) throw ownerError
  if (parcelError) throw parcelError
  if (ownerHubError) throw ownerHubError

  const hubIdsByOwner = {}
  ;(ownerHubRows || []).forEach((row) => {
    const key = String(row.owner_id)
    if (!hubIdsByOwner[key]) hubIdsByOwner[key] = []
    hubIdsByOwner[key].push(String(row.hub_id))
  })

  return {
    owners: (ownerRows || []).map((row) => rowToOwner(row, hubIdsByOwner[String(row.id)] || [])),
    parcels: (parcelRows || []).map(rowToParcel),
  }
}

// Owners belonging to a given turområde, for the area detail's "Grunneiere" section —
// each with their parcels and combined daa.
export const ownersForArea = (owners, parcels, areaId) => owners
  .filter((owner) => owner.hubIds.includes(areaId))
  .map((owner) => {
    const ownerParcels = parcels.filter((p) => p.ownerId === owner.id)
    return { ...owner, parcels: ownerParcels, daa: ownerParcels.reduce((sum, p) => sum + p.daa, 0) }
  })

// Adds the per-owner numbers shown in the owner detail view: their parcels, total area,
// and the work entries whose point falls inside one of those parcels.
export const buildOwnerViews = (owners, parcels, entries) => owners.map((owner) => {
  const ownerParcels = parcels.filter((p) => p.ownerId === owner.id)
  const daa = ownerParcels.reduce((sum, p) => sum + p.daa, 0)
  const list = entries
    .filter((e) => e.ll && ownerParcels.some((p) => pointInGeometry([e.ll[1], e.ll[0]], p.geometry)))
    .sort(byDateDesc)

  return { ...owner, parcels: ownerParcels, daa, list, count: list.length }
})

// Owners and their areas are a many-to-many join table, so it's synced as a separate
// delete-then-insert step rather than a column on the owners row.
const syncOwnerHubs = async (ownerId, hubIds) => {
  const { error: deleteError } = await supabase.from('owner_hubs').delete().eq('owner_id', ownerId)
  if (deleteError) throw deleteError
  if (hubIds.length === 0) return

  const { error: insertError } = await supabase.from('owner_hubs').insert(hubIds.map((hubId) => ({ owner_id: ownerId, hub_id: Number(hubId) })))
  if (insertError) throw insertError
}

export const saveOwner = async (original, draft) => {
  const payload = {
    name: draft.name.trim(),
    color: draft.color,
    contact_name: draft.contact.trim() || null,
    phone: draft.phone.trim() || null,
    email: draft.email.trim() || null,
    note: draft.note.trim() || null,
  }

  let id
  if (!original) {
    const { data, error } = await supabase.from('owners').insert(payload).select('id').single()
    if (error) throw error
    id = String(data.id)
  } else {
    const { error } = await supabase.from('owners').update(payload).eq('id', original.id)
    if (error) throw error
    id = original.id
  }

  await syncOwnerHubs(id, draft.hubIds || [])
  return id
}

export const deleteOwner = async (owner) => {
  const { error } = await supabase.from('owners').delete().eq('id', owner.id)
  if (error) throw error
}

// `points` is the drawn ring as [lat, lng] pairs in click order (at least 3, not closed)
export const pointsToGeometry = (points) => {
  const ring = points.map(([lat, lng]) => [lng, lat])
  ring.push(ring[0])
  return { type: 'MultiPolygon', coordinates: [[ring]] }
}

export const saveParcel = async (original, draft) => {
  const payload = {
    owner_id: Number(draft.ownerId),
    teig: Number(draft.teig) || 1,
    geom: pointsToGeometry(draft.points),
  }

  if (!original) {
    const { data, error } = await supabase.from('parcels').insert(payload).select('id').single()
    if (error) throw error
    return String(data.id)
  }

  const { error } = await supabase.from('parcels').update(payload).eq('id', original.id)
  if (error) throw error
  return original.id
}

export const deleteParcel = async (parcel) => {
  const { error } = await supabase.from('parcels').delete().eq('id', parcel.id)
  if (error) throw error
}

export const missingOwnerFields = (draft) => (draft.name.trim() ? [] : ['navn'])

export const missingParcelFields = (draft) => {
  const missing = []
  if (!draft.ownerId) missing.push('grunneier')
  if (!draft.points || draft.points.length < 3) missing.push('eiendomsgrense (minst 3 punkter)')
  return missing
}

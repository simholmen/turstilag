import { supabase } from '../lib/supabase'

// Canonical read source: keep frontend feature loading on one view to avoid overlap/duplicates.
const FEATURE_VIEW_TABLE = 'all_features_geojson'
const FEATURE_KIND_TABLES = {
  hub: 'hubs',
  gjerdeklyver: 'gjerdeklyvere',
  poi: 'other_points',
  trail: 'other_points',
}

const POINT_TABLES = new Set(['gjerdeklyvere', 'other_points'])

const normalizeImages = (images) => (Array.isArray(images) ? images.filter(Boolean) : [])
const normalizeKey = (value) => (value === null || value === undefined ? null : String(value).trim().toLowerCase())

export const getFeatureIdentityKey = (feature) => {
  const properties = feature?.properties || {}
  const geometry = feature?.geometry ? JSON.stringify(feature.geometry) : ''
  const kind = normalizeKey(properties.kind) || 'unknown'
  const id = normalizeKey(properties.id)
  const slug = normalizeKey(properties.slug)
  const title = normalizeKey(properties.title)
  const group = normalizeKey(properties.group)

  // Use geometry before group so distinct points in the same group don't collapse.
  return [kind, id || slug || title || geometry || group || 'unknown'].join('::')
}

export const dedupeFeatures = (features = []) => {
  const seen = new Set()

  return features.filter((feature) => {
    const key = getFeatureIdentityKey(feature)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export const getFeatureRelationKeys = (feature) => {
  const properties = feature?.properties || {}
  const keys = [
    properties.hubId,
    properties.group,
    properties.slug,
    properties.title,
    properties.id,
  ]

  return keys.map(normalizeKey).filter(Boolean)
}

const pointInRing = (point, ring) => {
  const [x, y] = point
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersect = ((yi > y) !== (yj > y))
      && (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi)

    if (intersect) inside = !inside
  }

  return inside
}

const pointInPolygon = (point, polygonCoordinates = []) => polygonCoordinates.some((ring) => pointInRing(point, ring))

const coordinatesToPoints = (geometry) => {
  if (!geometry) return []
  if (geometry.type === 'Point') return [geometry.coordinates]
  if (geometry.type === 'LineString') return geometry.coordinates
  if (geometry.type === 'Polygon') return geometry.coordinates.flat()
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat(2)
  if (geometry.type === 'MultiLineString') return geometry.coordinates.flat()
  return []
}

const geometryIntersectsPolygon = (geometry, polygonGeometry) => {
  if (!geometry || !polygonGeometry) return false

  const polygonCoordinates = polygonGeometry.type === 'Polygon'
    ? polygonGeometry.coordinates
    : polygonGeometry.type === 'MultiPolygon'
      ? polygonGeometry.coordinates.flat()
      : []

  if (!polygonCoordinates.length) return false

  if (geometry.type === 'Point') {
    return pointInPolygon(geometry.coordinates, polygonCoordinates)
  }

  const lineSegments = geometry.type === 'LineString'
    ? geometry.coordinates.map((point, index, points) => [point, points[index + 1]]).filter(([start, end]) => start && end)
    : []

  const points = coordinatesToPoints(geometry)
  if (points.some((point) => pointInPolygon(point, polygonCoordinates))) return true

  if (lineSegments.length === 0) return false

  const polygonEdges = polygonCoordinates.flatMap((ring) => ring.map((point, index, points) => [point, points[index + 1] ?? points[0]]).filter(([start, end]) => start && end))

  const segmentsIntersect = (segmentA, segmentB) => {
    const [[ax1, ay1], [ax2, ay2]] = segmentA
    const [[bx1, by1], [bx2, by2]] = segmentB

    const orientation = (p, q, r) => Math.sign((q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1]))
    const onSegment = (p, q, r) => (
      Math.min(p[0], r[0]) <= q[0] && q[0] <= Math.max(p[0], r[0]) &&
      Math.min(p[1], r[1]) <= q[1] && q[1] <= Math.max(p[1], r[1])
    )

    const p1 = [ax1, ay1]
    const q1 = [ax2, ay2]
    const p2 = [bx1, by1]
    const q2 = [bx2, by2]

    const o1 = orientation(p1, q1, p2)
    const o2 = orientation(p1, q1, q2)
    const o3 = orientation(p2, q2, p1)
    const o4 = orientation(p2, q2, q1)

    if (o1 !== o2 && o3 !== o4) return true
    if (o1 === 0 && onSegment(p1, p2, q1)) return true
    if (o2 === 0 && onSegment(p1, q2, q1)) return true
    if (o3 === 0 && onSegment(p2, p1, q2)) return true
    if (o4 === 0 && onSegment(p2, q1, q2)) return true
    return false
  }

  return lineSegments.some((lineSegment) => polygonEdges.some((polygonEdge) => segmentsIntersect(lineSegment, polygonEdge)))
}

export const featureMatchesHub = (hubFeature, candidateFeature) => {
  if (!hubFeature || !candidateFeature) return false

  const hubId = normalizeKey(hubFeature.properties?.id)
  const candidateHubId = normalizeKey(candidateFeature.properties?.hubId)

  if (hubId && candidateHubId && hubId === candidateHubId) return true

  const hubKeys = new Set(getFeatureRelationKeys(hubFeature))
  const candidateKeys = getFeatureRelationKeys(candidateFeature)

  if (candidateKeys.some((key) => hubKeys.has(key))) return true

  const hubGeometry = hubFeature.geometry
  const candidateGeometry = candidateFeature.geometry

  if (!hubGeometry || !candidateGeometry) return false
  if (hubGeometry.type !== 'Polygon' && hubGeometry.type !== 'MultiPolygon') return false
  if (candidateFeature.properties?.kind === 'hub') return false

  return geometryIntersectsPolygon(candidateGeometry, hubGeometry)
}

export const rowToFeature = (row) => {
  const geometry = row.geometry ?? row.geom ?? null
  const kind = (row.kind || row._featureKind || '').toLowerCase()
  const icon = typeof row.icon === 'string' ? row.icon.trim() : row.icon
  const normalizedIcon = icon === 'invisible' ? '' : icon
  const group = kind === 'hub'
    ? row.slug ?? row.feature_group ?? row.group ?? row.group_id ?? row.hub_id ?? null
    : row.feature_group ?? row.group ?? row.group_id ?? row.hub_id ?? row.slug ?? null
  const isPointKind = kind === 'poi' || kind === 'gjerdeklyver'
  const isInvisible = row.no_marker ?? row.noMarker ?? row.nomarker ?? icon === 'invisible' ?? false

  return {
    type: 'Feature',
    geometry,
    properties: {
      id: row.id,
      hubId: row.hub_id ?? null,
      slug: row.slug,
      title: row.title,
      kind,
      group,
      noMarker: isInvisible || (isPointKind && !normalizedIcon),
      icon: normalizedIcon,
      popup: row.popup,
      description: row.description,
      includes: row.includes,
      difficulty: row.difficulty,
      lastUpdated: row.last_updated ?? null,
      images: normalizeImages(row.images),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      color: row.color,
    },
  }
}

export const mapRowsToFeatures = (rows = []) => (
  rows
    .filter((row) => row.geometry ?? row.geom)
    .map(rowToFeature)
)

export const loadFeatures = async () => {
  const { data, error } = await supabase.from(FEATURE_VIEW_TABLE).select('*')

  if (error) throw error

  const rows = (data || []).map((row) => ({
    ...row,
    _featureKind: row.kind || 'trail',
  }))

  return dedupeFeatures(mapRowsToFeatures(rows))
}

const getImagesForPayload = (feature, form) => {
  const formImages = typeof form?.imagesText === 'string'
    ? form.imagesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : []

  if (formImages.length > 0) return formImages

  const existingImages = normalizeImages(feature?.properties?.images)
  if (existingImages.length > 0) return existingImages

  return ['/assets/yggenprofil.jpg']
}

const findHubIdByColumn = async (column, value) => {
  const { data, error } = await supabase
    .from('hubs')
    .select('id')
    .ilike(column, value)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}

const resolveHubId = async (group) => {
  if (!group) return null

  const byName = await findHubIdByColumn('name', group)
  if (byName) return byName

  const byTitle = await findHubIdByColumn('title', group)
  if (byTitle) return byTitle

  throw new Error(`Fant ikke hub for gruppen "${group}". Velg en eksisterende hub før du lagrer gjerdeklyveren.`)
}

const buildHubPayload = (feature, form) => ({
  name: form.slug.trim(),
  title: form.title.trim(),
  description: form.description.trim() || null,
  popup: form.popup.trim() || null,
  includes: form.includes.trim() || null,
  difficulty: form.difficulty.trim() || null,
  last_updated: form.lastUpdated.trim() || null,
  images: getImagesForPayload(feature, form),
  color: form.color.trim() || null,
  geom: feature.geometry,
})

const buildPointPayload = async (feature, form, kind) => {
  const hubId = await resolveHubId(form.group.trim())

  if (kind === 'gjerdeklyver' && !hubId) {
    throw new Error('Velg en eksisterende hub før du lagrer en gjerdeklyver.')
  }

  const payload = {
    title: form.title.trim(),
    icon: form.icon.trim() || null,
    popup: form.popup.trim() || null,
    description: form.description.trim() || null,
    includes: form.includes.trim() || null,
    difficulty: form.difficulty.trim() || null,
    last_updated: form.lastUpdated.trim() || null,
    images: getImagesForPayload(feature, form),
    color: form.color.trim() || null,
    geom: feature.geometry,
    hub_id: hubId,
  }

  if (kind === 'poi') {
    payload.kind = kind
  }

  return payload
}

const buildTrailPayload = async (feature, form) => ({
  slug: form.slug.trim() || null,
  title: form.title.trim(),
  kind: form.kind.trim() || 'trail',
  icon: form.icon.trim() || null,
  popup: form.popup.trim() || null,
  description: form.description.trim() || null,
  includes: form.includes.trim() || null,
  difficulty: form.difficulty.trim() || null,
  last_updated: form.lastUpdated.trim() || null,
  images: getImagesForPayload(feature, form),
  color: form.color.trim() || null,
  geom: feature.geometry,
  hub_id: await resolveHubId(form.group.trim()),
})

const buildPayloadForKind = async (feature, form, kind) => {
  if (kind === 'hub') return { table: 'hubs', payload: buildHubPayload(feature, form) }
  if (kind === 'gjerdeklyver' || kind === 'poi') {
    return { table: FEATURE_KIND_TABLES[kind], payload: await buildPointPayload(feature, form, kind) }
  }
  if (kind === 'trail') return { table: FEATURE_KIND_TABLES.trail, payload: await buildTrailPayload(feature, form) }

  throw new Error(`Ukjent objekttype: ${kind}`)
}

const selectInsertedRow = async (table, payload) => {
  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select('*')
    .single()

  if (error) throw error
  return rowToFeature(data)
}

const updateExistingRow = async (table, id, payload) => {
  const { data, error } = await supabase
    .from(table)
    .update(payload)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data ? rowToFeature(data) : null
}

export const saveFeature = async (feature, form) => {
  const kind = (form?.kind || feature?.properties?.kind || 'poi').toLowerCase()
  const target = await buildPayloadForKind(feature, form, kind)
  // Enforce correct table for specific kinds to avoid accidental routing
  if (kind === 'gjerdeklyver') {
    target.table = FEATURE_KIND_TABLES['gjerdeklyver'] || target.table
  }
  console.debug('[saveFeature] kind=', kind, '-> table=', target.table)
  const id = feature?.properties?.id
  const currentKind = (feature?.properties?.kind || '').toLowerCase()
  const currentTable = FEATURE_KIND_TABLES[currentKind] || (currentKind === 'trail' ? FEATURE_KIND_TABLES.trail : null)

  if (!id) {
    return selectInsertedRow(target.table, target.payload)
  }

  if (currentTable && currentTable !== target.table) {
    if (POINT_TABLES.has(currentTable) && POINT_TABLES.has(target.table)) {
      throw new Error('Det er ikke støttet å endre mellom gjerdeklyver og vanlige punktobjekter enda. Opprett et nytt objekt i stedet.')
    }

    throw new Error('Objektet må lagres i samme tabell som det ble hentet fra.')
  }

  return updateExistingRow(target.table, id, target.payload)
}
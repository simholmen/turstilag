// Geometry helpers shared by the models. GeoJSON coordinates are [lng, lat]; Leaflet uses [lat, lng].

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

export const geometryIntersectsPolygon = (geometry, polygonGeometry) => {
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

const flip = ([lng, lat]) => [lat, lng]

export const toPoint = ([lat, lng]) => ({ type: 'Point', coordinates: [lng, lat] })

// Leaflet-ready [lat, lng] vertices of a Point (one vertex), LineString, or Polygon (outer ring).
// Anything else — including a missing geometry — gives an empty list rather than a misread.
export const toLatLngs = (geometry) => {
  if (!geometry) return []
  if (geometry.type === 'Point') return geometry.coordinates ? [flip(geometry.coordinates)] : []
  if (geometry.type === 'LineString') return (geometry.coordinates || []).map(flip)
  if (geometry.type === 'Polygon') return (geometry.coordinates?.[0] || []).map(flip)
  return []
}

// `points` are drawn [lat, lng] vertices in click order. A line stays open.
export const pointsToLineGeometry = (points) => ({
  type: 'LineString',
  coordinates: points.map(([lat, lng]) => [lng, lat]),
})

// A polygon ring is closed by repeating the first vertex, unlike a line
export const pointsToPolygonGeometry = (points) => {
  const ring = points.map(([lat, lng]) => [lng, lat])
  ring.push(ring[0])
  return { type: 'Polygon', coordinates: [ring] }
}

// Great-circle distance in metres between two [lat, lng] positions
export const distanceM = ([lat1, lng1], [lat2, lng2]) => {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLng = (lng2 - lng1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Flat metres around `origin` — plenty accurate at trail scale for projecting points onto lines
const planar = ([lat0, lng0]) => {
  const k = Math.cos(lat0 * (Math.PI / 180))
  return ([lat, lng]) => [(lng - lng0) * k * 111320, (lat - lat0) * 111320]
}

// Nearest spot on a planar polyline: segment index, distance from the point, metres along the line
const project = (xy, cum, [px, py]) => {
  let best = null
  for (let i = 0; i < xy.length - 1; i += 1) {
    const [ax, ay] = xy[i]
    const [bx, by] = xy[i + 1]
    const dx = bx - ax
    const dy = by - ay
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0
    const dist = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    if (!best || dist < best.dist) best = { seg: i, dist, along: cum[i] + t * Math.sqrt(len2) }
  }
  return best
}

// Same tolerance as the route_features view (ST_DWithin 15 m)
const SNAP_M = 15

// Display-only: reroutes a [lat, lng] line through the vertices of each stretch lying along it, so a
// route and the klopp/grus/... drawn on it share one path instead of running side by side. A stretch
// is spliced in only when both its ends are within `toleranceM` of the line; overlapping stretches
// keep the first one along the line.
export const snapLineToStretches = (line, stretches, toleranceM = SNAP_M) => {
  if (line.length < 2 || !stretches.length) return line
  const toXY = planar(line[0])
  const xy = line.map(toXY)
  const cum = [0]
  for (let i = 1; i < xy.length; i += 1) cum.push(cum[i - 1] + Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]))

  const splices = stretches
    .filter((s) => s.length >= 2)
    .map((s) => {
      const a = project(xy, cum, toXY(s[0]))
      const b = project(xy, cum, toXY(s.at(-1)))
      if (a.dist > toleranceM || b.dist > toleranceM) return null
      // A stretch whose ends project far apart along the line (e.g. across a rundtur's start/end
      // seam) would cut the route short, so leave it alone
      const sxy = s.map(toXY)
      const stretchM = sxy.slice(1).reduce((sum, p, i) => sum + Math.hypot(p[0] - sxy[i][0], p[1] - sxy[i][1]), 0)
      if (Math.abs(b.along - a.along) > 2 * stretchM + 2 * toleranceM) return null
      return a.along <= b.along ? { from: a, to: b, points: s } : { from: b, to: a, points: [...s].reverse() }
    })
    .filter(Boolean)
    .sort((p, q) => p.from.along - q.from.along)
  if (!splices.length) return line

  const out = [line[0]]
  let cursor = { seg: 0, along: 0 }
  splices.forEach(({ from, to, points }) => {
    if (from.along < cursor.along) return
    for (let i = cursor.seg + 1; i <= from.seg; i += 1) out.push(line[i])
    out.push(...points)
    cursor = to
  })
  for (let i = cursor.seg + 1; i < line.length; i += 1) out.push(line[i])
  return out
}

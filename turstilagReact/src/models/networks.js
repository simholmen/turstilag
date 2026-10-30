import { supabase } from '../lib/supabase'
import { distanceM, pointsToLineGeometry } from './geometry'

// A stinettverk is one object: a name, a turområde and a single line geometry with no start, end or
// length. The database keeps it dissolved — paths added along the network merge into it, and each
// part runs from junction to junction (or to a dead end). Junctions aren't stored; they are where
// three or more parts end.
export const TRAIL_COLOR = '#3b3128'

// Every stretch of a network has a colour and a line type (trail_network_segments), so a tursti can
// turn into a turvei and back. The dashes are for the map and the legend alike.
export const LINE_COLORS = {
  rod: { label: 'Rød', color: '#c8242b' },
  bla: { label: 'Blå', color: '#1f63b4' },
  morkebla: { label: 'Mørkeblå', color: '#1b2a5c' },
}
// Like a topographic map: a vei solid, a turvei in long dashes and a tursti in short ones. Dashes have
// square ends so they read as strokes, not dots.
export const LINE_KINDS = {
  vei: { label: 'Merket vei', dash: null, weight: 4, cap: 'round' },
  turvei: { label: 'Turvei', dash: '14 7', weight: 3.5, cap: 'butt' },
  tursti: { label: 'Merket tursti', dash: '7 5', weight: 3.5, cap: 'butt' },
}
export const DEFAULT_STYLE = { color: 'rod', kind: 'tursti' }

// How a line type is drawn, bottom first: a white halo, then the line in its colour, both in the same
// pattern so each dash gets an edge of its own instead of lying on a white band. The map and
// LineSwatch both draw from this. `extra` thickens a selected network.
export const lineLayers = (kind, extra = 0) => {
  const { dash, weight, cap } = LINE_KINDS[kind] || LINE_KINDS[DEFAULT_STYLE.kind]
  return {
    halo: { weight: weight + 3 + extra, dashArray: dash, lineCap: cap, lineJoin: 'round' },
    line: { weight: weight + extra, dashArray: dash, lineCap: cap, lineJoin: 'round' },
  }
}

// "Legg til sti" starts on the network: the first click must be this close to it, and is moved onto it,
// whatever the festeavstand
export const START_SNAP_M = 25

// The festeavstand (snap distance), set by the admin with a slider and remembered per browser. A vertex
// dragged this close to another part of the network is moved onto it, and the database joins path ends,
// merges overlap and tidies small bits by it (network_with_line, network_tidy). 0 snaps nothing.
export const DEFAULT_SNAP_M = 8
export const MAX_SNAP_M = 20
const SNAP_KEY = 'stinettverk-festeavstand'

const clampSnap = (m) => Math.min(MAX_SNAP_M, Math.max(0, Math.round(m)))

// Storage can be unavailable (private windows, iframes); the default is used then
export const readSnapM = () => {
  try {
    const saved = localStorage.getItem(SNAP_KEY)
    return saved === null || Number.isNaN(Number(saved)) ? DEFAULT_SNAP_M : clampSnap(Number(saved))
  } catch {
    return DEFAULT_SNAP_M
  }
}

export const storeSnapM = (m) => {
  try { localStorage.setItem(SNAP_KEY, String(clampSnap(m))) } catch { /* not remembered */ }
}

const toParts = (geometry) => {
  if (geometry?.type === 'MultiLineString') return geometry.coordinates.map((line) => line.map(([lng, lat]) => [lat, lng]))
  if (geometry?.type === 'LineString') return [geometry.coordinates.map(([lng, lat]) => [lat, lng])]
  return []
}

const rowToSegment = (row) => ({
  color: LINE_COLORS[row.color] ? row.color : DEFAULT_STYLE.color,
  kind: LINE_KINDS[row.kind] ? row.kind : DEFAULT_STYLE.kind,
  line: toParts(row.geometry)[0] || [],
})

// `parts` is the network's line, junction to junction — what kryss and "Fjern en bit" go by. `segments`
// cover the same line in stretches of one style each, for drawing; one can run through a junction.
const rowToNetwork = (row) => ({
  id: String(row.id),
  hubId: row.hub_id ? String(row.hub_id) : null,
  name: row.name,
  desc: row.description || '',
  parts: toParts(row.geometry).filter((p) => p.length >= 2),
  segments: (row.segments || []).map(rowToSegment).filter((s) => s.line.length >= 2),
  updatedAt: row.updated_at,
})

// The network's colour and type where it has one throughout; null for the one that varies
export const networkStyle = (network) => {
  const colors = new Set(network.segments.map((s) => s.color))
  const kinds = new Set(network.segments.map((s) => s.kind))
  return {
    color: colors.size === 1 ? [...colors][0] : null,
    kind: kinds.size === 1 ? [...kinds][0] : null,
  }
}

// The style a new path in the network starts with: its own where uniform, else the default
export const startStyle = (network) => {
  const style = network ? networkStyle(network) : {}
  return { color: style.color || DEFAULT_STYLE.color, kind: style.kind || DEFAULT_STYLE.kind }
}

export const loadNetworks = async () => {
  const { data, error } = await supabase.from('trail_networks_geojson').select('*')
  if (error) throw error
  return (data || []).map(rowToNetwork)
}

export const nodeKey = ([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`

// Every part end, with how many parts end there: 1 is a dead end, 3 or more a junction (kryss). A part
// that closes on itself counts twice at its one node, as a loop should.
export const networkNodes = (parts) => {
  const nodes = new Map()
  parts.forEach((part) => {
    ;[part[0], part[part.length - 1]].forEach((ll) => {
      const key = nodeKey(ll)
      const node = nodes.get(key) || { key, ll, degree: 0 }
      node.degree += 1
      nodes.set(key, node)
    })
  })
  return [...nodes.values()]
}

export const junctionCount = (parts) => networkNodes(parts).filter((n) => n.degree >= 3).length

// The point on segment a–b nearest to p, on a flat projection around p (fine over a few hundred metres),
// and how far along a–b it is (0–1)
const nearestOnSegment = (p, a, b) => {
  const k = Math.cos((p[0] * Math.PI) / 180)
  const ax = (a[1] - p[1]) * k
  const ay = a[0] - p[0]
  const dx = (b[1] - a[1]) * k
  const dy = b[0] - a[0]
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0
  return { q: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], t }
}

// Where on the network `ll` is nearest: the part, the segment of it (from vertex `seg` to `seg + 1`)
// and how far along that segment
const locateOnNetwork = (ll, parts) => {
  let best = null
  parts.forEach((part, i) => {
    for (let j = 1; j < part.length; j += 1) {
      const { q, t } = nearestOnSegment(ll, part[j - 1], part[j])
      const d = distanceM(ll, q)
      if (!best || d < best.distM) best = { part: i, seg: j - 1, t, ll: [Number(q[0].toFixed(6)), Number(q[1].toFixed(6))], distM: d }
    }
  })
  return best
}

// The nearest point on the network to `ll`, anywhere along its lines, and how far away it is
export const nearestOnNetwork = (ll, parts) => {
  const at = locateOnNetwork(ll, parts)
  return at && { ll: at.ll, distM: at.distM }
}

// The way along the network from `from` to `to` (both moved onto it), shortest first — across junctions
// too, so a stretch to restyle can run over several parts. Each part is cut where the two points lie on
// it, the pieces become the edges of a graph of the network's nodes, and Dijkstra finds the way.
export const networkPath = (parts, from, to) => {
  const a = locateOnNetwork(from, parts)
  const b = locateOnNetwork(to, parts)
  if (!a || !b) return null
  const edges = []
  parts.forEach((part, i) => {
    const cuts = [[a, 'A'], [b, 'B']]
      .filter(([p]) => p.part === i)
      .map(([p, key]) => ({ ...p, key, pos: p.seg + p.t }))
      .sort((x, y) => x.pos - y.pos)
    let fromKey = nodeKey(part[0])
    let coords = [part[0]]
    let next = 1
    cuts.forEach((c) => {
      for (; next <= c.seg; next += 1) coords.push(part[next])
      coords.push(c.ll)
      edges.push({ from: fromKey, to: c.key, coords })
      fromKey = c.key
      coords = [c.ll]
      next = c.seg + 1
    })
    for (; next < part.length; next += 1) coords.push(part[next])
    edges.push({ from: fromKey, to: nodeKey(part[part.length - 1]), coords })
  })

  const adjacent = new Map()
  const link = (key, edge) => { if (!adjacent.has(key)) adjacent.set(key, []); adjacent.get(key).push(edge) }
  edges.forEach((e) => {
    const len = partLengthM(e.coords)
    link(e.from, { to: e.to, len, coords: e.coords })
    link(e.to, { to: e.from, len, coords: [...e.coords].reverse() })
  })

  const dist = new Map([['A', 0]])
  const prev = new Map()
  const done = new Set()
  while (!done.has('B')) {
    let key = null
    dist.forEach((d, k) => { if (!done.has(k) && (key === null || d < dist.get(key))) key = k })
    if (key === null) return null
    done.add(key)
    ;(adjacent.get(key) || []).forEach((e) => {
      const d = dist.get(key) + e.len
      if (!dist.has(e.to) || d < dist.get(e.to)) { dist.set(e.to, d); prev.set(e.to, { from: key, coords: e.coords }) }
    })
  }

  const steps = []
  for (let key = 'B'; key !== 'A'; key = prev.get(key).from) steps.unshift(prev.get(key).coords)
  const path = steps.reduce((all, coords) => [...all, ...coords.slice(all.length ? 1 : 0)], [])
  return path.length >= 2 && partLengthM(path) > 0 ? path : null
}

// Length of one part or stretch, shown while choosing one — the network as a whole has none
export const partLengthM = (part) => part.slice(1).reduce((sum, ll, i) => sum + distanceM(part[i], ll), 0)

// Returns the id of the saved network. Only name, turområde and description; paths go through addPath.
export const saveNetwork = async (original, draft) => {
  const payload = {
    name: draft.name.trim(),
    hub_id: draft.hub ? Number(draft.hub) : null,
    description: draft.desc.trim() || null,
  }

  if (!original) {
    const { data, error } = await supabase.from('trail_networks').insert(payload).select('id').single()
    if (error) throw error
    return String(data.id)
  }

  const { error } = await supabase.from('trail_networks').update(payload).eq('id', original.id)
  if (error) throw error
  return original.id
}

// The database trims what overlaps the network and ties the loose ends onto it (add_trail_to_network)
export const addPath = async (networkId, points, snapM = DEFAULT_SNAP_M, style = DEFAULT_STYLE) => {
  const { error } = await supabase.rpc('add_trail_to_network', {
    network_id: Number(networkId),
    line_geojson: pointsToLineGeometry(points),
    snap_m: snapM,
    color: style.color,
    kind: style.kind,
  })
  if (error) throw error
}

// Saves dragged stretches with their styles. The database re-joins them, so a vertex dragged onto
// another line becomes a junction.
export const setNetworkGeometry = async (networkId, segments, snapM = DEFAULT_SNAP_M) => {
  const { error } = await supabase.rpc('set_network_geometry', {
    network_id: Number(networkId),
    snap_m: snapM,
    segments: segments.map((s) => ({ color: s.color, kind: s.kind, coordinates: s.line.map(([lat, lng]) => [lng, lat]) })),
  })
  if (error) throw error
}

// Gives the stretch along `points` (a networkPath) its colour and type
export const setNetworkStyle = async (networkId, points, style) => {
  const { error } = await supabase.rpc('set_network_style', {
    network_id: Number(networkId),
    line_geojson: pointsToLineGeometry(points),
    color: style.color,
    kind: style.kind,
  })
  if (error) throw error
}

// Colour and/or type for the whole network; a null leaves that one as it is per stretch
export const setNetworkStyleAll = async (networkId, style) => {
  const { error } = await supabase.rpc('set_network_style_all', {
    network_id: Number(networkId),
    new_color: style.color,
    new_kind: style.kind,
  })
  if (error) throw error
}

const sameLL = (a, b) => a[0] === b[0] && a[1] === b[1]

// Moves every occurrence of `from` — a junction or a change of style is the same coordinate in each
// line that meets there — to `to`, or onto another line if `to` lands within snapM of one. `parts` is
// any list of lines; the editor passes the stretches' lines.
export const moveNetworkVertex = (parts, from, to, snapM = DEFAULT_SNAP_M) => {
  const others = parts.filter((part) => !part.some((ll) => sameLL(ll, from)))
  const near = nearestOnNetwork(to, others)
  const target = near && near.distM <= snapM ? near.ll : to
  return parts.map((part) => part.map((ll) => (sameLL(ll, from) ? target : ll)))
}

export const insertNetworkVertex = (parts, partIndex, index, ll) => parts.map((part, i) => (
  i === partIndex ? [...part.slice(0, index), ll, ...part.slice(index)] : part
))

// `index` is the part's position in network.parts
export const removePart = async (networkId, index, snapM = DEFAULT_SNAP_M) => {
  const { error } = await supabase.rpc('remove_network_part', { network_id: Number(networkId), part: index + 1, snap_m: snapM })
  if (error) throw error
}

export const deleteNetwork = async (network) => {
  const { error } = await supabase.from('trail_networks').delete().eq('id', network.id)
  if (error) throw error
}

const PATH_FIELD = 'sti (minst 2 punkter)'

export const missingNetworkFields = (edit) => {
  const { kind, id, draft } = edit
  const missing = []
  if (kind === 'network' && !draft.name.trim()) missing.push('navn')
  if ((kind === 'network-path' || (kind === 'network' && !id)) && (draft.points || []).length < 2) missing.push(PATH_FIELD)
  if (kind === 'network-remove' && draft.part == null) missing.push('bit å fjerne')
  if (kind === 'network' && id && draft.segments && !draft.segments.some((s) => s.line.length >= 2)) missing.push(PATH_FIELD)
  if (kind === 'network-style' && (!draft.from || !draft.to)) missing.push('strekning (trykk to steder på nettverket)')
  if (kind === 'network-style' && (!draft.color || !draft.kind)) missing.push('farge og linjetype')
  return missing
}

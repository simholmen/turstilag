import { supabase } from '../lib/supabase'
import { distanceM, pointsToLineGeometry } from './geometry'

// A stinettverk is one object: a name, a turområde and a single line geometry with no start, end or
// length. The database keeps it dissolved — paths added along the network merge into it, and each
// part runs from junction to junction (or to a dead end). Junctions aren't stored; they are where
// three or more parts end.
export const TRAIL_COLOR = '#3b3128'

// "Legg til sti" starts on the network: the first click must be this close to it, and is moved onto it
export const START_SNAP_M = 25
// Later clicks this close to the network are moved onto it, so a path can end where it rejoins
export const END_SNAP_M = 12

const toParts = (geometry) => {
  if (geometry?.type === 'MultiLineString') return geometry.coordinates.map((line) => line.map(([lng, lat]) => [lat, lng]))
  if (geometry?.type === 'LineString') return [geometry.coordinates.map(([lng, lat]) => [lat, lng])]
  return []
}

const rowToNetwork = (row) => ({
  id: String(row.id),
  hubId: row.hub_id ? String(row.hub_id) : null,
  name: row.name,
  desc: row.description || '',
  parts: toParts(row.geometry).filter((p) => p.length >= 2),
  updatedAt: row.updated_at,
})

export const loadNetworks = async () => {
  const { data, error } = await supabase.from('trail_networks_geojson').select('*')
  if (error) throw error
  return (data || []).map(rowToNetwork)
}

const nodeKey = ([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`

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

// The point on segment a–b nearest to p, on a flat projection around p (fine over a few hundred metres)
const nearestOnSegment = (p, a, b) => {
  const k = Math.cos((p[0] * Math.PI) / 180)
  const ax = (a[1] - p[1]) * k
  const ay = a[0] - p[0]
  const dx = (b[1] - a[1]) * k
  const dy = b[0] - a[0]
  const len2 = dx * dx + dy * dy
  const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
}

// The nearest point on the network to `ll`, anywhere along its lines, and how far away it is
export const nearestOnNetwork = (ll, parts) => {
  let best = null
  parts.forEach((part) => {
    for (let i = 1; i < part.length; i += 1) {
      const q = nearestOnSegment(ll, part[i - 1], part[i])
      const d = distanceM(ll, q)
      if (!best || d < best.distM) best = { ll: [Number(q[0].toFixed(6)), Number(q[1].toFixed(6))], distM: d }
    }
  })
  return best
}

// Length of one part, shown when choosing a bit to remove — the network as a whole has none
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
export const addPath = async (networkId, points) => {
  const { error } = await supabase.rpc('add_trail_to_network', {
    network_id: Number(networkId),
    line_geojson: pointsToLineGeometry(points),
  })
  if (error) throw error
}

// Saves dragged lines. The database re-joins them, so a vertex dragged onto another line becomes a junction.
export const setNetworkGeometry = async (networkId, parts) => {
  const { error } = await supabase.rpc('set_network_geometry', {
    network_id: Number(networkId),
    lines_geojson: { type: 'MultiLineString', coordinates: parts.map((part) => part.map(([lat, lng]) => [lng, lat])) },
  })
  if (error) throw error
}

const sameLL = (a, b) => a[0] === b[0] && a[1] === b[1]

// Moves every occurrence of `from` — a junction is the same coordinate in each part that meets there —
// to `to`, or onto another part of the network if `to` lands within END_SNAP_M of one
export const moveNetworkVertex = (parts, from, to) => {
  const others = parts.filter((part) => !part.some((ll) => sameLL(ll, from)))
  const near = nearestOnNetwork(to, others)
  const target = near && near.distM <= END_SNAP_M ? near.ll : to
  return parts.map((part) => part.map((ll) => (sameLL(ll, from) ? target : ll)))
}

export const insertNetworkVertex = (parts, partIndex, index, ll) => parts.map((part, i) => (
  i === partIndex ? [...part.slice(0, index), ll, ...part.slice(index)] : part
))

// `index` is the part's position in network.parts
export const removePart = async (networkId, index) => {
  const { error } = await supabase.rpc('remove_network_part', { network_id: Number(networkId), part: index + 1 })
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
  if (kind === 'network-shape' && !(draft.parts || []).some((p) => p.length >= 2)) missing.push(PATH_FIELD)
  return missing
}

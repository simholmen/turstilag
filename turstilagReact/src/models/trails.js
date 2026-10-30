import { supabase } from '../lib/supabase'
import { distanceM, pointsToLineGeometry } from './geometry'
import { toLatLngLine } from './routes'

// The stinettverk: segments of path that meet at their ends. Junctions aren't stored — a stikryss is
// an end shared by three or more segments, which the editor makes happen by snapping while drawing.
export const TRAIL_COLOR = '#3b3128'

// A clicked vertex within this many metres of an existing segment end or vertex lands on it
export const SNAP_M = 12

const rowToTrail = (row) => ({
  id: String(row.id),
  hubId: row.hub_id ? String(row.hub_id) : null,
  name: row.name || '',
  lengthM: row.length_m || 0,
  latLngs: toLatLngLine(row.geometry),
  updatedAt: row.updated_at,
})

export const trailName = (trail) => trail.name || 'Sti uten navn'

export const loadTrails = async () => {
  const { data, error } = await supabase.from('trail_segments_geojson').select('*')
  if (error) throw error
  return (data || []).map(rowToTrail).filter((t) => t.latLngs.length >= 2)
}

const nodeKey = ([lat, lng]) => `${lat.toFixed(6)},${lng.toFixed(6)}`

// Every segment end, with how many segments end there: 1 is a dead end, 3 or more a stikryss.
// Ends count as the same node only when they are the same coordinate, which snapping ensures.
export const networkNodes = (trails) => {
  const nodes = new Map()
  trails.forEach((t) => {
    ;[t.latLngs[0], t.latLngs[t.latLngs.length - 1]].forEach((ll) => {
      const key = nodeKey(ll)
      const node = nodes.get(key) || { key, ll, degree: 0, trailIds: [] }
      node.degree += 1
      node.trailIds.push(t.id)
      nodes.set(key, node)
    })
  })
  return [...nodes.values()]
}

// Moves `ll` onto the nearest vertex of another segment if one is within SNAP_M, preferring segment
// ends so new paths join the network at its nodes. `excludeId` is the segment being edited.
export const snapToNetwork = (ll, trails, excludeId = null) => {
  let best = null
  let bestScore = Infinity
  trails.forEach((t) => {
    if (t.id === excludeId) return
    const last = t.latLngs.length - 1
    t.latLngs.forEach((v, i) => {
      const d = distanceM(ll, v)
      if (d > SNAP_M) return
      // Ends win over inner vertices at the same distance
      const score = i === 0 || i === last ? d - SNAP_M / 2 : d
      if (score < bestScore) { bestScore = score; best = v }
    })
  })
  return best || ll
}

export const totalKm = (trails) => trails.reduce((sum, t) => sum + t.lengthM, 0) / 1000

export const saveTrail = async (original, draft) => {
  const payload = {
    name: draft.name.trim() || null,
    hub_id: draft.hub ? Number(draft.hub) : null,
    geom: pointsToLineGeometry(draft.points),
  }

  if (!original) {
    const { data, error } = await supabase.from('trail_segments').insert(payload).select('id').single()
    if (error) throw error
    return String(data.id)
  }

  const { error } = await supabase.from('trail_segments').update(payload).eq('id', original.id)
  if (error) throw error
  return original.id
}

export const deleteTrail = async (trail) => {
  const { error } = await supabase.from('trail_segments').delete().eq('id', trail.id)
  if (error) throw error
}

export const missingTrailFields = (draft) => ((draft.points || []).length < 2 ? ['strekning (minst 2 punkter)'] : [])

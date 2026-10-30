import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const {
  DEFAULT_SNAP_M, DEFAULT_STYLE, insertNetworkVertex, junctionCount, networkPath, networkStyle, readSnapM, startStyle, missingNetworkFields, moveNetworkVertex, nearestOnNetwork, networkNodes, partLengthM,
} = await import('./networks')

// A loop with a spur: the loop is one closed part through J, the spur another part from J outwards,
// and a third part J -> K
const J = [58.77, 5.85]
const K = [58.772, 5.85]
const loop = [J, [58.771, 5.852], [58.771, 5.848], J]
const spur = [J, [58.769, 5.85]]
const branch = [J, K]

describe('network nodes', () => {
  it('counts a loop twice at its node, so the loop plus two branches make a junction', () => {
    const nodes = networkNodes([loop, spur, branch])
    expect(nodes.find((n) => n.ll === J).degree).toBe(4)
    expect(junctionCount([loop, spur, branch])).toBe(1)
    expect(nodes.filter((n) => n.degree === 1)).toHaveLength(2)
  })

  it('has no junction for a loop on its own', () => {
    expect(junctionCount([loop])).toBe(0)
  })
})

describe('nearest point on the network', () => {
  it('lands on the line between vertices, not just on a vertex', () => {
    // 3 m east of the middle of J -> K
    const near = nearestOnNetwork([58.771, 5.85005], [branch])
    expect(near.ll).toEqual([58.771, 5.85])
    expect(near.distM).toBeGreaterThan(2)
    expect(near.distM).toBeLessThan(4)
  })

  it('stops at the end of a segment', () => {
    const near = nearestOnNetwork([58.775, 5.85], [branch])
    expect(near.ll).toEqual(K)
  })

  it('finds nothing on an empty network', () => {
    expect(nearestOnNetwork(J, [])).toBeNull()
  })
})

it('measures a part', () => {
  expect(partLengthM(branch)).toBeGreaterThan(220)
  expect(partLengthM(branch)).toBeLessThan(225)
})

describe('missing fields', () => {
  it('needs a name, and a first path for a new network', () => {
    expect(missingNetworkFields({ kind: 'network', id: null, draft: { name: '', points: [] } })).toEqual(['navn', 'sti (minst 2 punkter)'])
    expect(missingNetworkFields({ kind: 'network', id: '1', draft: { name: 'Lima' } })).toEqual([])
  })

  it('needs a path to add, and a part to remove', () => {
    expect(missingNetworkFields({ kind: 'network-path', id: '1', draft: { points: [J] } })).toHaveLength(1)
    expect(missingNetworkFields({ kind: 'network-remove', id: '1', draft: { part: null } })).toEqual(['bit å fjerne'])
    expect(missingNetworkFields({ kind: 'network-remove', id: '1', draft: { part: 0 } })).toEqual([])
  })
})

describe('dragging vertices', () => {
  it('moves a junction in every part that meets there', () => {
    const to = [58.7701, 5.8501]
    const parts = moveNetworkVertex([loop, spur, branch], J, to)
    expect(parts.every((part) => part.some((ll) => ll === to))).toBe(true)
    expect(parts[0][0]).toBe(to)
    expect(parts[0][3]).toBe(to)
  })

  it('snaps a dragged dead end onto another part of the network', () => {
    const end = spur[1]
    // Dragged to 3 m beside the middle of J -> K, which doesn't contain the spur's end
    const parts = moveNetworkVertex([spur, [[58.775, 5.84], [58.775, 5.86]]], end, [58.77503, 5.85])
    expect(parts[0][1]).toEqual([58.775, 5.85])
  })

  it('snaps nothing with festeavstand 0', () => {
    const end = spur[1]
    const to = [58.77503, 5.85]
    const parts = moveNetworkVertex([spur, [[58.775, 5.84], [58.775, 5.86]]], end, to, 0)
    expect(parts[0][1]).toBe(to)
  })

  it('falls back to the default festeavstand without storage', () => {
    expect(readSnapM()).toBe(DEFAULT_SNAP_M)
  })

  it('inserts a vertex into one part only', () => {
    const parts = insertNetworkVertex([spur, branch], 1, 1, [58.771, 5.851])
    expect(parts[0]).toBe(spur)
    expect(parts[1]).toEqual([J, [58.771, 5.851], K])
  })

  it('needs at least one line to save', () => {
    expect(missingNetworkFields({ kind: 'network', id: '1', draft: { name: 'Lima', segments: [{ line: branch }] } })).toEqual([])
    expect(missingNetworkFields({ kind: 'network', id: '1', draft: { name: 'Lima', segments: [] } })).toEqual(['sti (minst 2 punkter)'])
  })
})

describe('the way between two points', () => {
  it('follows one part between two points on it', () => {
    const path = networkPath([branch], [58.7705, 5.85001], [58.7715, 5.85001])
    expect(path[0]).toEqual([58.7705, 5.85])
    expect(path[path.length - 1]).toEqual([58.7715, 5.85])
    expect(partLengthM(path)).toBeGreaterThan(100)
    expect(partLengthM(path)).toBeLessThan(120)
  })

  it("crosses a junction, through the network's own vertices", () => {
    // From the middle of the spur (55 m south of J) to 166 m north of J on J -> K, above the loop
    const path = networkPath([loop, spur, branch], [58.7695, 5.85], [58.7715, 5.85])
    expect(path).toContainEqual(J)
    expect(partLengthM(path)).toBeGreaterThan(215)
    expect(partLengthM(path)).toBeLessThan(230)
  })

  it('takes the shorter way round a loop', () => {
    // Both points on the loop, near J on either side: the short way is through J, not round the loop
    const path = networkPath([loop], [58.7701, 5.8502], [58.7701, 5.8498])
    expect(path).toContainEqual(J)
  })

  it('finds nothing between two disconnected networks', () => {
    expect(networkPath([branch, [[58.80, 5.90], [58.81, 5.90]]], J, [58.805, 5.90])).toBeNull()
  })
})

describe('styles', () => {
  const seg = (color, kind) => ({ color, kind, line: branch })

  it("reads a network's style where it is the same throughout", () => {
    expect(networkStyle({ segments: [seg('bla', 'turvei'), seg('bla', 'turvei')] })).toEqual({ color: 'bla', kind: 'turvei' })
    expect(networkStyle({ segments: [seg('bla', 'turvei'), seg('rod', 'turvei')] })).toEqual({ color: null, kind: 'turvei' })
  })

  it("starts a new path in the network's style, or the default where it varies", () => {
    expect(startStyle({ segments: [seg('morkebla', 'vei')] })).toEqual({ color: 'morkebla', kind: 'vei' })
    expect(startStyle({ segments: [seg('bla', 'vei'), seg('rod', 'tursti')] })).toEqual({ color: DEFAULT_STYLE.color, kind: DEFAULT_STYLE.kind })
  })
})

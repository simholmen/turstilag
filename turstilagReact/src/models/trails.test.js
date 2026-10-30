import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const { SNAP_M, missingTrailFields, networkNodes, snapToNetwork, totalKm } = await import('./trails')

// Three segments meeting at a junction J, plus one that ends nowhere near it
const J = [58.77, 5.85]
const trails = [
  { id: '1', lengthM: 500, latLngs: [[58.765, 5.85], J] },
  { id: '2', lengthM: 400, latLngs: [J, [58.775, 5.85]] },
  { id: '3', lengthM: 300, latLngs: [J, [58.77, 5.86], [58.772, 5.865]] },
  { id: '4', lengthM: 800, latLngs: [[58.78, 5.80], [58.79, 5.80]] },
]

describe('network nodes', () => {
  it('counts the segments ending at each node', () => {
    const nodes = networkNodes(trails)
    const junction = nodes.find((n) => n.ll === J || (n.ll[0] === J[0] && n.ll[1] === J[1]))
    expect(junction.degree).toBe(3)
    expect(junction.trailIds.sort()).toEqual(['1', '2', '3'])
    expect(nodes.filter((n) => n.degree === 1)).toHaveLength(5)
  })

  it('adds up the length', () => {
    expect(totalKm(trails)).toBe(2)
  })
})

describe('snapping', () => {
  it('moves a click within reach onto the nearest vertex', () => {
    // About 5 m north of J
    expect(snapToNetwork([58.77004, 5.85], trails)).toBe(trails[0].latLngs[1])
  })

  it('leaves a click out of reach alone', () => {
    const far = [58.7705, 5.85]
    expect(snapToNetwork(far, trails)).toBe(far)
  })

  it('prefers a segment end over an inner vertex at about the same distance', () => {
    const inner = trails[2].latLngs[1]
    const end = [inner[0], inner[1] + 0.0002]
    const withEnd = [...trails, { id: '5', lengthM: 10, latLngs: [end, [58.76, 5.87]] }]
    // Halfway between, marginally closer to the inner vertex
    const click = [inner[0], inner[1] + 0.000095]
    expect(snapToNetwork(click, withEnd)).toBe(end)
    expect(SNAP_M).toBeGreaterThan(5)
  })

  it('ignores the segment being edited', () => {
    expect(snapToNetwork([58.765, 5.85], trails, '1')).toEqual([58.765, 5.85])
  })
})

it('needs at least two points', () => {
  expect(missingTrailFields({ points: [[1, 2]] })).toHaveLength(1)
  expect(missingTrailFields({ points: [[1, 2], [3, 4]] })).toEqual([])
})

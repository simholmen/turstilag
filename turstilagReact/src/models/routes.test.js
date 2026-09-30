import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const {
  PLANK_BG, buildAlong, buildStrip, fmtTime, missingRouteFields, pointsToLineGeometry, rowToRoute, toLatLngLine,
} = await import('./routes')

describe('line geometry', () => {
  it('writes [lng, lat] and keeps the line open', () => {
    const geometry = pointsToLineGeometry([[58.77, 5.85], [58.78, 5.86], [58.77, 5.85]])
    expect(geometry.type).toBe('LineString')
    expect(geometry.coordinates).toEqual([[5.85, 58.77], [5.86, 58.78], [5.85, 58.77]])
    expect(pointsToLineGeometry([[1, 2], [3, 4]]).coordinates).toHaveLength(2)
  })

  it('reads a LineString and ignores other types', () => {
    expect(toLatLngLine({ type: 'LineString', coordinates: [[5.85, 58.77], [5.86, 58.78]] })).toEqual([[58.77, 5.85], [58.78, 5.86]])
    expect(toLatLngLine({ type: 'Polygon', coordinates: [[[0, 0], [1, 1], [0, 0]]] })).toEqual([])
    expect(toLatLngLine(null)).toEqual([])
  })
})

describe('rowToRoute', () => {
  it('builds the difficulty · shape badge', () => {
    expect(rowToRoute({ id: 1, title: 'x', difficulty: 'bla', shape: 'rundtur', km: 3 }).badge).toBe('Blå · Rundtur')
  })

  it('falls back on unknown enum values', () => {
    expect(rowToRoute({ id: 1, title: 'x', difficulty: '?', shape: '?' }).badge).toBe('Grønn · Rundtur')
  })
})

describe('missingRouteFields', () => {
  it('needs a title and at least 2 points', () => {
    expect(missingRouteFields({ title: 'x', points: [[0, 0]] })).toEqual(['rute i kartet (minst 2 punkter)'])
    expect(missingRouteFields({ title: 'x', points: [[0, 0], [1, 1]] })).toEqual([])
    expect(missingRouteFields({ title: ' ', points: [] })).toHaveLength(2)
  })
})

describe('fmtTime', () => {
  it('estimates walking time', () => {
    expect(fmtTime(4, '0 m')).toBe('ca. 1 t')
    expect(fmtTime(4, '150 m')).toBe('ca. 1 t 15')
    expect(fmtTime(2, '')).toBe('ca. 30 min')
  })
})

describe('along the route', () => {
  const route = {
    km: 3,
    shape: 'rundtur',
    features: [
      { key: 'other_points:1', kind: 'tilrettelegging', subtypes: ['klopp'], title: 'Klopp', km: 1, kmFra: 0.9, kmTil: 1.05, lengthM: 150 },
      { key: 'gjerdeklyvere:2', kind: 'gjerdeklyver', subtypes: ['hundeluke', 'annen'], subtypeOther: 'Grind', title: 'Klyver', km: 2, kmFra: null, kmTil: null },
      { key: 'gjerdeklyvere:3', kind: 'gjerdeklyver', subtypes: [], title: 'Ved start', km: 2.99, kmFra: null, kmTil: null },
    ],
  }

  it('orders by km and snaps a rundtur end point to the start', () => {
    const along = buildAlong(route)
    expect(along.map((a) => a.key)).toEqual(['gjerdeklyvere:3', 'other_points:1', 'gjerdeklyvere:2'])
    expect(along[0].km).toBe(0)
  })

  it('turns linear features into spans with a metre length', () => {
    const span = buildAlong(route).find((a) => a.key === 'other_points:1')
    expect(span.km).toBe(0.9)
    expect(span.kmTo).toBe(1.05)
    expect(span.sub).toBe('Klopp · 150 m')
  })

  it('lists every subtype of a point', () => {
    expect(buildAlong(route).find((a) => a.key === 'gjerdeklyvere:2').sub).toBe('Hundeluke, Grind')
  })

  it('does not snap on a tur-retur', () => {
    expect(buildAlong({ ...route, shape: 'turretur' }).at(-1).km).toBe(2.99)
  })

  it('positions strip markers and plank bands within the bar', () => {
    const strip = buildStrip(route)
    expect(strip.bands).toHaveLength(1)
    expect(strip.bands[0].bg).toBe(PLANK_BG)
    expect(strip.markers.every((m) => parseFloat(m.left) <= 100)).toBe(true)
    expect(strip.axis).toEqual(['0', '1,5', '3,0'])
  })
})

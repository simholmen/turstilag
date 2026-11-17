import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const {
  PLANK_BG, STRETCH_STYLES, buildAlong, buildStrip, fmtTime, missingRouteFields, pointsToLineGeometry, routeHasDifficulty, routeVariant,
  rowToRoute, stretchStyle, toLatLngLine, variantForAlternative, placeAlternative, variantsUsing, missingVariantFields, missingAlternativeFields,
  alternativeName,
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
      { key: 'other_points:1', kind: 'stiforbedring', subtypes: ['klopp'], title: 'Klopp', km: 1, kmFra: 0.9, kmTil: 1.05, lengthM: 150 },
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

describe('stretch styles', () => {
  it('keeps Turruter to bru and planks, and gives Hva finnes one look per subtype', () => {
    expect(stretchStyle('stiforbedring', ['bru'], false)).toBe(STRETCH_STYLES.bru)
    expect(stretchStyle('stiforbedring', ['grus'], false)).toBe(STRETCH_STYLES.klopp)
    expect(stretchStyle('stiforbedring', ['grus'], true)).toBe(STRETCH_STYLES.grus)
    expect(stretchStyle('stiforbedring', [], true)).toBe(STRETCH_STYLES.klopp)
    expect(stretchStyle('annet', [], true).at(-1).color).toBe('#5b6259')
  })
})

describe('variants', () => {
  const feature = (key, kind = 'gjerdeklyver') => ({ key, kind })
  const route = rowToRoute(
    { id: 7, title: 'Kodlifjellet', difficulty: 'bla', shape: 'rundtur', km: 5.2, climb: '300 m' },
    [feature('a')],
    ['o1'],
    [
      { id: 2, name: 'Bratt direkte', difficulty: 'rod', sort_order: 2, km: 4.6, alternative_ids: [11], features: [feature('a'), feature('b')], ownerIds: ['o2'] },
      { id: 1, name: 'Via nordsida', difficulty: null, climb: '350 m', sort_order: 1, km: 6.1, alternative_ids: [10, 11], features: [feature('c', 'stiforbedring')], ownerIds: [] },
    ],
    [{ id: 10, kind: 'avstikker', km: 0.4 }, { id: 11, kind: 'x', km: 0.9 }],
  )

  it('lists Standard first, then the variants in their order', () => {
    expect(route.variants.map((v) => v.id)).toEqual([null, '1', '2'])
    expect(route.variants[0].name).toBe('Standard')
    expect(route.kmRange).toEqual([4.6, 6.1])
  })

  it('names Standard after the route when it is named', () => {
    expect(rowToRoute({ id: 1, title: 'x', variant_name: 'Langs vatnet' }).variants[0].name).toBe('Langs vatnet')
  })

  it('reads alternative stretches, falling back to omvei', () => {
    expect(route.alternatives.map((a) => [a.id, a.kind])).toEqual([['10', 'avstikker'], ['11', 'omvei']])
  })

  it('gives the route as a variant walks it, falling back to the route', () => {
    const steep = routeVariant(route, '2')
    expect(steep).toMatchObject({ variantId: '2', km: 4.6, difficulty: 'rod', climb: '300 m', ownerIds: ['o2'], badge: 'Rød · Rundtur', gjerdeCount: 2 })
    const north = routeVariant(route, '1')
    expect(north).toMatchObject({ difficulty: 'bla', climb: '350 m', stiforbedringCount: 1, gjerdeCount: 0 })
    expect(routeVariant(route, null)).toBe(route)
    expect(routeVariant(route, 'gone')).toBe(route)
  })

  it('knows every point and property along any variant', () => {
    expect(route.anyFeatureKeys.sort()).toEqual(['a', 'b', 'c'])
    expect(route.anyOwnerIds.sort()).toEqual(['o1', 'o2'])
  })

  it('matches a difficulty any variant has', () => {
    expect(routeHasDifficulty(route, 'bla')).toBe(true)
    expect(routeHasDifficulty(route, 'rod')).toBe(true)
    expect(routeHasDifficulty(route, 'svart')).toBe(false)
    expect(routeHasDifficulty(route, null)).toBe(true)
  })

  it('picks the first variant using a tapped stretch', () => {
    expect(variantForAlternative(route, '11')).toBe('1')
    expect(variantForAlternative(route, '99')).toBe(null)
  })

  it('has one variant and one length for a route without any', () => {
    const plain = rowToRoute({ id: 1, title: 'x', km: 3 })
    expect(plain.variants).toHaveLength(1)
    expect(plain.kmRange).toEqual([3, 3])
    expect(plain.alternatives).toEqual([])
  })
})

describe('drawing an alternative stretch', () => {
  // A route along latitude 58.77, from 5.85 to 5.86 (about 580 m)
  const route = rowToRoute({ id: 1, title: 'x', geometry: { type: 'LineString', coordinates: [[5.85, 58.77], [5.86, 58.77]] } })

  it('has no kind before it is a line', () => {
    expect(placeAlternative([[58.77, 5.852]], route).kind).toBe(null)
  })

  it('is an omvei when it comes back onto the route, with both ends put on it', () => {
    const { points, kind } = placeAlternative([[58.77005, 5.852], [58.772, 5.855], [58.77010, 5.858]], route)
    expect(kind).toBe('omvei')
    expect(points[0]).toEqual([58.77, 5.852])
    expect(points[2]).toEqual([58.77, 5.858])
    expect(points[1]).toEqual([58.772, 5.855])
  })

  it('is an avstikker when it ends off the route, which is left where it is', () => {
    const { points, kind } = placeAlternative([[58.77, 5.852], [58.775, 5.852]], route)
    expect(kind).toBe('avstikker')
    expect(points[1]).toEqual([58.775, 5.852])
  })

  it('needs two points', () => {
    expect(missingAlternativeFields({ points: [[0, 0]] })).toHaveLength(1)
    expect(missingAlternativeFields({ points: [[0, 0], [1, 1]] })).toEqual([])
  })
})

describe('variants in the admin', () => {
  const route = rowToRoute(
    { id: 1, title: 'x' },
    [],
    [],
    [{ id: 5, name: 'Via toppen', alternative_ids: [10] }, { id: 6, name: 'Snarvei', alternative_ids: [10, 11] }],
    [{ id: 10, label: 'Toppen' }, { id: 11, label: '' }],
  )

  it('names a stretch by its label, else by its place in the list', () => {
    expect(route.alternatives.map((a) => alternativeName(route, a))).toEqual(['Toppen', 'Strekning 2'])
  })

  it('knows which variants use a stretch', () => {
    expect(variantsUsing(route, '10').map((v) => v.name)).toEqual(['Snarvei', 'Via toppen'])
    expect(variantsUsing(route, '11').map((v) => v.name)).toEqual(['Snarvei'])
  })

  it('flags a variant with stretches left out, never Standard', () => {
    const flagged = rowToRoute({ id: 1, title: 'x' }, [], [], [{ id: 5, name: 'v', skipped: 1 }])
    expect(flagged.variants.map((v) => v.skipped)).toEqual([0, 1])
  })

  it('needs a name and a stretch', () => {
    expect(missingVariantFields({ name: ' ', alternativeIds: [] })).toEqual(['navn', 'minst én strekning'])
    expect(missingVariantFields({ name: 'x', alternativeIds: ['1'] })).toEqual([])
  })
})

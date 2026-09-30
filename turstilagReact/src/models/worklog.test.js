import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const {
  TYPES, allowedGeoms, defaultGeom, entryGeometry, entryType, fmtArea, fmtDist, fmtKm, groupEntriesByType,
  hasSubtypes, missingFields, rowToEntry, sortEntriesByDistance, subtypeAbout, subtypeLabel, subtypesLabel, validSubtype,
  validSubtypes,
} = await import('./worklog')
const { toLatLngs } = await import('./geometry')

describe('taxonomy', () => {
  it('has the 6 kinds in design order', () => {
    expect(Object.keys(TYPES)).toEqual(['gjerdeklyver', 'tilrettelegging', 'turinfo', 'benk', 'parkering', 'annet'])
  })

  it('returns subtype copy verbatim and is null-safe', () => {
    expect(subtypeAbout('gjerdeklyver', 'turstiport'))
      .toBe('Selvlukkende port i gjerdet – ingen klatring. Egner seg for barnevogn, hund og de som ikke vil over en stige.')
    expect(subtypeAbout('benk', null)).toBeUndefined()
    expect(subtypeLabel('benk', 'klopp')).toBeUndefined()
    expect(subtypeLabel('gjerdeklyver', 'annen')).toBe('Annen type')
  })

  it('knows which kinds have subtypes', () => {
    expect(hasSubtypes('turinfo')).toBe(false)
    expect(hasSubtypes('tilrettelegging')).toBe(true)
  })

  it('drops a subtype that does not belong to the kind', () => {
    expect(validSubtype('benk', 'turstiport')).toBeNull()
    expect(validSubtype('gjerdeklyver', 'turstiport')).toBe('turstiport')
  })

  it('keeps several subtypes only for kryssningspunkt', () => {
    expect(validSubtypes('gjerdeklyver', ['hundeluke', 'turstitrapp', 'bru'])).toEqual(['turstitrapp', 'hundeluke'])
    expect(validSubtypes('tilrettelegging', ['klopp', 'bru'])).toEqual(['bru'])
    expect(validSubtypes('benk', ['klopp'])).toEqual([])
    expect(validSubtypes('gjerdeklyver', null)).toEqual([])
  })

  it('labels annen type by its typed-out name', () => {
    expect(subtypesLabel('gjerdeklyver', ['turstiport', 'annen'], 'Grind')).toBe('Turstiport, Grind')
    expect(subtypesLabel('gjerdeklyver', ['annen'], '')).toBe('Annen type')
  })

  it('requires a name and a description for annen type', () => {
    const draft = {
      area: '1', type: 'gjerdeklyver', subtypes: ['hundeluke', 'annen'], subtypeOther: ' ', title: 'K', desc: '', ll: [58.7, 5.8],
    }
    expect(missingFields({ kind: 'entry', draft })).toEqual(['navn på annen type', 'beskrivelse'])
    expect(missingFields({ kind: 'entry', draft: { ...draft, subtypeOther: 'Grind', desc: 'Tregrind' } })).toEqual([])
    expect(missingFields({ kind: 'entry', draft: { ...draft, subtypes: ['hundeluke'] } })).toEqual([])
  })

  it('maps legacy and unknown kinds', () => {
    expect(entryType({ kind: 'poi', icon: 'gjerdeklyver' })).toBe('gjerdeklyver')
    expect(entryType({ kind: 'nonsense' })).toBe('annet')
    expect(entryType({ kind: 'benk' })).toBe('benk')
  })
})

describe('geometry per kind', () => {
  it('allows lines and areas only for tilrettelegging and annet', () => {
    expect(allowedGeoms('tilrettelegging')).toHaveLength(3)
    expect(allowedGeoms('annet')).toHaveLength(3)
    expect(allowedGeoms('benk')).toEqual(['point'])
  })

  it('preselects a tool from the subtype', () => {
    expect(defaultGeom('tilrettelegging', 'klopp')).toBe('line')
    expect(defaultGeom('tilrettelegging', 'trapp')).toBe('point')
    expect(defaultGeom('tilrettelegging', 'steinsetting')).toBe('poly')
    expect(defaultGeom('benk', 'klopp')).toBe('point')
  })

  it('builds an open line and a closed polygon', () => {
    const points = [[58.77, 5.85], [58.78, 5.86], [58.78, 5.85]]
    const line = entryGeometry({ type: 'tilrettelegging', geomType: 'line', points })
    expect(line.type).toBe('LineString')
    expect(line.coordinates).toHaveLength(3)
    expect(line.coordinates[0]).toEqual([5.85, 58.77])
    const poly = entryGeometry({ type: 'tilrettelegging', geomType: 'poly', points })
    expect(poly.type).toBe('Polygon')
    expect(poly.coordinates[0]).toHaveLength(4)
    expect(poly.coordinates[0][3]).toEqual(poly.coordinates[0][0])
  })

  it('saves a point for point-only kinds whatever the draft says', () => {
    expect(entryGeometry({ type: 'benk', geomType: 'line', points: [[1, 2], [3, 4]], ll: [58.7, 5.8] }))
      .toEqual({ type: 'Point', coordinates: [5.8, 58.7] })
  })

  it('requires enough vertices for the geometry type', () => {
    const draft = { area: '1', type: 'tilrettelegging', title: 'x', geomType: 'line', points: [[1, 2]], ll: null }
    expect(missingFields({ kind: 'entry', draft })).toEqual(['strekning (minst 2 punkter)'])
    expect(missingFields({ kind: 'entry', draft: { ...draft, points: [[1, 2], [3, 4]] } })).toEqual([])
  })

  it('reads Point, LineString and Polygon, and nothing else', () => {
    expect(toLatLngs({ type: 'LineString', coordinates: [[5.85, 58.77], [5.86, 58.78]] })).toEqual([[58.77, 5.85], [58.78, 5.86]])
    expect(toLatLngs({ type: 'Polygon', coordinates: [[[5.85, 58.77], [5.86, 58.77], [5.85, 58.77]]] }))
      .toEqual([[58.77, 5.85], [58.77, 5.86], [58.77, 5.85]])
    expect(toLatLngs({ type: 'Point', coordinates: [5.85, 58.77] })).toEqual([[58.77, 5.85]])
    expect(toLatLngs({ type: 'GeometryCollection' })).toEqual([])
    expect(toLatLngs(null)).toEqual([])
  })
})

describe('rowToEntry', () => {
  it('uses the view anchor and extent for a line', () => {
    const entry = rowToEntry({
      id: '7', kind: 'tilrettelegging', subtypes: ['klopp'], source_table: 'other_points', geom_type: 'LINESTRING',
      geometry: { type: 'LineString', coordinates: [[5.85, 58.77], [5.86, 58.78]] },
      anchor: { type: 'Point', coordinates: [5.855, 58.775] }, length_m: 120, area_m2: 0, title: 'K',
    }, { id: '1' })
    expect(entry.key).toBe('other_points:7')
    expect(entry.geomType).toBe('line')
    expect(entry.ll).toEqual([58.775, 5.855])
    expect(entry.latLngs).toHaveLength(2)
    expect(entry.lengthM).toBe(120)
  })

  it('keeps a legacy gjerdeklyver in its real table', () => {
    const entry = rowToEntry({
      id: '3', kind: 'gjerdeklyver', source_table: 'other_points', geom_type: 'POINT',
      geometry: { type: 'Point', coordinates: [5.8, 58.7] }, title: 'G',
    }, { id: '1' })
    expect(entry.table).toBe('other_points')
    expect(entry.subtypes).toEqual([])
  })

  it('reads a kryssningspunkt with several subtypes', () => {
    const entry = rowToEntry({
      id: '4', kind: 'gjerdeklyver', source_table: 'gjerdeklyvere', geom_type: 'POINT', subtypes: ['turstitrapp', 'annen'],
      subtype_other: 'Grind', geometry: { type: 'Point', coordinates: [5.8, 58.7] }, title: 'G',
    }, { id: '1' })
    expect(entry.subtypes).toEqual(['turstitrapp', 'annen'])
    expect(entry.subtypeOther).toBe('Grind')
  })
})

describe('lists', () => {
  it('groups by kind in design order', () => {
    const groups = groupEntriesByType([{ type: 'benk' }, { type: 'gjerdeklyver' }, { type: 'benk' }])
    expect(groups.map((g) => [g.key, g.entries.length])).toEqual([['gjerdeklyver', 1], ['benk', 2]])
  })

  it('sorts by distance', () => {
    const sorted = sortEntriesByDistance([{ key: 'far', ll: [58.8, 5.9] }, { key: 'near', ll: [58.7721, 5.8551] }], [58.772, 5.855])
    expect(sorted.map((e) => e.key)).toEqual(['near', 'far'])
    expect(sorted[0].dist).toBeLessThan(50)
  })
})

describe('formatters', () => {
  it('formats km, distance and area the Norwegian way', () => {
    expect(fmtKm(3.2)).toBe('3,2')
    expect(fmtKm(19.3)).toBe('19')
    expect(fmtDist(120)).toBe('120 m')
    expect(fmtDist(3400)).toBe('3,4 km')
    expect(fmtArea(400)).toBe('ca. 400 m²')
    expect(fmtArea(5000)).toBe('ca. 5 daa')
  })
})

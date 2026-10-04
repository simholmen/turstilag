import { TYPES } from './worklog'

export const ALL_KINDS = Object.keys(TYPES)

// What the map draws, per mode; toggles are remembered per mode for the session. `kinds` are the
// point kinds shown — in Hva finnes the same list drives the sidebar's kind chips. In Turruter the
// points along the selected route are drawn whatever `kinds` says.
export const DEFAULT_LAYERS = {
  finnes: { kinds: ALL_KINDS, owners: true, routes: false, work: false },
  ruter: { kinds: [], owners: false, routes: true, work: false },
  grunneiere: { kinds: [], owners: true, routes: false, work: false },
  arbeidslogg: { kinds: ALL_KINDS, owners: true, routes: false, work: true },
}

// Which toggles the map offers per mode. 'kinds' expands to one chip per point kind.
export const LAYER_KEYS = {
  finnes: ['kinds', 'owners', 'routes'],
  ruter: ['kinds', 'owners', 'routes'],
  grunneiere: ['kinds', 'owners', 'routes'],
  arbeidslogg: ['work', 'owners', 'routes'],
}

// Adds or removes a kind, keeping TYPES order
export const toggleKindIn = (kinds, kind) => (kinds.includes(kind)
  ? kinds.filter((k) => k !== kind)
  : ALL_KINDS.filter((k) => k === kind || kinds.includes(k)))

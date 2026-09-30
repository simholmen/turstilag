import { describe, expect, it } from 'vitest'
import { snapLineToStretches } from './geometry'

// ~11 m per 0.0001° of latitude; the route runs straight north along lng 5.85
const route = [[58.77, 5.85], [58.771, 5.85], [58.772, 5.85], [58.773, 5.85]]
// A stretch a few metres east of the route, between roughly 58.7712 and 58.7718
const stretch = [[58.7712, 5.85005], [58.7715, 5.85008], [58.7718, 5.85005]]

describe('snapLineToStretches', () => {
  it('routes the line through the stretch vertices', () => {
    expect(snapLineToStretches(route, [stretch])).toEqual([
      [58.77, 5.85], [58.771, 5.85], ...stretch, [58.772, 5.85], [58.773, 5.85],
    ])
  })

  it('follows the line direction whichever way the stretch was drawn', () => {
    const snapped = snapLineToStretches(route, [[...stretch].reverse()])
    expect(snapped.slice(2, 5)).toEqual(stretch)
  })

  it('leaves the line alone when a stretch end is off the route', () => {
    const offRoute = [[58.7712, 5.85005], [58.7718, 5.852]]
    expect(snapLineToStretches(route, [offRoute])).toBe(route)
  })

  it('skips a stretch that overlaps an earlier one', () => {
    const overlap = [[58.7716, 5.85], [58.7725, 5.85]]
    const snapped = snapLineToStretches(route, [stretch, overlap])
    expect(snapped).toHaveLength(route.length + stretch.length)
  })
})

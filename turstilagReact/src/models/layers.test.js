import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const { ALL_KINDS, toggleKindIn } = await import('./layers')

describe('toggleKindIn', () => {
  it('removes a shown kind and re-adds it in design order', () => {
    const without = toggleKindIn(ALL_KINDS, 'gjerdeklyver')
    expect(without).not.toContain('gjerdeklyver')
    expect(toggleKindIn(without, 'gjerdeklyver')).toEqual(ALL_KINDS)
    expect(toggleKindIn(['benk'], 'turinfo')).toEqual(['turinfo', 'benk'])
  })
})

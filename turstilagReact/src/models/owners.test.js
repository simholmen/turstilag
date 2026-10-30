import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

const { MAX_CONTACTS, cleanContacts, emptyContact } = await import('./owners')

describe('contacts', () => {
  it('trims fields and drops contacts with nothing filled in', () => {
    const contacts = [
      { name: ' Kari ', role: 'Forpakter', phone: '', email: '' },
      emptyContact(),
      { name: '', role: '', phone: '900 00 000', email: '' },
    ]
    expect(cleanContacts(contacts)).toEqual([
      { name: 'Kari', role: 'Forpakter', phone: '', email: '' },
      { name: '', role: '', phone: '900 00 000', email: '' },
    ])
  })

  it('keeps at most three', () => {
    const many = Array.from({ length: 5 }, (_, i) => ({ ...emptyContact(), name: `K${i}` }))
    expect(cleanContacts(many)).toHaveLength(MAX_CONTACTS)
    expect(MAX_CONTACTS).toBe(3)
  })
})

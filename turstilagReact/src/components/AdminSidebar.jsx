import { useEffect, useState } from 'react'

const EMPTY_FORM = {
  kind: '',
  title: '',
  group: '',
  description: '',
  popup: '',
  icon: 'gjerdeklyver',
  difficulty: 'lett',
  color: '#d62728',
  slug: '',
  includes: '',
  lastUpdated: '',
  imagesText: '',
}

const toFormState = (feature) => {
  if (!feature?.properties) return EMPTY_FORM
  const p = feature.properties
  return {
    kind: p.kind || '',
    title: p.title || '',
    group: p.group || '',
    description: p.description || '',
    popup: p.popup || '',
    icon: p.icon || 'gjerdeklyver',
    difficulty: p.difficulty || 'lett',
    color: p.color || '#d62728',
    slug: p.slug || '',
    includes: p.includes || '',
    lastUpdated: p.lastUpdated || '',
    imagesText: (p.images || []).join('\n'),
  }
}

const ICON_OPTIONS = ['gjerdeklyver', 'sti']
const DIFFICULTY_OPTIONS = ['lett', 'middels', 'hard']
const COLOR_OPTIONS = ['#d62728', '#2ecc71']
const INCLUDES_OPTIONS = ['tursti', 'gjerdeklyver', 'hvilebenker']

export default function AdminSidebar({
  feature,
  isOpen,
  onClose,
  onSave,
  isSaving,
  isCollapsed,
  onCollapse,
  availableGroups = [],
}) {
  const [form, setForm] = useState(EMPTY_FORM)

  useEffect(() => {
    setForm(toFormState(feature))
  }, [feature])

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      slug: prev.kind === 'hub' ? prev.slug : '',
    }))
  }, [form.kind])

  const isExisting = Boolean(feature?.properties?.id)
  const geometryType = feature?.geometry?.type || '-'
  const finalLastUpdated = form.lastUpdated.trim() || new Date().toISOString().split('T')[0]
  const selectedIncludes = form.includes
    ? form.includes.split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const updateField = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const toggleInclude = (option) => {
    const updated = selectedIncludes.includes(option)
      ? selectedIncludes.filter((s) => s !== option)
      : [...selectedIncludes, option]
    setForm((prev) => ({ ...prev, includes: updated.join(', ') }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!feature) return
    const finalForm = {
      ...form,
      lastUpdated: finalLastUpdated,
    }
    // Client-side validation for new features
    if (!isExisting) {
      if (!finalForm.kind) {
        alert('Velg en type for objektet før du lagrer.')
        return
      }
      if (!finalForm.group) {
        alert('Velg en gruppe for objektet før du lagrer.')
        return
      }
    }

    onSave(feature, finalForm)
  }

  if (!isOpen || !feature) return null

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      {isCollapsed && (
        <button className="collapse-btn-float" onClick={onCollapse}>
          ▶
        </button>
      )}

      {!isCollapsed && (
        <>
          <button className="close-btn-float" onClick={onClose}>✕</button>
          <button className="collapse-btn-float" onClick={onCollapse}>◀</button>

          <div className="sidebar-content admin-content">
            <h1 className="sidebar-title">{isExisting ? 'Rediger objekt' : 'Nytt objekt'}</h1>
            <p className="admin-hint">
              Geometri: <strong>{geometryType}</strong>
            </p>

            <form onSubmit={handleSubmit} className="admin-form">
              <label className="admin-field">
                <span>Type *</span>
                <select
                    value={form.kind}
                    onChange={(e) => updateField('kind', e.target.value)}
                    required={!isExisting}
                >
                    <option value="">-- Velg type --</option>
                  <option value="poi">Punkt (POI)</option>
                  <option value="gjerdeklyver">Gjerdeklyver</option>
                  <option value="trail">Linje (sti)</option>
                  <option value="hub">Hub</option>
                </select>
              </label>

              <label className="admin-field">
                <span>Tittel</span>
                <input
                  value={form.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  required
                />
              </label>

              {form.kind === 'hub' && (
                <label className="admin-field">
                  <span>Slug (hub-identifikator) *</span>
                  <input
                    value={form.slug}
                    onChange={(e) => updateField('slug', e.target.value)}
                    placeholder="oygardsvannet"
                    required
                  />
                </label>
              )}

              <label className="admin-field">
                <span>Gruppe</span>
                <select
                  value={form.group}
                  onChange={(e) => updateField('group', e.target.value)}
                  required={!isExisting}
                >
                  <option value="">-- Ingen gruppe --</option>
                  {availableGroups.map((group) => (
                    <option key={group} value={group}>
                      {group}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Ikon</span>
                <select
                  value={form.icon}
                  onChange={(e) => updateField('icon', e.target.value)}
                >
                  {ICON_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Popup-tekst</span>
                <textarea
                  value={form.popup}
                  onChange={(e) => updateField('popup', e.target.value)}
                  rows={3}
                />
              </label>

              <label className="admin-field">
                <span>Beskrivelse</span>
                <textarea
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={4}
                />
              </label>

              {form.kind === 'hub' && (
                <div className="admin-field">
                  <span>Inkluderer</span>
                  <div className="admin-checkboxes">
                    {INCLUDES_OPTIONS.map((option) => (
                      <label key={option} className="admin-checkbox">
                        <input
                          type="checkbox"
                          checked={selectedIncludes.includes(option)}
                          onChange={() => toggleInclude(option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <label className="admin-field">
                <span>Vanskelighetsgrad</span>
                <select
                  value={form.difficulty}
                  onChange={(e) => updateField('difficulty', e.target.value)}
                >
                  {DIFFICULTY_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Sist oppdatert (hvis tom: dagens dato)</span>
                <input
                  value={form.lastUpdated}
                  onChange={(e) => updateField('lastUpdated', e.target.value)}
                  placeholder={new Date().toISOString().split('T')[0]}
                />
              </label>

              <label className="admin-field">
                <span>Farge</span>
                <select
                  value={form.color}
                  onChange={(e) => updateField('color', e.target.value)}
                >
                  {COLOR_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>

              <label className="admin-field">
                <span>Bilder (placeholder: /assets/yggenprofil.jpg)</span>
                <div className="admin-placeholder-notice">
                  Bruker placeholder: /assets/yggenprofil.jpg
                </div>
              </label>

              <button type="submit" className="admin-save-btn" disabled={isSaving}>
                {isSaving ? 'Lagrer...' : isExisting ? 'Lagre endringer' : 'Opprett objekt'}
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
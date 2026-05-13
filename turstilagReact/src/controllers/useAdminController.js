import { useCallback, useMemo, useState } from 'react'
import { useFeatures } from '../hooks/useFeatures'
import { saveFeature } from '../models/features'

const latLngToPointGeometry = (latlng) => ({
  type: 'Point',
  coordinates: [latlng.lng, latlng.lat],
})

const latLngsToLineGeometry = (latlngs) => ({
  type: 'LineString',
  coordinates: latlngs.map((latlng) => [latlng.lng, latlng.lat]),
})

const extractSupabaseError = (error) => {
  if (!error) return 'Ukjent feil'
  const code = error.code ? `[${error.code}] ` : ''
  const details = error.details ? ` Details: ${error.details}` : ''
  const hint = error.hint ? ` Hint: ${error.hint}` : ''
  return `${code}${error.message || 'Ukjent feil'}${details}${hint}`
}

export function useAdminController() {
  const { features, refreshFeatures } = useFeatures()
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [selectedHubLayer, setSelectedHubLayer] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [drawMode, setDrawMode] = useState(null)
  const [draftPoint, setDraftPoint] = useState(null)
  const [draftLine, setDraftLine] = useState([])

  const clearDraft = useCallback(() => {
    setDraftPoint(null)
    setDraftLine([])
  }, [])

  const openSidebarForFeature = useCallback((feature) => {
    if (!feature) {
      setSidebarOpen(false)
      setSelectedHubLayer(null)
      return
    }

    setSelectedFeature(feature)
    setSidebarOpen(true)
  }, [])

  const handleMapFeatureClick = useCallback((feature) => {
    if (feature === null) {
      openSidebarForFeature(null)
      return
    }

    const cleanFeature = {
      ...feature,
      properties: {
        ...feature.properties,
      },
    }

    delete cleanFeature.properties.relatedPois
    delete cleanFeature.properties.relatedTrails

    openSidebarForFeature(cleanFeature)
  }, [openSidebarForFeature])

  const handleFinishLine = useCallback(() => {
    if (drawMode !== 'line' || draftLine.length < 2) return

    const newFeature = {
      type: 'Feature',
      geometry: latLngsToLineGeometry(draftLine),
      properties: {
        title: '',
        kind: 'trail',
      },
    }

    openSidebarForFeature(newFeature)
  }, [drawMode, draftLine, openSidebarForFeature])

  const handleMapClick = useCallback((latlng) => {
    if (drawMode === 'point') {
      setDraftPoint(latlng)
      const newFeature = {
        type: 'Feature',
        geometry: latLngToPointGeometry(latlng),
        properties: {
          title: '',
          kind: 'poi',
        },
      }

      openSidebarForFeature(newFeature)
      return
    }

    if (drawMode === 'line') {
      setDraftLine((prev) => [...prev, latlng])
    }
  }, [drawMode, openSidebarForFeature])

  const handleSelectMode = useCallback((mode) => {
    if (mode === drawMode) {
      setDrawMode(null)
      clearDraft()
      return
    }

    setDrawMode(mode)
    clearDraft()
  }, [clearDraft, drawMode])

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false)
    setSelectedHubLayer(null)
  }, [])

  const handleSaveFeature = useCallback(async (feature, form) => {
    setIsSaving(true)

    try {
      const savedFeature = await saveFeature(feature, form)

      if (savedFeature) {
        setSelectedFeature(savedFeature)
      }

      await refreshFeatures()
      clearDraft()
      setDrawMode(null)
    } catch (error) {
      console.error('Saving feature failed:', error)
      alert(`Kunne ikke lagre objektet: ${extractSupabaseError(error)}`)
    } finally {
      setIsSaving(false)
    }
  }, [clearDraft, refreshFeatures])

  const handleCollapseSidebar = useCallback(() => {
    setIsCollapsed((prev) => !prev)
  }, [])

  const availableGroups = useMemo(() => {
    const slugs = new Set()

    features.forEach((feature) => {
      if (feature.properties?.slug) slugs.add(feature.properties.slug)
    })

    return Array.from(slugs).sort()
  }, [features])

  const adminModeText = useMemo(() => {
    if (drawMode === 'point') return 'Klikk i kartet for å sette nytt punkt'
    if (drawMode === 'line') return 'Klikk flere punkter i kartet, trykk deretter Fullfør linje'
    return 'Velg Nytt punkt eller Ny linje for å starte tegning'
  }, [drawMode])

  return {
    features,
    selectedFeature,
    selectedHubLayer,
    sidebarOpen,
    isCollapsed,
    isSaving,
    drawMode,
    draftPoint,
    draftLine,
    availableGroups,
    adminModeText,
    handleMapFeatureClick,
    handleMapClick,
    handleSelectMode,
    handleFinishLine,
    handleCloseSidebar,
    handleSaveFeature,
    handleCollapseSidebar,
    clearDraft,
    setSelectedHubLayer,
  }
}
import { useCallback, useState } from 'react'
import { useFeatures } from '../hooks/useFeatures'

export function useMapController() {
  const { features } = useFeatures()
  const [selectedFeature, setSelectedFeature] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [selectedHubLayer, setSelectedHubLayer] = useState(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const handleFeatureClick = useCallback((feature) => {
    if (feature === null) {
      setSidebarOpen(false)
      setSelectedHubLayer(null)
      return
    }

    setSelectedFeature(feature)
    setSidebarOpen(true)
  }, [])

  const handleHubSelect = useCallback((layer) => {
    setSelectedHubLayer(layer)
  }, [])

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false)
    setSelectedHubLayer(null)
  }, [])

  const handleCollapseSidebar = useCallback(() => {
    setIsCollapsed((prev) => !prev)
  }, [])

  return {
    features,
    selectedFeature,
    sidebarOpen,
    selectedHubLayer,
    isCollapsed,
    handleFeatureClick,
    handleHubSelect,
    handleCloseSidebar,
    handleCollapseSidebar,
  }
}
import { useCallback, useEffect, useState } from 'react'
import { loadFeatures } from '../models/features'

export function useFeatures() {
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refreshFeatures = useCallback(async () => {
    setLoading(true)

    try {
      setError(null)
      const nextFeatures = await loadFeatures()
      setFeatures(nextFeatures)
    } catch (loadError) {
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshFeatures()
  }, [refreshFeatures])

  return { features, loading, error, refreshFeatures }
}
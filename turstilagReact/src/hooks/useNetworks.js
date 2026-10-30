import { useCallback, useEffect, useState } from 'react'
import { loadNetworks } from '../models/networks'

export function useNetworks() {
  const [networks, setNetworks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      setNetworks(await loadNetworks())
    } catch (loadError) {
      console.error('Loading trail networks failed:', loadError)
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { networks, loading, error, refresh }
}

import { useCallback, useEffect, useState } from 'react'
import { loadOwnersAndParcels } from '../models/owners'

export function useOwners() {
  const [data, setData] = useState({ owners: [], parcels: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setError(null)
      setData(await loadOwnersAndParcels())
    } catch (loadError) {
      console.error('Loading owners failed:', loadError)
      setError(loadError)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { ...data, loading, error, refresh }
}

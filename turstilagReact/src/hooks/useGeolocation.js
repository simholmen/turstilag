import { useCallback, useEffect, useRef, useState } from 'react'

export function useGeolocation() {
  const [userLocation, setUserLocation] = useState(null)
  const [geoError, setGeoError] = useState(null)
  const [permissionState, setPermissionState] = useState(null)
  const watchIdRef = useRef(null)

  const startWatch = () => {
    if (watchIdRef.current != null) return
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoError(null)
        setUserLocation([pos.coords.latitude, pos.coords.longitude])
      },
      (err) => setGeoError(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    )
  }

  const requestLocation = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setGeoError(new Error('Geolocation not available'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoError(null)
        setUserLocation([pos.coords.latitude, pos.coords.longitude])
        startWatch()
      },
      (err) => setGeoError(err),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  useEffect(() => {
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((res) => {
        setPermissionState(res.state)
      }).catch(() => {})
    }
    const timerId = window.setTimeout(() => {
      requestLocation()
    }, 0)
    return () => {
      window.clearTimeout(timerId)
      if (watchIdRef.current != null && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [requestLocation])

  return { userLocation, geoError, permissionState, requestLocation }
}
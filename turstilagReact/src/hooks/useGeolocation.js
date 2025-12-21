import { useEffect, useRef, useState } from 'react'

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

  const requestLocation = () => {
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
  }

  useEffect(() => {
    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' }).then((res) => {
        setPermissionState(res.state)
      }).catch(() => {})
    }
    requestLocation()
    return () => {
      if (watchIdRef.current != null && navigator.geolocation.clearWatch) {
        navigator.geolocation.clearWatch(watchIdRef.current)
      }
    }
  }, [])

  return { userLocation, geoError, permissionState, requestLocation }
}
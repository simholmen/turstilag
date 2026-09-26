import { useEffect, useMemo, useState } from 'react'
import { fetchImage, imageUrl, uploadImage } from '../lib/images'
import ImageCropModal from './ImageCropModal'

// Every new or re-cropped image goes through a queue shown one at a time in the crop modal.
// Queue items: { blob, name, replaces } where `replaces` is the stored image a re-crop swaps out.
export default function AdminImageField({ images, folder, onChange, onUploadingChange }) {
  const [queue, setQueue] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [loadingImage, setLoadingImage] = useState(null)
  const [error, setError] = useState(null)

  const current = queue[0]
  const currentUrl = useMemo(() => (current ? URL.createObjectURL(current.blob) : null), [current])
  useEffect(() => () => currentUrl && URL.revokeObjectURL(currentUrl), [currentUrl])

  const isBusy = queue.length > 0 || isUploading || loadingImage !== null
  useEffect(() => onUploadingChange(isBusy), [isBusy, onUploadingChange])

  const handleFiles = (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    setError(null)
    setQueue((prev) => [...prev, ...files.map((file) => ({ blob: file, name: file.name, replaces: null }))])
  }

  const handleRecrop = async (img) => {
    setError(null)
    setLoadingImage(img)
    try {
      const blob = await fetchImage(img)
      setQueue((prev) => [...prev, { blob, name: 'bildet', replaces: img }])
    } catch (err) {
      console.error('Loading image for cropping failed:', err)
      setError('Kunne ikke hente bildet for beskjæring')
    } finally {
      setLoadingImage(null)
    }
  }

  const handleApply = async (crop) => {
    setIsUploading(true)
    try {
      const path = await uploadImage(current.blob, folder, crop)
      onChange(
        current.replaces
          ? images.map((img) => (img === current.replaces ? path : img))
          : [...images, path],
      )
    } catch (err) {
      console.error('Image upload failed:', err)
      setError(`Kunne ikke laste opp ${current.name}`)
    } finally {
      setIsUploading(false)
      setQueue((prev) => prev.slice(1))
    }
  }

  const handleCancel = () => setQueue((prev) => prev.slice(1))

  const removeImage = (img) => onChange(images.filter((existing) => existing !== img))

  const moveToFront = (img) => onChange([img, ...images.filter((existing) => existing !== img)])

  return (
    <div className="admin-field">
      <span>Bilder</span>

      {images.length > 0 && (
        <div className="admin-image-grid">
          {images.map((img, idx) => (
            <div key={img} className="admin-image-item">
              <img src={imageUrl(img)} alt={`Bilde ${idx + 1}`} />
              {idx === 0 ? (
                <span className="admin-image-badge">Hovedbilde</span>
              ) : (
                <button type="button" className="admin-image-action left" onClick={() => moveToFront(img)} title="Gjør til hovedbilde">
                  ★
                </button>
              )}
              <button type="button" className="admin-image-action" onClick={() => removeImage(img)} title="Fjern bilde">
                ✕
              </button>
              <button
                type="button"
                className="admin-image-action bottom"
                onClick={() => handleRecrop(img)}
                disabled={isBusy}
                title="Beskjær"
              >
                {loadingImage === img ? '…' : '✂'}
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="admin-secondary-btn admin-image-upload">
        + Legg til bilder
        <input type="file" accept="image/*" multiple onChange={handleFiles} disabled={isBusy} hidden />
      </label>

      {error && <small className="admin-login-error">{error}</small>}
      <small>Bildene lagres når du trykker lagre. Første bilde vises øverst.</small>

      {current && (
        <ImageCropModal
          key={currentUrl}
          src={currentUrl}
          title={queue.length > 1 ? `Beskjær bilde (${queue.length} igjen)` : 'Beskjær bilde'}
          isBusy={isUploading}
          onApply={handleApply}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}

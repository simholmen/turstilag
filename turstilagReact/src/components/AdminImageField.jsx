import { useEffect, useMemo, useState } from 'react'
import { fetchImage, imageUrl, uploadImage } from '../lib/images'
import ImageCropModal from './ImageCropModal'

// Every new or re-cropped image goes through a queue shown one at a time in the crop modal.
// Queue items: { blob, name, replaces } where `replaces` is the stored image a re-crop swaps out.
// variant 'grid' edits the whole list, 'hero' only edits the first (main) image.
export default function AdminImageField({ images, folder, onChange, onUploadingChange, variant = 'grid' }) {
  const [queue, setQueue] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const [loadingImage, setLoadingImage] = useState(null)
  const [error, setError] = useState(null)

  const current = queue[0]
  const currentUrl = useMemo(() => (current ? URL.createObjectURL(current.blob) : null), [current])
  useEffect(() => () => currentUrl && URL.revokeObjectURL(currentUrl), [currentUrl])

  const isBusy = queue.length > 0 || isUploading || loadingImage !== null
  useEffect(() => onUploadingChange(isBusy), [isBusy, onUploadingChange])

  const isHero = variant === 'hero'
  const main = images[0]

  const handleFiles = (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    setError(null)
    // In hero mode a new upload replaces the current main image
    const replaces = isHero ? main ?? null : null
    setQueue((prev) => [...prev, ...files.map((file) => ({ blob: file, name: file.name, replaces }))])
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
          : isHero ? [path, ...images] : [...images, path],
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
    <div className="wl-field">
      <span className="wl-label">{isHero ? 'Hovedbilde' : 'Bilder'}</span>

      {isHero ? (
        main ? (
          <div className="wl-hero-edit-image">
            <img src={imageUrl(main)} alt="" />
            <div className="wl-hero-edit-actions">
              <label className={`wl-pill-btn ${isBusy ? 'disabled' : ''}`}>
                Bytt bilde
                <input type="file" accept="image/*" onChange={handleFiles} disabled={isBusy} hidden />
              </label>
              <button type="button" className="wl-pill-btn" onClick={() => handleRecrop(main)} disabled={isBusy}>
                {loadingImage === main ? '…' : 'Beskjær'}
              </button>
              <button type="button" className="wl-round-btn" onClick={() => removeImage(main)} title="Fjern bilde">✕</button>
            </div>
          </div>
        ) : (
          <label className={`wl-upload-hero ${isBusy ? 'disabled' : ''}`}>
            {isBusy ? 'Laster opp…' : '+ Last opp bilde'}
            <input type="file" accept="image/*" onChange={handleFiles} disabled={isBusy} hidden />
          </label>
        )
      ) : (
        <>
          <div className="wl-image-grid">
            {images.map((img, idx) => (
              <div key={img} className="wl-image-item">
                <img src={imageUrl(img)} alt={`Bilde ${idx + 1}`} />
                {idx === 0 ? (
                  <span className="wl-image-main">Hovedbilde</span>
                ) : (
                  <button type="button" className="wl-image-make-main" onClick={() => moveToFront(img)} title="Gjør til hovedbilde">
                    Gjør til hoved
                  </button>
                )}
                <button type="button" className="wl-image-corner" onClick={() => removeImage(img)} title="Fjern bilde">✕</button>
                <button type="button" className="wl-image-corner second" onClick={() => handleRecrop(img)} disabled={isBusy} title="Beskjær">
                  {loadingImage === img ? '…' : '✂'}
                </button>
              </div>
            ))}
            <label className={`wl-image-add ${isBusy ? 'disabled' : ''}`}>
              {isBusy ? 'Laster opp…' : '+ Legg til'}
              <input type="file" accept="image/*" multiple onChange={handleFiles} disabled={isBusy} hidden />
            </label>
          </div>
          <span className="wl-hint">Hovedbildet vises i listen og øverst i detaljen.</span>
        </>
      )}

      {error && <span className="wl-error">{error}</span>}

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

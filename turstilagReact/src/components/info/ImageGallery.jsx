import { useState } from 'react'
import { imageUrl } from '../../lib/images'
import KindSquare from './KindSquare'

// Hero image with a thumb strip (index 0 is the main image), or a hatched placeholder with the kind
// symbol when there are none. `children` is laid over the hero (scrim, badge, title).
export default function ImageGallery({ images, type, children }) {
  const [index, setIndex] = useState(0)
  const current = Math.min(index, Math.max(images.length - 1, 0))

  const onKeyDown = (event) => {
    if (images.length < 2) return
    if (event.key === 'ArrowRight') setIndex((current + 1) % images.length)
    if (event.key === 'ArrowLeft') setIndex((current - 1 + images.length) % images.length)
  }

  return (
    <div className="wl-gallery" tabIndex={images.length > 1 ? 0 : undefined} onKeyDown={onKeyDown}>
      <div className={`wl-hero ${images.length ? '' : 'wl-gallery-empty'}`}>
        {images.length ? (
          <img src={imageUrl(images[current])} alt="" />
        ) : (
          <div className="wl-gallery-placeholder">
            <KindSquare type={type} size={40} />
            <span className="wl-mono">Bilde mangler</span>
          </div>
        )}
        {images.length > 1 && <span className="wl-gallery-counter">{current + 1} / {images.length}</span>}
        {children}
      </div>
      {images.length > 1 && (
        <div className="wl-gallery-thumbs">
          {images.map((img, i) => (
            <button key={img} type="button" className={`wl-gallery-thumb ${i === current ? 'on' : ''}`} onClick={() => setIndex(i)} aria-label={`Bilde ${i + 1}`}>
              <img src={imageUrl(img)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

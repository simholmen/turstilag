import React, { useState } from 'react'

export default function Sidebar({ feature, isOpen, onClose, selectedHubLayer, isCollapsed, onCollapse }) {
  if (!isOpen || !feature) return null

  const { properties } = feature
  const firstImage = properties?.images?.[0]

  const handleClose = () => {
    if (selectedHubLayer) selectedHubLayer.fire('click')
    onClose()
  }

  return (
    <div className={`sidebar ${isOpen ? 'open' : ''} ${isCollapsed ? 'collapsed' : ''}`}>
      {isCollapsed && (
        <button className="collapse-btn-float" onClick={onCollapse}>
          ▶
        </button>
      )}
      {!isCollapsed && (
        <>
          <button className="close-btn-float" onClick={handleClose}>✕</button>
          <button className="collapse-btn-float" onClick={onCollapse}>◀</button>

          {firstImage && (
            <div className="sidebar-hero">
              <img src={firstImage} alt={properties?.title} />
            </div>
          )}

          <div className="sidebar-content">
            <h1 className="sidebar-title">{properties?.title}</h1>

            {properties?.description && (
              <div className="sidebar-description">
                <p>{properties.description}</p>
              </div>
            )}

            {(properties?.relatedPois?.length > 0 || properties?.includes) && (
              <div className="sidebar-meta">
                {properties?.relatedPois?.length > 0 && (
                  <div className="meta-item">
                    <span className="meta-label">Sist arbeid:</span>
                    <span className="meta-value">
                      {properties?.relatedPois?.[0]?.properties?.lastUpdated || "Usikkert"}
                    </span>
                  </div>
                )}
                {properties?.includes && (
                  <div className="meta-item">
                    <span className="meta-label">Inkluderer:</span>
                    <span className="meta-value">{properties.includes}</span>
                  </div>
                )}
              </div>
            )}

            {properties?.relatedTrails?.length > 0 && (
              <div className="sidebar-trails">
                <h3>Stier</h3>
                {properties.relatedTrails.map((trail, idx) => (
                  <div key={idx} style={{ marginBottom: '8px', fontSize: '14px' }}>
                    <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: trail.properties?.color, borderRadius: '2px', marginRight: '8px' }}></span>
                    {trail.properties?.title}
                  </div>
                ))}
              </div>
            )}

            {properties?.relatedPois?.length > 0 && (
              <div className="sidebar-pois">
                <h3>Siste Oppdateringer</h3>
                {properties.relatedPois.map((poi, idx) => (
                  <div key={idx} style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #eee' }}>
                    <h4 style={{ marginBottom: '4px' }}>{poi.properties?.title}</h4>
                    {poi.properties?.lastUpdated && (
                      <p style={{ fontSize: '12px', color: '#666' }}>{poi.properties.lastUpdated}</p>
                    )}
                    {poi.properties?.description && <p>{poi.properties.description}</p>}
                    {poi.properties?.images?.length > 0 && (
                      <div className="img-grid">
                        {poi.properties.images.map((img, imgIdx) => (
                          <img key={imgIdx} src={img} alt={`POI ${idx} ${imgIdx}`} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {properties?.relatedPois?.some(poi => poi.properties?.images?.length > 0) && (
              <div className="sidebar-gallery">
                <h3>Alle Bilder</h3>
                <div className="img-grid">
                  {properties.relatedPois.flatMap(poi => poi.properties?.images || []).map((img, idx) => (
                    <img key={idx} src={img} alt={`Gallery ${idx + 1}`} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
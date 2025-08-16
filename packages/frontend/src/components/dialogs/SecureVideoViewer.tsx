import React, { useState, useEffect, useRef } from 'react'
import Dialog from '../Dialog'
import { IconButton } from '../Icon'
import { getLogger } from '../../../../shared/logger'
import useTranslationFunction from '../../hooks/useTranslationFunction'

import type { DialogProps } from '../../contexts/DialogContext'

const log = getLogger('renderer/secure_video_viewer')

type Props = {
  filePath: string
  fileName: string
}

export default function SecureVideoViewer(props: Props & DialogProps) {
  const { filePath, fileName, onClose } = props
  const tx = useTranslationFunction()
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    loadVideo()
  }, [filePath])

  const loadVideo = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Create a file URL for the video
      const url = `file://${filePath}`
      log.info('Loading video in secure viewer', { filePath, url })
      
      setVideoUrl(url)
      setLoading(false)
    } catch (err) {
      log.error('Failed to load video', err)
      setError(tx('error_loading_video'))
      setLoading(false)
    }
  }

  const handleVideoLoad = () => {
    setLoading(false)
    log.info('Video loaded successfully', { videoUrl })
  }

  const handleVideoError = () => {
    log.error('Video failed to load', { videoUrl })
    setError(tx('error_loading_video'))
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent copy shortcuts
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'a')) {
      e.preventDefault()
    }
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
  }

  return (
    <Dialog onClose={onClose} className='secure-video-viewer'>
      <div className='secure-video-viewer-header'>
        <h2>{fileName}</h2>
        <IconButton icon='cross' onClick={onClose} aria-label={tx('close')} />
      </div>
      
      <div 
        className='secure-video-viewer-content'
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {loading && (
          <div className='video-loading-overlay'>
            <div className='video-loading-spinner'></div>
            <span>{tx('loading_video')}</span>
          </div>
        )}

        {error && (
          <div className='video-error-overlay'>
            <div className='error-content'>
                              <IconButton icon='cross' size={48} aria-label={tx('error')} />
              <h3>{tx('error_loading_video')}</h3>
              <p>{error}</p>
              <button onClick={loadVideo} className='retry-button'>
                {tx('retry')}
              </button>
            </div>
          </div>
        )}

        {!error && (
          <div className='video-container'>
            <video
              ref={videoRef}
              src={videoUrl || ''}
              className='secure-video'
              onLoadedData={handleVideoLoad}
              onError={handleVideoError}
              onContextMenu={handleContextMenu}
              onDragStart={(e) => e.preventDefault()}
              onDrop={(e) => e.preventDefault()}
              controls
              autoPlay
              muted
              preload="metadata"
              style={{
                userSelect: 'none',
                WebkitUserSelect: 'none',
                MozUserSelect: 'none',
                msUserSelect: 'none',
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                backgroundColor: '#000'
              }}
            />
          </div>
        )}
      </div>
      
      <div className='secure-video-viewer-footer'>
        <div className='secure-notice'>
                      <IconButton icon='info' size={16} aria-label={tx('secure_viewer_notice')} />
          <span>{tx('secure_viewer_notice')}</span>
        </div>
      </div>
    </Dialog>
  )
} 
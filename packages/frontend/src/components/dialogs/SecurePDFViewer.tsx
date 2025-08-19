import React, { useEffect, useRef, useState, useCallback } from 'react'

import Dialog from '../Dialog'
import { IconButton } from '../Icon'
import { getLogger } from '../../../../shared/logger'
import { useInitEffect } from '../helpers/hooks'
import useTranslationFunction from '../../hooks/useTranslationFunction'

import type { DialogProps } from '../../contexts/DialogContext'

const log = getLogger('renderer/secure_pdf_viewer')

// PDF.js types
interface PDFDocumentProxy {
  numPages: number
  getPage(pageNumber: number): Promise<PDFPageProxy>
}

interface PDFPageProxy {
  getViewport(params: { scale: number }): PDFPageViewport
  render(params: PDFRenderParams): PDFRenderTask
}

interface PDFPageViewport {
  width: number
  height: number
  scale: number
}

interface PDFRenderParams {
  canvasContext: CanvasRenderingContext2D
  viewport: PDFPageViewport
}

interface PDFRenderTask {
  promise: Promise<void>
}

type Props = {
  filePath: string
  fileName: string
}

export default function SecurePDFViewer(props: Props & DialogProps) {
  const { filePath, fileName, onClose } = props
  const tx = useTranslationFunction()
  
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [scale, setScale] = useState(1.5)
  const [pageLoading, setPageLoading] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Load PDF document
  const loadPDF = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Ensure we're in a browser environment
      if (typeof window === 'undefined') {
        throw new Error('PDF viewer requires a browser environment')
      }
      
      // Check if pdfjs-dist is available
      let pdfjsLib
      try {
        // Use dynamic import for browser environment
        pdfjsLib = await import('pdfjs-dist/build/pdf.mjs')
      } catch (importError) {
        // Fallback to legacy build if needed
        try {
          pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js')
        } catch (legacyError) {
          throw new Error('PDF.js library is not available. Please ensure pdfjs-dist is installed.')
        }
      }
      
      // Set worker source - try multiple approaches
      try {
        // First, try to disable worker and use main thread
        pdfjsLib.GlobalWorkerOptions.workerSrc = false
        log.info('PDF.js worker disabled, using main thread')
      } catch (error) {
        log.warn('Failed to disable PDF.js worker', error)
        
        // Fallback: try blob URL approach
        try {
          const workerPath = 'pdf.worker.min.mjs'
          log.info('Loading PDF.js worker file', { workerPath })
          
          const workerResponse = await fetch(workerPath)
          if (!workerResponse.ok) {
            throw new Error(`Worker file not accessible: ${workerResponse.status}`)
          }
          
          const workerBlob = await workerResponse.blob()
          const workerBlobUrl = URL.createObjectURL(workerBlob)
          
          pdfjsLib.GlobalWorkerOptions.workerSrc = workerBlobUrl
          log.info('PDF.js worker source set to blob URL', { 
            workerBlobUrl,
            blobSize: workerBlob.size 
          })
        } catch (blobError) {
          log.warn('Failed to set PDF.js worker blob URL', blobError)
          // Final fallback to CDN with matching version
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
          log.info('Using CDN fallback for PDF.js worker', { version: pdfjsLib.version })
        }
      }
      
      // Validate file path
      if (!filePath || typeof filePath !== 'string') {
        throw new Error('Invalid file path provided')
      }
      
      // Load the PDF document
      log.info('Starting PDF load', { 
        filePath, 
        workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc,
        pdfjsVersion: pdfjsLib.version 
      })
      
      let loadingTask
      let pdfDoc
      
      try {
        loadingTask = pdfjsLib.getDocument(filePath)
        log.info('PDF loading task created successfully')
        
        pdfDoc = await loadingTask.promise
        log.info('PDF document loaded successfully')
      } catch (pdfError) {
        log.error('Failed to load PDF document', pdfError)
        throw new Error(`PDF loading failed: ${pdfError.message}`)
      }
      
      setPdf(pdfDoc)
      setTotalPages(pdfDoc.numPages)
      setCurrentPage(1)
      setLoading(false)
      
      log.info('PDF loaded successfully', { pages: pdfDoc.numPages, filePath })
    } catch (err) {
      log.error('Failed to load PDF', err)
      const errorMessage = err instanceof Error ? err.message : 'Failed to load PDF'
      
      // Provide more specific error messages for common issues
      if (errorMessage.includes('pdfjs-dist')) {
        setError('PDF.js library is not available. Please check your installation.')
      } else if (errorMessage.includes('worker')) {
        setError('PDF.js worker could not be loaded. Please check your internet connection.')
      } else if (errorMessage.includes('API version') && errorMessage.includes('worker version')) {
        setError('PDF.js version mismatch detected. Please restart the application to fix this issue.')
      } else if (errorMessage.includes('Invalid file path')) {
        setError('The PDF file path is invalid or the file does not exist.')
      } else {
        setError(errorMessage)
      }
      
      setLoading(false)
    }
  }, [filePath])

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current) return
    
    try {
      setPageLoading(true)
      
      const page = await pdf.getPage(currentPage)
      const viewport = page.getViewport({ scale })
      
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      if (!context) {
        throw new Error('Failed to get canvas context')
      }
      
      // Set canvas dimensions
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      // Render the page
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise
      
      log.debug('Page rendered successfully', { page: currentPage, scale })
      setPageLoading(false)
    } catch (err) {
      log.error('Failed to render page', err)
      setError(err instanceof Error ? err.message : 'Failed to render page')
      setPageLoading(false)
    }
  }, [pdf, currentPage, scale])

  // Load PDF on mount
  useInitEffect(() => {
    loadPDF()
  }, [loadPDF])

  // Security: Prevent context menu on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      const preventContextMenu = (e: Event) => {
        e.preventDefault()
        return false
      }
      
      canvas.addEventListener('contextmenu', preventContextMenu)
      
      return () => {
        canvas.removeEventListener('contextmenu', preventContextMenu)
      }
    }
  }, [pdf])

  // Security: Prevent keyboard shortcuts for copying
  useEffect(() => {
    const preventCopyShortcuts = (e: KeyboardEvent) => {
      // Prevent Ctrl+C, Cmd+C, Ctrl+A, Cmd+A
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'a')) {
        e.preventDefault()
        return false
      }
    }
    
    document.addEventListener('keydown', preventCopyShortcuts)
    
    return () => {
      document.removeEventListener('keydown', preventCopyShortcuts)
    }
  }, [])

  // Re-render when page or scale changes
  useEffect(() => {
    if (pdf) {
      renderPage()
    }
  }, [renderPage])

  // Navigation functions
  const goToPreviousPage = useCallback(() => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
    }
  }, [currentPage])

  const goToNextPage = useCallback(() => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1)
    }
  }, [currentPage, totalPages])

  const goToFirstPage = useCallback(() => {
    setCurrentPage(1)
  }, [])

  const goToLastPage = useCallback(() => {
    setCurrentPage(totalPages)
  }, [totalPages])

  const goToPage = useCallback((pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber)
    }
  }, [totalPages])

  const zoomIn = useCallback(() => {
    setScale(prev => {
      const newScale = Math.min(prev + 0.25, 3)
      log.info('Zoom in', { prevScale: prev, newScale })
      return newScale
    })
  }, [])

  const zoomOut = useCallback(() => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.25, 0.5)
      log.info('Zoom out', { prevScale: prev, newScale })
      return newScale
    })
  }, [])

  const resetZoom = useCallback(() => {
    setScale(1)
  }, [])



  if (loading) {
    return (
      <Dialog onClose={onClose} className='secure-pdf-viewer-dialog'>
        <div className='secure-pdf-viewer-loading'>
          <div className='loading-spinner'></div>
          <p>{tx('loading_pdf')}</p>
        </div>
      </Dialog>
    )
  }

  if (error) {
    return (
      <Dialog onClose={onClose} className='secure-pdf-viewer-dialog'>
        <div className='secure-pdf-viewer-error'>
          <IconButton icon='cross' size={48} aria-label={tx('error_loading_pdf')} />
          <h3>{tx('error_loading_pdf')}</h3>
          <p>{error}</p>
          <button onClick={loadPDF} className='retry-button'>
            {tx('retry')}
          </button>
        </div>
      </Dialog>
    )
  }

  return (
    <Dialog onClose={onClose} className='secure-pdf-viewer-dialog'>
      <div className='secure-pdf-viewer-header'>
        <div className='secure-pdf-viewer-title'>
          <h2>{fileName}</h2>
          <span className='page-info'>
            {tx('page_info', [currentPage.toString(), totalPages.toString()])}
          </span>
        </div>
        
        <IconButton
          icon='cross'
          onClick={onClose}
          aria-label={tx('close')}
        />
      </div>
      
            <div className='secure-pdf-viewer-content'>
        {pageLoading && (
          <div className='page-loading-overlay'>
            <div className='page-loading-spinner'></div>
            <span>{tx('loading_page')}</span>
          </div>
        )}
        
        <div className='pdf-page-container'>
          <canvas
            ref={canvasRef}
            className='pdf-canvas'
            style={{
              border: '1px solid #ccc',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
              backgroundColor: 'white',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              MozUserSelect: 'none',
              msUserSelect: 'none',
              transform: `scale(${scale})`,
              transformOrigin: 'center center',
              transition: 'transform 0.2s ease'
            }}
            onDragStart={(e) => e.preventDefault()}
            onDrop={(e) => e.preventDefault()}
          />
        </div>
      </div>
      
      {/* Combined controls - compact design */}
      <div className='secure-pdf-viewer-controls-bar'>
        <div className='controls-container'>
          {/* Zoom controls */}
          <div className='zoom-controls'>
            <IconButton
              icon='minus'
              onClick={zoomOut}
              disabled={scale <= 0.5}
              aria-label={tx('zoom_out')}
              size={20}
            />
            <span className='zoom-level'>{Math.round(scale * 100)}%</span>
            <IconButton
              icon='plus'
              onClick={zoomIn}
              disabled={scale >= 3}
              aria-label={tx('zoom_in')}
              size={20}
            />
            <IconButton
              icon='rotate-right'
              onClick={resetZoom}
              aria-label={tx('reset_zoom')}
              size={20}
            />
          </div>
          
          {/* Pagination controls */}
          <div className='pagination-controls'>
            <IconButton
              icon='chevron-left'
              onClick={goToFirstPage}
              disabled={currentPage <= 1}
              aria-label={tx('first_page')}
              size={20}
            />
            
            <IconButton
              icon='chevron-left'
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
              aria-label={tx('previous_page')}
              size={20}
            />
            
            <div className='page-input-container'>
              <input
                type='number'
                min={1}
                max={totalPages}
                value={currentPage}
                onChange={(e) => {
                  const page = parseInt(e.target.value)
                  if (!isNaN(page)) {
                    goToPage(page)
                  }
                }}
                className='page-input'
                aria-label={tx('go_to_page')}
              />
              <span className='page-separator'>/</span>
              <span className='total-pages'>{totalPages}</span>
            </div>
            
            <IconButton
              icon='chevron-right'
              onClick={goToNextPage}
              disabled={currentPage >= totalPages}
              aria-label={tx('next_page')}
              size={20}
            />
            
            <IconButton
              icon='chevron-right'
              onClick={goToLastPage}
              disabled={currentPage >= totalPages}
              aria-label={tx('last_page')}
              size={20}
            />
          </div>
        </div>
      </div>
      
      <div className='secure-pdf-viewer-footer'>
        <div className='secure-notice'>
          <IconButton icon='info' size={16} aria-label={tx('secure_viewer_notice')} />
          <span>{tx('secure_viewer_notice')}</span>
        </div>
      </div>
    </Dialog>
  )
} 
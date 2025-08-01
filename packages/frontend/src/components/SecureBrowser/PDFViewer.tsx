// PDFViewer.tsx
import React, { useEffect, useRef } from 'react';
import { PDFDocumentProxy } from 'pdfjs-dist';

declare global {
  interface Window {
    pdfjsLib: any;
  }
}

const PDFViewer: React.FC<{ filePath: string }> = ({ filePath }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const loadPDF = async () => {
      const pdfjsLib = require('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = window.pdfjsLib.workerSrc;
      
      const loadingTask = pdfjsLib.getDocument(filePath);
      const pdf: PDFDocumentProxy = await loadingTask.promise;
      
      // Get first page
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1.5 });
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const context = canvas.getContext('2d');
      if (!context) return;
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
    };
    
    loadPDF().catch(console.error);
  }, [filePath]);

  return (
    <div className="pdf-viewer">
      <canvas ref={canvasRef} />
    </div>
  );
};

export default PDFViewer;
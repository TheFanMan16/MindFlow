import React, { useCallback, useState, useRef } from 'react';
import { FileText, Loader2, UploadCloud, X } from 'lucide-react';

const PDFUploader = ({ onTextExtracted }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const parsePdf = async (file) => {
    return new Promise((resolve, reject) => {
      // 1. Check for the library
      if (!window.pdfjsLib) {
        reject(new Error("PDF.js library not loaded. Check index.html"));
        return;
      }

      // 2. Sanity Check
      if (!file || file.size === 0) {
        reject(new Error("File size is 0 bytes. Please try a different PDF."));
        return;
      }

      const reader = new FileReader();

      // 3. Read as ArrayBuffer (Crucial for Electron)
      reader.readAsArrayBuffer(file);

      reader.onload = async (e) => {
        try {
          const typedarray = new Uint8Array(e.target.result);

          // 4. Parse
          const loadingTask = window.pdfjsLib.getDocument(typedarray);
          const pdf = await loadingTask.promise;

          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
          }
          resolve(fullText);
        } catch (error) {
          reject(new Error("Parsing failed: " + error.message));
        }
      };

      reader.onerror = () => reject(new Error("File read failed."));
    });
  };

  const extractTextFromPDF = useCallback(async (file) => {
    setIsProcessing(true);
    setError(null);
    setSelectedFile(file); // Store the file for the file card

    try {
      const fullText = await parsePdf(file);
      // Set the extracted text
      onTextExtracted(fullText.trim());
      setIsProcessing(false);
    } catch (err) {
      // Log detailed error for debugging
      console.error('PDF extraction error:', err);
      console.error('Error message:', err.message);
      console.error('Error stack:', err.stack);

      setError(`Failed to extract text from PDF: ${err.message || 'Unknown error'}. Please try another file or paste text manually.`);
      setIsProcessing(false);
      setSelectedFile(null); // Clear file on error
    }
  }, [onTextExtracted]);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setError(null);
    onTextExtracted(''); // Clear extracted text
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onTextExtracted]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    // 1. Grab file INSTANTLY (Sync) - before any async operations
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // 2. Validate Type
    if (file.type === 'application/pdf') {
      // 3. Pass the file object directly to the parser
      await extractTextFromPDF(file);
    } else {
      setError('Please upload a PDF file.');
    }
  }, [extractTextFromPDF]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're actually leaving the drop zone
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragActive(false);
    }
  }, []);

  const handleFileInput = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      extractTextFromPDF(file);
    } else if (file) {
      setError('Please upload a PDF file.');
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [extractTextFromPDF]);

  // Show file card if file is selected
  if (selectedFile && !isProcessing) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4 rounded-card border border-soft bg-subtle px-4 py-3.5">
          {/* PDF icon tile */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input border border-soft bg-elevated">
            <FileText className="h-5 w-5 text-secondary" strokeWidth={1.5} aria-hidden="true" />
          </div>

          {/* Filename + size */}
          <div className="min-w-0 flex-1">
            <div className="truncate text-small font-medium text-primary">{selectedFile.name}</div>
            <div className="mt-0.5 font-mono text-micro tabular-nums text-secondary">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </div>
          </div>

          {/* Remove */}
          <button
            type="button"
            aria-label="Remove file"
            onClick={(e) => {
              e.stopPropagation();
              clearFile();
            }}
            className={[
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-input border border-soft text-secondary',
              'transition-colors duration-150 hover:border-danger-line hover:bg-danger-wash hover:text-danger',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
            ].join(' ')}
          >
            <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div className="rounded-input border border-danger-line bg-danger-wash px-4 py-3 text-small text-danger">
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={isProcessing ? -1 : 0}
      aria-label="Upload a PDF: drag and drop, or activate to browse"
      aria-busy={isProcessing}
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !isProcessing && fileInputRef.current?.click()}
      onKeyDown={(e) => {
        if (!isProcessing && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          fileInputRef.current?.click();
        }
      }}
      className={[
        'flex min-h-[200px] flex-col items-center justify-center rounded-card border border-dashed px-8 py-12 text-center',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
        isDragActive
          ? 'border-accent-line bg-accent-wash'
          : 'border-soft bg-subtle hover:border-strong hover:bg-elevated',
        isProcessing ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      ].join(' ')}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileInput}
        className="hidden"
        disabled={isProcessing}
      />

      {isProcessing ? (
        <>
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-accent motion-reduce:animate-none" strokeWidth={1.5} aria-hidden="true" />
          <div className="text-body text-secondary">Extracting text from PDF...</div>
        </>
      ) : (
        <>
          <UploadCloud
            className={`mb-5 h-12 w-12 transition-colors duration-150 ${isDragActive ? 'text-accent' : 'text-tertiary'}`}
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <div className={`text-body font-medium transition-colors duration-150 ${isDragActive ? 'text-accent' : 'text-primary'}`}>
            {isDragActive ? 'Drop your PDF here' : 'Drag & Drop your Lecture Slides (PDF) here'}
          </div>
          <div className="mt-1 text-small text-secondary">or click to browse</div>
        </>
      )}

      {error && (
        <div className="mt-4 rounded-input border border-danger-line bg-danger-wash px-4 py-3 text-small text-danger">
          {error}
        </div>
      )}
    </div>
  );
};

export default PDFUploader;

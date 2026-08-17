import React, { useCallback, useState, useRef } from 'react';
import { FileText, UploadCloud, X } from 'lucide-react';
import { Button, EmptyState, Progress } from './ui';

/**
 * Client-side PDF text extraction (pdf.js) feeding the blurting flow.
 * State design:
 * - Dropzone: default / hover / dragover / keyboard focus (global ring) /
 *   inert while parsing.
 * - Parsing progress is REAL: pdf.js reports the page count, so the bar
 *   advances page-by-page - an honest fraction, no spinner, no loop.
 * - A parse failure KEEPS the file and renders one sentence plus a Retry
 *   action beside the existing Remove control - never a dead-end message.
 * - A PDF that parses but has no text layer (scanned images) is an EMPTY
 *   result, not an error: EmptyState names the problem and offers the one
 *   action that resolves it.
 * - Focus styling comes from the global :focus-visible rule in index.css;
 *   nothing here re-declares or suppresses it.
 */
const PDFUploader = ({ onTextExtracted }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [emptyExtract, setEmptyExtract] = useState(false); // parsed fine, zero text
  // { page, total } while parsing - drives the honest progress fraction.
  const [parseProgress, setParseProgress] = useState({ page: 0, total: 0 });
  const fileInputRef = useRef(null);

  const parsePdf = async (file, onPageParsed) => {
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

          // 4. Parse page-by-page, reporting the real fraction as we go
          const loadingTask = window.pdfjsLib.getDocument(typedarray);
          const pdf = await loadingTask.promise;

          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
            onPageParsed?.(i, pdf.numPages);
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
    setEmptyExtract(false);
    setSelectedFile(file); // Store the file for the file card
    setParseProgress({ page: 0, total: 0 });

    try {
      const fullText = await parsePdf(file, (page, total) =>
        setParseProgress({ page, total })
      );
      const trimmed = fullText.trim();

      if (!trimmed) {
        // The PDF parsed but carries no text layer (scanned images) - an
        // empty result, not an error. EmptyState below offers the fix.
        setEmptyExtract(true);
        return;
      }

      onTextExtracted(trimmed);
    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('PDF extraction error:', err);
      }
      // KEEP the file so Retry can rerun extraction without re-picking.
      setError(err.message || 'the file could not be read');
    } finally {
      setIsProcessing(false);
    }
  }, [onTextExtracted]);

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setError(null);
    setEmptyExtract(false);
    onTextExtracted(''); // Clear extracted text
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [onTextExtracted]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    // Inert while parsing (preventDefault above still stops the browser
    // from navigating to the dropped file).
    if (isProcessing) return;

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
  }, [extractTextFromPDF, isProcessing]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setIsDragActive(true);
  }, [isProcessing]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setIsDragActive(true);
  }, [isProcessing]);

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

  // Empty result: the PDF parsed cleanly but contains no selectable text.
  if (emptyExtract && selectedFile) {
    return (
      <EmptyState
        icon={<FileText size={18} strokeWidth={1.5} />}
        title={`No selectable text in ${selectedFile.name}`}
        description="Scanned or image-only PDFs carry no text layer - paste the text manually instead."
        action={
          <Button variant="secondary" size="sm" mono onClick={clearFile}>
            Try a different PDF
          </Button>
        }
      />
    );
  }

  // Show file card if file is selected
  if (selectedFile && !isProcessing) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-4 rounded-lg border border-line bg-surface px-4 py-3.5">
          {/* PDF icon tile */}
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-line bg-raised">
            <FileText className="h-5 w-5 text-secondary" strokeWidth={1.5} aria-hidden="true" />
          </div>

          {/* Filename + size */}
          <div className="min-w-0 flex-1">
            <div className="truncate text-body-sm font-medium text-primary">{selectedFile.name}</div>
            <div className="mt-0.5 text-label-sm tabular-nums text-secondary">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </div>
          </div>

          {/* Remove - 32px visual, 40px hit target via the pseudo-element.
              Focus ring comes from the global :focus-visible rule. */}
          <button
            type="button"
            aria-label="Remove file"
            onClick={(e) => {
              e.stopPropagation();
              clearFile();
            }}
            className={[
              'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border border-line text-secondary',
              'transition-colors duration-micro hover:bg-negative-wash hover:text-negative active:bg-active',
              "after:absolute after:-inset-1 after:content-['']",
            ].join(' ')}
          >
            <X className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>

        {/* Per-file error row: one sentence + the one action that resolves
            it (Retry re-runs extraction on the kept file; Remove is above). */}
        {error && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-negative-wash px-4 py-3"
          >
            <p className="text-body-sm text-negative">Couldn't extract text: {error}</p>
            <Button variant="secondary" size="sm" mono onClick={() => extractTextFromPDF(selectedFile)}>
              Try again
            </Button>
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
      aria-disabled={isProcessing || undefined}
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
        'flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed px-8 py-12 text-center',
        'transition-colors duration-micro',
        isDragActive && !isProcessing
          ? 'border-accent-line bg-accent-wash'
          : 'border-line bg-surface',
        // While parsing, the zone goes inert but NOT dimmed - its content
        // is the live progress readout, not disabled chrome.
        isProcessing
          ? 'cursor-default'
          : 'cursor-pointer hover:border-strong hover:bg-hover active:bg-active',
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
        <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
          {/* Real fraction: pdf.js told us the page count. The bg-inset
              wrapper supplies the 2px track behind the accent fill. */}
          <div className="w-full bg-inset">
            <Progress
              value={parseProgress.total ? parseProgress.page / parseProgress.total : 0}
              label="Extracting text"
            />
          </div>
          <div aria-live="polite" className="text-body-sm tabular-nums text-secondary">
            {parseProgress.total
              ? `Extracting text - page ${parseProgress.page} of ${parseProgress.total}`
              : 'Opening PDF…'}
          </div>
        </div>
      ) : (
        <>
          <UploadCloud
            className={`mb-5 h-12 w-12 transition-colors duration-micro ${isDragActive ? 'text-accent' : 'text-tertiary'}`}
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <div className={`text-body font-medium transition-colors duration-micro ${isDragActive ? 'text-accent' : 'text-primary'}`}>
            {isDragActive ? 'Drop your PDF here' : 'Drag & Drop your Lecture Slides (PDF) here'}
          </div>
          <div className="mt-1 text-body-sm text-secondary">or click to browse</div>
        </>
      )}

      {/* Dropzone-level error (no file kept): the zone itself is the
          resolving action - drop or pick a PDF. rounded-md inside the
          rounded-lg zone per the nested-radius rule. */}
      {error && !isProcessing && (
        <div
          role="alert"
          className="mt-4 rounded-md border border-line bg-negative-wash px-4 py-3 text-body-sm text-negative"
        >
          {error}
        </div>
      )}
    </div>
  );
};

export default PDFUploader;

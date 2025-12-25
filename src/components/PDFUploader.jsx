import React, { useCallback, useState, useRef } from 'react';

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
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        <div style={{
          backgroundColor: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '16px 20px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          transition: 'all 0.3s ease',
        }}>
          {/* PDF Icon */}
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg
              style={{
                width: '24px',
                height: '24px',
                stroke: '#ef4444',
                fill: 'none',
                strokeWidth: '2',
              }}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>

          {/* Filename */}
          <div style={{
            flex: 1,
            minWidth: 0,
          }}>
            <div style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#ffffff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {selectedFile.name}
            </div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.5)',
              marginTop: '2px',
            }}>
              {(selectedFile.size / 1024).toFixed(1)} KB
            </div>
          </div>

          {/* Remove Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearFile();
            }}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <svg
              style={{
                width: '18px',
                height: '18px',
                stroke: 'rgba(255, 255, 255, 0.7)',
                fill: 'none',
                strokeWidth: '2',
              }}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#ef4444',
          }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onDrop={handleDrop}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !isProcessing && fileInputRef.current?.click()}
      style={{
        backgroundColor: isDragActive 
          ? 'rgba(59, 130, 246, 0.1)' 
          : 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(10px)',
        borderRadius: '24px',
        padding: '48px 32px',
        border: isDragActive
          ? '2px dashed rgba(59, 130, 246, 0.8)'
          : '2px dashed rgba(255, 255, 255, 0.2)',
        cursor: isProcessing ? 'not-allowed' : 'pointer',
        transition: 'all 0.3s ease',
        textAlign: 'center',
        minHeight: '200px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: isProcessing ? 0.6 : 1,
        boxShadow: isDragActive 
          ? '0 0 30px rgba(59, 130, 246, 0.3)' 
          : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isProcessing && !isDragActive) {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isProcessing && !isDragActive) {
          e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.03)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        onChange={handleFileInput}
        style={{ display: 'none' }}
        disabled={isProcessing}
      />
      
      {isProcessing ? (
        <>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid rgba(168, 85, 247, 0.3)',
            borderTopColor: '#a855f7',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px',
          }} />
          <style>
            {`
              @keyframes spin {
                to { transform: rotate(360deg); }
              }
            `}
          </style>
          <div style={{
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.7)',
            fontWeight: '500',
          }}>
            Extracting text from PDF...
          </div>
        </>
      ) : (
        <>
          <svg
            style={{
              width: '64px',
              height: '64px',
              stroke: isDragActive ? '#3b82f6' : 'rgba(255, 255, 255, 0.5)',
              fill: 'none',
              strokeWidth: '1.5',
              marginBottom: '20px',
              transform: isDragActive ? 'scale(1.1)' : 'scale(1)',
              transition: 'all 0.3s ease',
            }}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
          </svg>
          <div style={{
            fontSize: '18px',
            fontWeight: '600',
            color: isDragActive ? '#3b82f6' : '#ffffff',
            marginBottom: '8px',
            transition: 'color 0.3s ease',
          }}>
            {isDragActive ? 'Drop your PDF here' : 'Drag & Drop your Lecture Slides (PDF) here'}
          </div>
          <div style={{
            fontSize: '14px',
            color: 'rgba(255, 255, 255, 0.5)',
          }}>
            or click to browse
          </div>
        </>
      )}

      {error && (
        <div style={{
          marginTop: '16px',
          padding: '12px 16px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#ef4444',
        }}>
          {error}
        </div>
      )}
    </div>
  );
};

export default PDFUploader;


import React, { useState, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { saveGeneratedDeck } from '../utils/deckUtils';
import { Sparkles } from 'lucide-react';
import config from '../config/api';
import { getAuthHeader } from '../utils/authHeader';
import { aiFetch, AiTimeoutError, AiCancelledError, AI_TIMEOUT_MESSAGE } from '../utils/aiFetch';
import { downloadAnkiCsv } from '../utils/ankiExport';
import AiLoadingIndicator from './AiLoadingIndicator';
import UpgradeModal from './UpgradeModal';

const GENERATE_STATUS_MESSAGES = [
  'Reading your material…',
  'Picking out the key concepts…',
  'Writing questions and answers…',
  'Assembling your deck…',
];

const PDFToFlashcardUploader = ({ onFlashcardsGenerated, onDeckSaved }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' or 'paste'
  const [file, setFile] = useState(null);
  const [pastedText, setPastedText] = useState(''); // Text content for paste mode
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [generatedCards, setGeneratedCards] = useState(null); // Store generated cards for preview
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [deckTitle, setDeckTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [revealedCards, setRevealedCards] = useState(new Set()); // Track which cards have revealed answers
  const [editingCardIndex, setEditingCardIndex] = useState(null); // Track which card is being edited
  const [editingCardData, setEditingCardData] = useState(null); // Store temporary edit data
  const [timedOut, setTimedOut] = useState(false); // Offer a retry after a cold-start timeout
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeMessage, setUpgradeMessage] = useState(null);
  const fileInputRef = useRef(null);
  const abortRef = useRef(null);

  const cancelGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Handle Upload: Validate and send PDF to backend
  const handleUpload = useCallback(async (uploadedFile) => {
    // Validation: Check if file is PDF and < 5MB
    if (!uploadedFile) {
      setError('Please select a PDF file');
      return;
    }

    if (uploadedFile.type !== 'application/pdf' && !uploadedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file');
      return;
    }

    const maxSize = 5 * 1024 * 1024; // 5MB
    if (uploadedFile.size > maxSize) {
      setError('File size must be less than 5MB');
      return;
    }

    if (!user?.id) {
      setError('Please log in to generate flashcards');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTimedOut(false);
    setFile(uploadedFile);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // API Call: Use FormData to send the file
      const formData = new FormData();
      formData.append('pdf', uploadedFile);

      const response = await aiFetch(`${config.api.baseUrl}/api/generate-from-pdf`, {
        method: 'POST',
        // The backend spends AI quota against this token, not a body field.
        // Content-Type is left unset so the browser adds the multipart boundary.
        headers: await getAuthHeader(),
        body: formData,
      }, { signal: controller.signal });

      if (response.status === 403) {
        // Limit reached (PDF credits or daily AI) - graceful paywall, not a
        // raw error toast.
        const errorData = await response.json().catch(() => ({}));
        setUpgradeMessage(errorData.error || null);
        setShowUpgradeModal(true);
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const result = await response.json();

      // On Success: Receive the array of { front, back } cards
      if (!result.flashcards || !Array.isArray(result.flashcards)) {
        throw new Error('Invalid response format from server');
      }

      // Validate flashcards have front and back
      const validCards = result.flashcards.filter(
        card => card && card.front && card.back && card.front.trim() && card.back.trim()
      );

      if (validCards.length === 0) {
        throw new Error('No valid flashcards generated');
      }

      // Store generated cards for preview
      setGeneratedCards(validCards);

      // Call existing 'Deck Creation' logic (for immediate review if needed)
      if (onFlashcardsGenerated) {
        onFlashcardsGenerated(validCards);
      }

      // Show success toast
      toast.success(`Deck Generated Successfully! Created ${validCards.length} flashcards.`);
      
      // Don't clear file yet - show preview first
    } catch (err) {
      if (err instanceof AiCancelledError) {
        // The user hit Cancel - reset quietly.
        setFile(null);
        return;
      }
      if (err instanceof AiTimeoutError) {
        // Keep the file around so Retry can resend it without re-picking.
        setError(AI_TIMEOUT_MESSAGE);
        setTimedOut(true);
        return;
      }
      if (import.meta.env.DEV) {
        console.error('PDF to Flashcard error:', err);
      }
      const errorMessage = err.message || 'Failed to generate flashcards from PDF';
      setError(errorMessage);
      toast.error(errorMessage);
      setFile(null);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [user, onFlashcardsGenerated]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    const uploadedFile = e.dataTransfer.files?.[0];
    if (uploadedFile) {
      handleUpload(uploadedFile);
    }
  }, [handleUpload]);

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
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragActive(false);
    }
  }, []);

  const handleFileInput = useCallback((e) => {
    const uploadedFile = e.target.files?.[0];
    if (uploadedFile) {
      handleUpload(uploadedFile);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [handleUpload]);

  // Handle text-based flashcard generation
  const handleGenerateFromText = useCallback(async () => {
    if (!pastedText.trim()) {
      setError('Please paste some text to generate flashcards');
      return;
    }

    if (!user?.id) {
      setError('Please log in to generate flashcards');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTimedOut(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // API Call: Send text to backend
      const response = await aiFetch(`${config.api.baseUrl}/api/generate-from-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // The backend spends AI quota against this token, not a body field.
          ...(await getAuthHeader()),
        },
        body: JSON.stringify({
          text: pastedText.trim(),
        }),
      }, { signal: controller.signal });

      if (response.status === 403) {
        const errorData = await response.json().catch(() => ({ error: 'Limit Reached' }));
        const errorMessage = errorData.error || 'Limit Reached';
        
        if (errorMessage.includes('Free limit reached') || errorMessage.includes('Upgrade to Pro')) {
          toast.error('You have used your 3 free credits. Upgrade for unlimited study.', {
            duration: 5000,
            style: {
              background: '#1f2937',
              color: '#fff',
              border: '1px solid #ef4444',
            },
            icon: '🔒',
          });
          setError('You have used your 3 free PDF upload credits this month. Upgrade to Pro for unlimited study.');
        } else {
          toast.error(errorMessage || 'Daily AI Limit Reached (5/5). Upgrade to Pro for unlimited.');
          setError(errorMessage || 'Daily AI Limit Reached');
        }
        
        setIsLoading(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      const result = await response.json();

      // On Success: Receive the array of { front, back } cards
      if (!result.flashcards || !Array.isArray(result.flashcards)) {
        throw new Error('Invalid response format from server');
      }

      // Validate flashcards have front and back
      const validCards = result.flashcards.filter(
        card => card && card.front && card.back && card.front.trim() && card.back.trim()
      );

      if (validCards.length === 0) {
        throw new Error('No valid flashcards generated');
      }

      // Store generated cards for preview
      setGeneratedCards(validCards);

      // Call existing 'Deck Creation' logic (for immediate review if needed)
      if (onFlashcardsGenerated) {
        onFlashcardsGenerated(validCards);
      }

      // Show success toast
      toast.success(`Deck Generated Successfully! Created ${validCards.length} flashcards.`);
      
    } catch (err) {
      if (err instanceof AiCancelledError) {
        return;
      }
      if (err instanceof AiTimeoutError) {
        setError(AI_TIMEOUT_MESSAGE);
        setTimedOut(true);
        return;
      }
      if (import.meta.env.DEV) {
        console.error('Text to Flashcard error:', err);
      }
      const errorMessage = err.message || 'Failed to generate flashcards from text';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
      abortRef.current = null;
    }
  }, [pastedText, user, onFlashcardsGenerated]);

  const clearFile = useCallback(() => {
    setFile(null);
    setPastedText('');
    setError(null);
    setTimedOut(false);
    setGeneratedCards(null);
    setShowSaveModal(false);
    setDeckTitle('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Handle Save to Library
  const handleSaveToLibrary = useCallback(async () => {
    if (!generatedCards || generatedCards.length === 0) {
      toast.error('No flashcards to save');
      return;
    }

    if (!user?.id) {
      toast.error('Please log in to save flashcards');
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveGeneratedDeck(generatedCards, deckTitle, user.id);

      if (result.success) {
        toast.success(`Deck saved successfully! ${result.cardCount} flashcards added to your library.`);
        
        // Clear state
        setGeneratedCards(null);
        setFile(null);
        setShowSaveModal(false);
        setDeckTitle('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }

        // Notify parent component that deck was saved
        if (onDeckSaved) {
          onDeckSaved();
        }
      } else {
        throw new Error(result.error || 'Failed to save deck');
      }
    } catch (err) {
      console.error('Save deck error:', err);
      toast.error(err.message || 'Failed to save deck. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [generatedCards, deckTitle, user]);

  // Show preview and save modal
  const handleShowSaveModal = useCallback(() => {
    setShowSaveModal(true);
  }, []);

  // Toggle reveal for a specific card
  const toggleReveal = useCallback((index) => {
    setRevealedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  // Start editing a card
  const startEditing = useCallback((index, e) => {
    e.stopPropagation(); // Prevent card click
    setEditingCardIndex(index);
    setEditingCardData({
      front: generatedCards[index].front || generatedCards[index].question || '',
      back: generatedCards[index].back || generatedCards[index].answer || '',
    });
  }, [generatedCards]);

  // Save edits to a card
  const saveEdit = useCallback((index) => {
    if (!editingCardData) return;
    
    setGeneratedCards(prevCards => {
      const updatedCards = [...prevCards];
      updatedCards[index] = {
        ...updatedCards[index],
        front: editingCardData.front.trim(),
        back: editingCardData.back.trim(),
      };
      return updatedCards;
    });
    
    setEditingCardIndex(null);
    setEditingCardData(null);
  }, [editingCardData]);

  // Cancel editing
  const cancelEdit = useCallback(() => {
    setEditingCardIndex(null);
    setEditingCardData(null);
  }, []);

  // Export to Anki (CSV format)
  const handleExportToAnki = useCallback(() => {
    if (!generatedCards || generatedCards.length === 0) {
      toast.error('No flashcards to export');
      return;
    }

    downloadAnkiCsv(generatedCards, deckTitle || 'flashcards');
    toast.success('Exported! Import this file into Anki.');
  }, [generatedCards, deckTitle]);

  // Rendered in every branch - a limit can be hit from upload or paste.
  const upgradeModal = (
    <UpgradeModal
      isOpen={showUpgradeModal}
      onClose={() => setShowUpgradeModal(false)}
      message={upgradeMessage}
    />
  );

  // Show preview section if cards are generated
  if (generatedCards && generatedCards.length > 0) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
        paddingBottom: '100px', // Space for sticky footer
      }}>
        {/* Preview Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '16px',
          marginBottom: '24px',
        }}>
          <div>
            <div style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#ffffff',
              marginBottom: '4px',
            }}>
              ✅ {generatedCards.length} Flashcards Generated
            </div>
            <div style={{
              fontSize: '14px',
              color: 'rgba(255, 255, 255, 0.6)',
            }}>
              Click each card to reveal the answer (Active Recall Study Method)
            </div>
          </div>
          <button
            onClick={clearFile}
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
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
            Start Over
          </button>
        </div>

        {/* Drafting Table Grid - All Cards */}
        <div style={{
          backgroundColor: 'rgba(17, 24, 39, 0.5)', // bg-gray-900/50
          padding: '24px',
          borderRadius: '16px', // rounded-2xl
          marginBottom: '100px', // Space for sticky footer
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}>
            {generatedCards.map((card, index) => {
              const isEditing = editingCardIndex === index;
              const cardData = isEditing ? editingCardData : card;
              
              return (
                <div
                  key={index}
                  style={{
                    backgroundColor: '#1f2937', // bg-gray-800
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '16px',
                    position: 'relative',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isEditing) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isEditing) {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    }
                  }}
                >
                  {/* Pencil Edit Icon */}
                  {!isEditing && (
                    <button
                      onClick={(e) => startEditing(index, e)}
                      style={{
                        position: 'absolute',
                        top: '12px',
                        right: '12px',
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        border: 'none',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'rgba(255, 255, 255, 0.6)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        zIndex: 10,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                      }}
                    >
                      <svg style={{ width: '16px', height: '16px', stroke: 'currentColor', fill: 'none', strokeWidth: '2' }} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                  )}

                  {isEditing ? (
                    // Edit Mode: Show textareas
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: 'rgba(255, 255, 255, 0.7)',
                          marginBottom: '6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}>
                          Question
                        </label>
                        <textarea
                          value={editingCardData?.front || ''}
                          onChange={(e) => setEditingCardData(prev => ({ ...prev, front: e.target.value }))}
                          style={{
                            width: '100%',
                            minHeight: '80px',
                            padding: '10px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontSize: '14px',
                            fontWeight: '600',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            outline: 'none',
                          }}
                          placeholder="Question..."
                        />
                      </div>
                      <div>
                        <label style={{
                          display: 'block',
                          fontSize: '12px',
                          fontWeight: '600',
                          color: 'rgba(255, 255, 255, 0.7)',
                          marginBottom: '6px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}>
                          Answer
                        </label>
                        <textarea
                          value={editingCardData?.back || ''}
                          onChange={(e) => setEditingCardData(prev => ({ ...prev, back: e.target.value }))}
                          style={{
                            width: '100%',
                            minHeight: '80px',
                            padding: '10px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '8px',
                            color: '#ffffff',
                            fontSize: '14px',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            outline: 'none',
                          }}
                          placeholder="Answer..."
                        />
                      </div>
                      <div style={{
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'flex-end',
                      }}>
                        <button
                          onClick={cancelEdit}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            color: 'rgba(255, 255, 255, 0.7)',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => saveEdit(index)}
                          style={{
                            padding: '6px 12px',
                            background: 'linear-gradient(90deg, #22c55e, #10b981)',
                            border: 'none',
                            borderRadius: '6px',
                            color: '#ffffff',
                            fontSize: '12px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode: Show card content
                    <>
                      {/* Question (Front) */}
                      <div style={{
                        marginBottom: '12px',
                      }}>
                        <div style={{
                          fontSize: '14px',
                          fontWeight: '700',
                          color: '#ffffff',
                          lineHeight: '1.5',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          wordBreak: 'break-word',
                        }}>
                          {card.front || card.question}
                        </div>
                      </div>

                      {/* Answer (Back) */}
                      <div style={{
                        paddingTop: '12px',
                        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                      }}>
                        <div style={{
                          fontSize: '13px',
                          fontWeight: '400',
                          color: 'rgba(255, 255, 255, 0.6)',
                          lineHeight: '1.5',
                          display: '-webkit-box',
                          WebkitLineClamp: 4,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          wordBreak: 'break-word',
                        }}>
                          {card.back || card.answer}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sticky Action Bar Footer */}
        <div style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: 'rgba(17, 24, 39, 0.95)', // bg-gray-900 with opacity
          backdropFilter: 'blur(10px)',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '20px 24px',
          display: 'flex',
          gap: '16px',
          justifyContent: 'center',
          zIndex: 100,
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.3)',
        }}>
          <button
            onClick={handleExportToAnki}
            disabled={isSaving}
            style={{
              padding: '14px 28px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              color: 'rgba(255, 255, 255, 0.8)',
              fontSize: '16px',
              fontWeight: '600',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              opacity: isSaving ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              if (!isSaving) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaving) {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }
            }}
          >
            <svg style={{ width: '20px', height: '20px', stroke: 'currentColor', fill: 'none', strokeWidth: '2' }} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            Export to Anki
          </button>
          <button
            onClick={handleShowSaveModal}
            disabled={isSaving || editingCardIndex !== null}
            style={{
              padding: '14px 32px',
              background: 'linear-gradient(90deg, #22c55e, #10b981)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: (isSaving || editingCardIndex !== null) ? 'not-allowed' : 'pointer',
              transition: 'all 0.3s ease',
              opacity: (isSaving || editingCardIndex !== null) ? 0.5 : 1,
              boxShadow: '0 4px 20px rgba(34, 197, 94, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              if (!isSaving && editingCardIndex === null) {
                e.currentTarget.style.transform = 'scale(1.05)';
                e.currentTarget.style.boxShadow = '0 6px 25px rgba(34, 197, 94, 0.4)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSaving && editingCardIndex === null) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(34, 197, 94, 0.3)';
              }
            }}
          >
            <svg style={{ width: '20px', height: '20px', stroke: 'currentColor', fill: 'none', strokeWidth: '2' }} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
            Save to Library
          </button>
        </div>

        {/* Fade-in animation style */}
        <style>
          {`
            @keyframes fadeIn {
              from {
                opacity: 0;
                transform: translateY(10px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `}
        </style>

        {/* Save Modal */}
        {showSaveModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              backdropFilter: 'blur(4px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowSaveModal(false);
              }
            }}
          >
            <div
              style={{
                backgroundColor: 'rgba(31, 41, 55, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '32px',
                maxWidth: '500px',
                width: '90%',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: '#ffffff',
                marginBottom: '16px',
              }}>
                Save Deck to Library
              </h2>
              <p style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '24px',
              }}>
                Give your deck a name (or leave blank for default)
              </p>
              <input
                type="text"
                value={deckTitle}
                onChange={(e) => setDeckTitle(e.target.value)}
                placeholder="e.g., Biology Chapter 5"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '16px',
                  marginBottom: '24px',
                  outline: 'none',
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isSaving) {
                    handleSaveToLibrary();
                  }
                }}
                autoFocus
              />
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={() => setShowSaveModal(false)}
                  disabled={isSaving}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveToLibrary}
                  disabled={isSaving}
                  style={{
                    padding: '10px 20px',
                    background: 'linear-gradient(90deg, #22c55e, #10b981)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: isSaving ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    opacity: isSaving ? 0.5 : 1,
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show file card if file is selected
  if (file && !isLoading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {upgradeModal}
        <div style={{
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          backdropFilter: 'blur(10px)',
          borderRadius: '16px',
          padding: '16px 20px',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '8px',
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg
              style={{
                width: '24px',
                height: '24px',
                stroke: '#22c55e',
                fill: 'none',
                strokeWidth: '2',
              }}
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
            </svg>
          </div>
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
              {file.name}
            </div>
            <div style={{
              fontSize: '12px',
              color: 'rgba(255, 255, 255, 0.5)',
              marginTop: '2px',
            }}>
              {(file.size / 1024).toFixed(1)} KB
            </div>
          </div>
          <button
            onClick={clearFile}
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
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}>
            <span style={{ color: timedOut ? 'rgba(255, 255, 255, 0.8)' : '#ef4444' }}>
              {error}
            </span>
            {timedOut && (
              <button
                onClick={() => handleUpload(file)}
                style={{
                  alignSelf: 'flex-start',
                  padding: '8px 20px',
                  background: 'linear-gradient(90deg, #22c55e, #10b981)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                Try Again
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
    }}>
      {upgradeModal}
      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        gap: '12px',
        justifyContent: 'center',
        marginBottom: '8px',
      }}>
        <button
          onClick={() => {
            setActiveTab('upload');
            setError(null);
          }}
          style={{
            background: activeTab === 'upload'
              ? 'rgba(0, 255, 148, 0.1)'
              : 'rgba(255, 255, 255, 0.05)',
            border: activeTab === 'upload'
              ? '1px solid rgba(0, 255, 148, 0.3)'
              : '1px solid rgba(255, 255, 255, 0.1)',
            color: activeTab === 'upload' ? '#00FF94' : 'rgba(255, 255, 255, 0.7)',
            padding: '10px 20px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'upload') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'upload') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }
          }}
        >
          Upload File
        </button>
        <button
          onClick={() => {
            setActiveTab('paste');
            setError(null);
          }}
          style={{
            background: activeTab === 'paste'
              ? 'rgba(0, 255, 148, 0.1)'
              : 'rgba(255, 255, 255, 0.05)',
            border: activeTab === 'paste'
              ? '1px solid rgba(0, 255, 148, 0.3)'
              : '1px solid rgba(255, 255, 255, 0.1)',
            color: activeTab === 'paste' ? '#00FF94' : 'rgba(255, 255, 255, 0.7)',
            padding: '10px 20px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          }}
          onMouseEnter={(e) => {
            if (activeTab !== 'paste') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeTab !== 'paste') {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }
          }}
        >
          Paste Text
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'upload' ? (
        <div
          onDrop={handleDrop}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          style={{
            backgroundColor: isDragActive 
              ? 'rgba(0, 255, 148, 0.1)' 
              : 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '48px 32px',
            border: isDragActive
              ? '2px dashed rgba(0, 255, 148, 0.5)'
              : '2px dashed rgba(255, 255, 255, 0.1)',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            textAlign: 'center',
            minHeight: '200px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: isLoading ? 0.6 : 1,
            boxShadow: isDragActive 
              ? '0 0 30px rgba(0, 255, 148, 0.2)' 
              : 'none',
          }}
          onMouseEnter={(e) => {
            if (!isLoading && !isDragActive) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isLoading && !isDragActive) {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileInput}
            style={{ display: 'none' }}
            disabled={isLoading}
          />
          
          {isLoading ? (
            <AiLoadingIndicator
              messages={GENERATE_STATUS_MESSAGES}
              accent="#00FF94"
              onCancel={cancelGeneration}
            />
          ) : (
            <>
              <svg
                style={{
                  width: '64px',
                  height: '64px',
                  stroke: isDragActive ? '#00FF94' : 'rgba(255, 255, 255, 0.5)',
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
                color: isDragActive ? '#00FF94' : '#ffffff',
                marginBottom: '8px',
                transition: 'color 0.3s ease',
              }}>
                {isDragActive ? 'Drop your PDF here' : 'Drag & Drop your lecture PDF (or click to browse)'}
              </div>
              <div style={{
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.5)',
              }}>
                Max file size: 5MB
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
              maxWidth: '400px',
            }}>
              {error}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
            borderRadius: '16px',
            padding: '24px',
            border: '1px solid rgba(255, 255, 255, 0.1)',
          }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '500',
              color: 'rgba(255, 255, 255, 0.7)',
              marginBottom: '12px',
            }}>
              Paste your notes or summary here...
            </label>
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="Paste your notes or summary here..."
              style={{
                width: '100%',
                minHeight: '300px',
                padding: '20px',
                backgroundColor: 'rgba(10, 10, 10, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px',
                color: '#ffffff',
                fontSize: '15px',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                resize: 'vertical',
                outline: 'none',
                transition: 'border-color 0.2s ease',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'rgba(0, 255, 148, 0.3)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
              }}
            />
          </div>
          
          {isLoading && (
            <div style={{
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}>
              <AiLoadingIndicator
                messages={GENERATE_STATUS_MESSAGES}
                accent="#00FF94"
                onCancel={cancelGeneration}
              />
            </div>
          )}
          <button
            onClick={handleGenerateFromText}
            disabled={isLoading || !pastedText.trim()}
            style={{
              width: '100%',
              padding: '12px 24px',
              backgroundColor: (isLoading || !pastedText.trim()) ? 'rgba(22, 163, 74, 0.5)' : '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: (isLoading || !pastedText.trim()) ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              opacity: (isLoading || !pastedText.trim()) ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            }}
            onMouseEnter={(e) => {
              if (!isLoading && pastedText.trim()) {
                e.currentTarget.style.backgroundColor = '#15803d';
              }
            }}
            onMouseLeave={(e) => {
              if (!isLoading && pastedText.trim()) {
                e.currentTarget.style.backgroundColor = '#16a34a';
              }
            }}
          >
            {isLoading ? (
              <>
                <div style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(255, 255, 255, 0.3)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }} />
                <style>
                  {`
                    @keyframes spin {
                      to { transform: rotate(360deg); }
                    }
                  `}
                </style>
                Generating...
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Generate Deck
              </>
            )}
          </button>

          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              fontSize: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <span style={{ color: timedOut ? 'rgba(255, 255, 255, 0.8)' : '#ef4444' }}>
                {error}
              </span>
              {timedOut && (
                <button
                  onClick={handleGenerateFromText}
                  style={{
                    alignSelf: 'flex-start',
                    padding: '8px 20px',
                    background: 'linear-gradient(90deg, #22c55e, #10b981)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Try Again
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PDFToFlashcardUploader;


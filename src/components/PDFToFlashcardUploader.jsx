import React, { useState, useRef, useCallback, useEffect } from 'react';
import { capture } from '../lib/analytics';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { saveGeneratedDeck } from '../utils/deckUtils';
import { Sparkles, FileText, X, Pencil, Download, Bookmark, Lock } from 'lucide-react';
import config from '../config/api';
import { getAuthHeader } from '../utils/authHeader';
import { aiFetch, AiTimeoutError, AiCancelledError, AI_TIMEOUT_MESSAGE } from '../utils/aiFetch';
import { downloadAnkiCsv } from '../utils/ankiExport';
import UpgradeModal from './UpgradeModal';
import { Button, Card, Field, Input, Textarea, Modal, Badge, Tabs, Progress } from './ui';
import { motion, useReducedMotion, Stagger, shake } from '../motion';

const GENERATE_STATUS_MESSAGES = [
  'Reading your material…',
  'Picking out the key concepts…',
  'Writing questions and answers…',
  'Assembling your deck…',
];

// After this long we level with the user about cold starts instead of
// letting an unexplained progress line erode trust. Mirrors the timing
// contract of the previous AiLoadingIndicator exactly.
const COLD_START_NOTICE_MS = 8000;
const ROTATE_INTERVAL_MS = 3000;

/**
 * Local generation-progress block: thin Progress line that advances per
 * stage, rotating mono status copy, the honest 8s cold-start notice, and a
 * Cancel button wired to the AbortController.
 */
const GenerationStatus = ({ messages, onCancel }) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [showColdStartNotice, setShowColdStartNotice] = useState(false);

  useEffect(() => {
    const rotate = setInterval(
      () => setMessageIndex((i) => i + 1),
      ROTATE_INTERVAL_MS
    );
    const coldStart = setTimeout(
      () => setShowColdStartNotice(true),
      COLD_START_NOTICE_MS
    );
    return () => {
      clearInterval(rotate);
      clearTimeout(coldStart);
    };
  }, []);

  const message = messages[messageIndex % messages.length];
  // Decorative pacing only - the backend reports no real progress, so the
  // line climbs per rotation and parks at 90% until the response lands.
  const progress = Math.min(0.18 + messageIndex * 0.22, 0.9);

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4 px-4 py-8 text-center">
      <Progress value={progress} label="Generating deck" className="w-full" />
      <div aria-live="polite" className="font-mono text-micro uppercase text-secondary">
        {message}
      </div>
      {showColdStartNotice && (
        <p className="max-w-sm text-small text-secondary">
          First request of the day can take up to a minute — we're waking the
          AI up. Hang tight.
        </p>
      )}
      {onCancel && (
        <Button variant="secondary" size="sm" mono onClick={onCancel}>
          Cancel
        </Button>
      )}
    </div>
  );
};

/**
 * Local error block: danger card, softened to secondary text for cold-start
 * timeouts, with an optional Retry action. Keyed shake on new error text.
 */
const ErrorNotice = ({ error, timedOut = false, onRetry }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      key={error}
      animate={reduce ? undefined : shake}
      className="flex w-full flex-col items-start gap-3 rounded-card border border-danger-line bg-danger-wash px-4 py-3 text-left"
    >
      <p className={`text-small ${timedOut ? 'text-secondary' : 'text-danger'}`}>{error}</p>
      {timedOut && onRetry && (
        <Button variant="secondary" size="sm" mono onClick={onRetry}>
          Try again
        </Button>
      )}
    </motion.div>
  );
};

// Multi-line clamps: Tailwind's line-clamp availability is version-dependent,
// so these stay as inline style objects (no colors involved).
const clamp = (lines) => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  wordBreak: 'break-word',
});

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
        capture('quota_hit', { kind: 'pdf_monthly' });
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
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--danger-line)',
            },
            icon: <Lock size={16} strokeWidth={1.5} />,
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
      <div className="relative flex h-full flex-col">
        {/* Preview Header */}
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2.5">
              <Badge variant="success">Generated</Badge>
              <span className="text-body font-medium text-primary">
                <span className="font-mono">{generatedCards.length}</span> flashcards ready
              </span>
            </div>
            <p className="text-small text-secondary">
              Review and edit each card before saving to your library.
            </p>
          </div>
          <Button variant="ghost" size="sm" mono onClick={clearFile}>
            Start over
          </Button>
        </Card>

        {/* Card Preview Grid */}
        <Stagger className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4 pb-6">
          {generatedCards.map((card, index) => {
            const isEditing = editingCardIndex === index;

            return (
              <Stagger.Item key={index}>
                <Card className="relative h-full p-4">
                  {/* Pencil Edit Icon */}
                  {!isEditing && (
                    <button
                      type="button"
                      aria-label={`Edit card ${index + 1}`}
                      onClick={(e) => startEditing(index, e)}
                      className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-input border border-transparent text-secondary transition-colors duration-150 hover:border-soft hover:bg-elevated hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
                    >
                      <Pencil size={14} strokeWidth={1.5} />
                    </button>
                  )}

                  {isEditing ? (
                    // Edit Mode: Show textareas
                    <div className="flex flex-col gap-3">
                      <Field label="Question">
                        <Textarea
                          rows={3}
                          value={editingCardData?.front || ''}
                          onChange={(e) => setEditingCardData(prev => ({ ...prev, front: e.target.value }))}
                          placeholder="Question..."
                        />
                      </Field>
                      <Field label="Answer">
                        <Textarea
                          rows={3}
                          value={editingCardData?.back || ''}
                          onChange={(e) => setEditingCardData(prev => ({ ...prev, back: e.target.value }))}
                          placeholder="Answer..."
                        />
                      </Field>
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={cancelEdit}>
                          Cancel
                        </Button>
                        <Button variant="primary" size="sm" mono onClick={() => saveEdit(index)}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    // View Mode: Show card content
                    <>
                      {/* Question (Front) */}
                      <div className="mb-3 pr-8">
                        <div aria-hidden="true" className="mb-1 font-mono text-micro uppercase text-tertiary">
                          {String(index + 1).padStart(2, '0')}
                        </div>
                        <div className="text-small font-medium leading-5 text-primary" style={clamp(3)}>
                          {card.front || card.question}
                        </div>
                      </div>

                      {/* Answer (Back) */}
                      <div className="border-t border-soft pt-3">
                        <div className="text-small leading-5 text-secondary" style={clamp(4)}>
                          {card.back || card.answer}
                        </div>
                      </div>
                    </>
                  )}
                </Card>
              </Stagger.Item>
            );
          })}
        </Stagger>

        {/* Sticky Action Bar Footer */}
        <div className="sticky bottom-0 z-10 mt-auto border-t border-soft bg-base py-4">
          <div className="flex flex-wrap justify-center gap-3">
            <Button
              variant="secondary"
              size="lg"
              mono
              onClick={handleExportToAnki}
              disabled={isSaving}
            >
              <Download size={16} strokeWidth={1.5} />
              Export to Anki
            </Button>
            <Button
              variant="primary"
              size="lg"
              mono
              magnetic
              onClick={handleShowSaveModal}
              disabled={isSaving || editingCardIndex !== null}
            >
              <Bookmark size={16} strokeWidth={1.5} />
              Save to Library
            </Button>
          </div>
        </div>

        {/* Save Modal */}
        <Modal
          open={showSaveModal}
          onClose={() => setShowSaveModal(false)}
          title="Save deck to library"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setShowSaveModal(false)}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                mono
                onClick={handleSaveToLibrary}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          }
        >
          <Field label="Deck name" hint="Leave blank for a default name.">
            <Input
              type="text"
              value={deckTitle}
              onChange={(e) => setDeckTitle(e.target.value)}
              placeholder="e.g., Biology Chapter 5"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSaving) {
                  handleSaveToLibrary();
                }
              }}
              autoFocus
            />
          </Field>
        </Modal>
      </div>
    );
  }

  // Show file card if file is selected
  if (file && !isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {upgradeModal}
        <Card className="flex items-center gap-4 px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-input bg-accent-wash">
            <FileText size={20} strokeWidth={1.5} className="text-accent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-body font-medium text-primary">
              {file.name}
            </div>
            <div className="mt-0.5 font-mono text-micro uppercase text-secondary">
              {(file.size / 1024).toFixed(1)} KB
            </div>
          </div>
          <button
            type="button"
            aria-label="Remove file"
            onClick={clearFile}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-input border border-soft text-secondary transition-colors duration-150 hover:border-danger-line hover:bg-danger-wash hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </Card>
        {error && (
          <ErrorNotice
            error={error}
            timedOut={timedOut}
            onRetry={() => handleUpload(file)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {upgradeModal}
      {/* Tab Switcher */}
      <div className="flex justify-center">
        <Tabs
          items={[
            { value: 'upload', label: 'Upload file' },
            { value: 'paste', label: 'Paste text' },
          ]}
          value={activeTab}
          onChange={(tab) => {
            setActiveTab(tab);
            setError(null);
          }}
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'upload' ? (
        <div
          role="button"
          tabIndex={isLoading ? -1 : 0}
          aria-label="Upload a PDF"
          aria-disabled={isLoading || undefined}
          onDrop={handleDrop}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => !isLoading && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (!isLoading && (e.key === 'Enter' || e.key === ' ')) {
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
            isLoading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
          ].join(' ')}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            onChange={handleFileInput}
            className="hidden"
            disabled={isLoading}
          />

          {isLoading ? (
            <GenerationStatus
              messages={GENERATE_STATUS_MESSAGES}
              onCancel={cancelGeneration}
            />
          ) : (
            <>
              <FileText
                size={40}
                strokeWidth={1.5}
                aria-hidden="true"
                className={`mb-5 transition-colors duration-150 ${isDragActive ? 'text-accent' : 'text-secondary'}`}
              />
              <div className={`mb-2 text-body font-medium transition-colors duration-150 ${isDragActive ? 'text-accent' : 'text-primary'}`}>
                {isDragActive ? 'Drop your PDF here' : 'Drag & drop your lecture PDF (or click to browse)'}
              </div>
              <div className="text-small text-secondary">
                Max file size: <span className="font-mono">5MB</span>
              </div>
            </>
          )}

          {error && (
            <div className="mt-4 w-full max-w-sm">
              <ErrorNotice error={error} />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <Field label="Notes or summary">
              <Textarea
                rows={12}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Paste your notes or summary here..."
                className="min-h-[300px]"
              />
            </Field>
          </Card>

          {isLoading && (
            <Card className="flex justify-center">
              <GenerationStatus
                messages={GENERATE_STATUS_MESSAGES}
                onCancel={cancelGeneration}
              />
            </Card>
          )}
          <Button
            variant="primary"
            size="lg"
            mono
            className="w-full"
            onClick={handleGenerateFromText}
            disabled={isLoading || !pastedText.trim()}
          >
            {isLoading ? (
              'Generating...'
            ) : (
              <>
                <Sparkles size={16} strokeWidth={1.5} />
                Generate deck
              </>
            )}
          </Button>

          {error && (
            <ErrorNotice
              error={error}
              timedOut={timedOut}
              onRetry={handleGenerateFromText}
            />
          )}
        </div>
      )}
    </div>
  );
};

export default PDFToFlashcardUploader;

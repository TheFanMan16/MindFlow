import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import PDFToFlashcardUploader from './PDFToFlashcardUploader';
import StudyInterface from './StudyInterface';
import ConfirmModal from './ConfirmModal';
import { toast } from 'react-hot-toast';
import {
  Layers,
  Folder,
  FolderPlus,
  ChevronLeft,
  X,
  Check,
  Trash2,
  Move,
  Upload,
  Pencil,
  MoreVertical,
  FileUp,
} from 'lucide-react';
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from '../motion';
import { smooth, reduced } from '../motion/transitions';
import { downloadAnkiCsv, parseAnkiText } from '../utils/ankiExport';
import { saveGeneratedDeck } from '../utils/deckUtils';
import { getDueCountsByDeck } from '../utils/studyLoop';
import { stalenessTier } from '../utils/staleness';
import { MAX_BOX } from '../utils/spacedRepetition';
import {
  Breadcrumb,
  Button,
  Card,
  Badge,
  Modal,
  Tabs,
  Field,
  Input,
  Textarea,
  EmptyState,
  PopoverItem,
  PopoverSeparator,
  Skeleton,
  Staleness,
  stalenessRowClass,
} from './ui';

/**
 * FlashcardDashboard - the deck library, rebuilt on the design system.
 *
 * Behavior carries over from the previous build: the deck fetch, per-deck
 * card counts, due counts, the Supabase <-> localStorage 'mindflow-library'
 * merge, folder flows, selection mode, rename/move/delete, and Anki
 * import/export. One query was ADDED (deck_id/box/last_reviewed across the
 * user's cards) because the deck row owes two readouts the old build never
 * had: a 2px two-segment progress bar (accent = mastered, --text-tertiary =
 * in progress) and the shared staleness scale on the last review - dormant
 * decks carry the accent wash across the whole card.
 *
 * This is THE deck-row surface, so every row state is explicit: hover fills
 * bg-hover at duration-micro (rows never scale or lift), loading renders
 * skeletons cut to the exact card dimensions, a failed fetch gets a retry
 * panel, empty library/folder each name what's missing plus the one action
 * that fixes it, and mutations (delete, bulk delete, rename, import) pin
 * their triggers to a busy state so nothing double-fires.
 *
 * The signature moment: each deck card is a motion.div with
 * layoutId={'deck-' + deck.id}. StudyInterface's container carries the
 * matching layoutId, and both subtrees render inside one <LayoutGroup>, so
 * opening a deck layoutId-expands the card into the study view.
 */
const FlashcardDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const reduce = useReducedMotion();
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'create' | 'study'
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [decks, setDecks] = useState([]);
  const [decksLoading, setDecksLoading] = useState(true);
  // Non-null when the deck fetch itself failed - the grid swaps for a retry
  // panel, because "0 decks" and "couldn't load decks" are different truths.
  const [decksError, setDecksError] = useState(null);
  // deck id -> number of cards whose next_review has arrived.
  const [dueByDeck, setDueByDeck] = useState({});
  // deck id -> { mastered, inProgress, lastReviewed } for the row's progress
  // bar and staleness label. null = stats unavailable (query failed), which
  // hides those readouts rather than lying with "never studied".
  const [statsByDeck, setStatsByDeck] = useState(null);
  // Mutation-in-flight flags: each async op disables its trigger so it can't
  // double-fire, per the loading-button contract (label swap, aria-busy).
  const [deletingDeckId, setDeletingDeckId] = useState(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isSavingRename, setIsSavingRename] = useState(false);
  const renameBusyRef = useRef(false); // Enter + blur both save; only one wins
  // A failed rename keeps the editor open with the typed value; this is the
  // one-sentence inline alert under the input, which doubles as the retry.
  const [renameError, setRenameError] = useState(null);
  // Destructive-action gates: each delete flows through ConfirmModal, which
  // awaits the handler, pins its busy label and surfaces failures inline.
  const [deckToDelete, setDeckToDelete] = useState(null); // deck id or null
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState(null); // folder id or null
  // Inline form errors (aria-invalid + describedby via Field).
  const [importError, setImportError] = useState(null);
  const [folderNameError, setFolderNameError] = useState(null);
  const [deckRefresh, setDeckRefresh] = useState(0); // bump to refetch decks in place
  // Anki import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState('');
  const [importDeckName, setImportDeckName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState(null); // Track which deck's menu is open
  const [activeFolderMenuId, setActiveFolderMenuId] = useState(null); // Track which folder's menu is open
  const [isSelectionMode, setIsSelectionMode] = useState(false); // Multi-select mode
  const [selectedItemIds, setSelectedItemIds] = useState(new Set()); // Selected items
  const [pendingDeckFolderId, setPendingDeckFolderId] = useState(null); // Store folder context when creating deck
  // New Deck modal (Upload PDF / Paste text / Import Anki) - routes into the
  // existing view machinery, it does not replace it.
  const [showNewDeckModal, setShowNewDeckModal] = useState(false);
  const [newDeckTab, setNewDeckTab] = useState('pdf');
  // Initialize items from localStorage or empty array
  // Migrate old nested structure to flat structure with parentId
  const [items, setItems] = useState(() => {
    try {
      const savedItems = localStorage.getItem('mindflow-library');
      if (savedItems) {
        const parsed = JSON.parse(savedItems);
        // Migrate old nested structure to flat structure
        const flatItems = [];
        parsed.forEach(item => {
          if (item.type === 'folder') {
            // Add folder with parentId
            flatItems.push({
              ...item,
              parentId: item.parentId || null,
              // Remove children array - we'll reconstruct from flat structure
            });
            // Add children as separate items with parentId
            if (item.children && Array.isArray(item.children)) {
              item.children.forEach(child => {
                flatItems.push({
                  ...child,
                  parentId: item.id,
                });
              });
            }
          } else {
            // Add deck/item with parentId
            flatItems.push({
              ...item,
              parentId: item.parentId || null,
            });
          }
        });
        return flatItems;
      }
    } catch (error) {
      console.error('Error loading items from localStorage:', error);
    }
    return [];
  });
  const [currentFolderId, setCurrentFolderId] = useState(null); // Track current folder view (null = root)
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false); // Track create folder modal visibility
  const [newFolderName, setNewFolderName] = useState(''); // Track new folder name input
  const [showMoveToFolderModal, setShowMoveToFolderModal] = useState(false); // Track move to folder modal
  const [deckToMove, setDeckToMove] = useState(null); // Track which deck is being moved
  const [editingDeckId, setEditingDeckId] = useState(null); // Track which deck is being renamed
  const [newDeckName, setNewDeckName] = useState(''); // Store new deck name during editing

  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
        setActiveFolderMenuId(null);
      }
    };

    // Menus promise role="menu" semantics, so Escape must dismiss them too.
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setActiveMenuId(null);
        setActiveFolderMenuId(null);
      }
    };

    if (activeMenuId || activeFolderMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [activeMenuId, activeFolderMenuId]);

  // Handle Escape key to close create folder modal
  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape' && showCreateFolderModal) {
        setShowCreateFolderModal(false);
        setNewFolderName('');
      }
    };

    if (showCreateFolderModal) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showCreateFolderModal]);

  // Save items to localStorage whenever items changes
  useEffect(() => {
    try {
      localStorage.setItem('mindflow-library', JSON.stringify(items));
    } catch (error) {
      console.error('Error saving items to localStorage:', error);
    }
  }, [items]);


  // Fetch decks from Supabase
  useEffect(() => {
    const fetchDecks = async () => {
      if (!user) {
        setDecksLoading(false);
        return;
      }

      try {
        setDecksLoading(true);
        setDecksError(null);

        // Fetch all decks for the current user
        const { data: decksData, error: fetchError } = await supabase
          .from('decks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (fetchError) {
          console.error('Error fetching decks:', fetchError);
          setDecksError('Your decks could not be loaded.');
        } else {
          const fetchedDecks = decksData || [];

          // Fetch card counts for each deck
          const decksWithCounts = await Promise.all(
            fetchedDecks.map(async (deck) => {
              const { count, error: countError } = await supabase
                .from('flashcards')
                .select('*', { count: 'exact', head: true })
                .eq('deck_id', deck.id);

              if (countError) {
                console.error(`Error counting cards for deck ${deck.id}:`, countError);
              }

              return {
                ...deck,
                card_count: count ?? 0
              };
            })
          );

          setDecks(decksWithCounts);

          // Due badges plus per-deck mastery/staleness stats, side by side.
          // Both degrade without throwing so the library still renders: due
          // counts fall back to an empty tally, stats to null (which hides
          // the progress bar and staleness label instead of guessing).
          const [{ counts: dueCounts }, statsResult] = await Promise.all([
            getDueCountsByDeck(user.id),
            supabase
              .from('flashcards')
              .select('deck_id, box, last_reviewed')
              .eq('user_id', user.id)
              .limit(5000),
          ]);
          setDueByDeck(dueCounts);

          if (statsResult.error) {
            console.error('Error fetching deck stats:', statsResult.error);
            setStatsByDeck(null);
          } else {
            const stats = {};
            for (const row of statsResult.data || []) {
              if (!row?.deck_id) continue;
              const s =
                stats[row.deck_id] ||
                (stats[row.deck_id] = { mastered: 0, inProgress: 0, lastReviewed: null });
              if ((row.box || 1) >= MAX_BOX) {
                s.mastered += 1;
              } else if (row.last_reviewed) {
                s.inProgress += 1;
              }
              // ISO timestamps order lexicographically - no Date parse needed.
              if (row.last_reviewed && (!s.lastReviewed || row.last_reviewed > s.lastReviewed)) {
                s.lastReviewed = row.last_reviewed;
              }
            }
            setStatsByDeck(stats);
          }

          // Merge Supabase decks with localStorage items
          // Keep folders and order from localStorage, update/add decks from Supabase
          setItems((prevItems) => {
            const deckIdsFromSupabase = new Set(decksWithCounts.map(d => d.id));
            const existingDeckItems = prevItems.filter(item => item.type === 'deck');
            const existingDeckIds = new Set(existingDeckItems.map(item => item.id));

            // Update existing deck items with latest titles
            const updatedItems = prevItems.map(item => {
              if (item.type === 'deck' && deckIdsFromSupabase.has(item.id)) {
                const deck = decksWithCounts.find(d => d.id === item.id);
                return {
                  ...item,
                  title: deck?.title || item.title || 'Untitled Deck',
                };
              }
              return item;
            });

            // Add new decks from Supabase
            const newDeckItems = decksWithCounts
              .filter(deck => !existingDeckIds.has(deck.id))
              .map(deck => ({
                id: deck.id,
                type: 'deck',
                title: deck.title || 'Untitled Deck',
                parentId: null, // New decks start at root
              }));

            // Remove deck items that no longer exist in Supabase
            const filteredItems = updatedItems.filter(item =>
              item.type !== 'deck' || deckIdsFromSupabase.has(item.id)
            );

            return [...filteredItems, ...newDeckItems];
          });
        }
      } catch (error) {
        console.error('Error in fetchDecks:', error);
        setDecksError('Your decks could not be loaded.');
      } finally {
        setDecksLoading(false);
      }
    };

    if (view === 'dashboard') {
      fetchDecks();
    }
  }, [user, view, deckRefresh]);

  // Cards whose next_review has arrived, tallied when the library loads.
  // Cards that have never been reviewed are not due - they enter the schedule
  // after their first study session.
  const getCardsDue = (deckId) => dueByDeck[deckId] ?? 0;

  // Handle deck saved callback from PDFToFlashcardUploader
  const handleDeckSaved = () => {
    // Use the folder context that was stored when deck creation started
    const folderContext = pendingDeckFolderId;

    // Clear the pending folder context
    setPendingDeckFolderId(null);

    // Refresh decks and switch back to dashboard
    setView('dashboard');

    // The useEffect will refetch decks when view changes to 'dashboard'
    // After decks are refetched, we'll update items with the folder context
    setTimeout(() => {
      setItems((prevItems) => {
        // Find the most recently created deck (first in the decks array after refetch)
        const newDeck = decks[0];
        if (newDeck && !prevItems.some(item => item.id === newDeck.id)) {
          // Add new deck item with folder context
          return [
            {
              id: newDeck.id,
              type: 'deck',
              title: newDeck.title || 'Untitled Deck',
              parentId: folderContext || null, // Use the folder context from when deck was created
            },
            ...prevItems
          ];
        }
        return prevItems;
      });
    }, 500); // Wait for decks to be refetched
  };

  // Handle deck click
  const handleDeckClick = (deckId, e) => {
    // Don't navigate if clicking on the menu button
    if (e && (e.target.closest('.menu-button') || e.target.closest('.menu-dropdown'))) {
      return;
    }

    // If in selection mode, toggle selection instead of opening
    if (isSelectionMode) {
      setSelectedItemIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(deckId)) {
          newSet.delete(deckId);
        } else {
          newSet.add(deckId);
        }
        return newSet;
      });
      return;
    }

    setSelectedDeckId(deckId);
    setView('study');
  };

  // Handle folder click
  const handleFolderClick = (folderId) => {
    // If in selection mode, toggle selection instead of opening
    if (isSelectionMode) {
      setSelectedItemIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(folderId)) {
          newSet.delete(folderId);
        } else {
          newSet.add(folderId);
        }
        return newSet;
      });
      return;
    }

    setCurrentFolderId(folderId);
  };

  // Toggle selection mode
  const handleToggleSelectionMode = () => {
    setIsSelectionMode(prev => !prev);
    if (isSelectionMode) {
      // Clear selection when exiting selection mode
      setSelectedItemIds(new Set());
    }
  };

  // Bulk delete - the toolbar button only opens the gate; the delete itself
  // runs in performBulkDelete via ConfirmModal's awaited onConfirm.
  const handleBulkDelete = () => {
    if (selectedItemIds.size === 0 || isBulkDeleting) return;
    setShowBulkDeleteConfirm(true);
  };

  // Runs inside ConfirmModal: a thrown error keeps the modal open with the
  // failure inline and the confirm button as the retry. Only items the
  // server confirmed deleted (plus local-only folders) leave the library -
  // a failed delete never falls through to the success path.
  const performBulkDelete = async () => {
    const selectedIds = Array.from(selectedItemIds);
    const deckIds = selectedIds.filter(id => {
      const item = items.find(i => i.id === id);
      return item?.type === 'deck';
    });
    const folderIds = selectedIds.filter(id => {
      const item = items.find(i => i.id === id);
      return item?.type === 'folder';
    });

    setIsBulkDeleting(true);
    try {
      // Folders live only in localStorage, so they always delete; decks must
      // be confirmed by the server (.select returns the rows it removed).
      let confirmedDeckIds = [];
      if (deckIds.length > 0) {
        const { data: deletedRows, error: deleteError } = await supabase
          .from('decks')
          .delete()
          .in('id', deckIds)
          .select('id');

        if (deleteError) {
          if (import.meta.env.DEV) {
            console.error('Error deleting decks:', deleteError);
          }
          throw new Error('The selected items could not be deleted. Try again.');
        }
        confirmedDeckIds = (deletedRows || []).map(row => row.id);
      }

      const removedIds = new Set([...folderIds, ...confirmedDeckIds]);
      if (removedIds.size > 0) {
        setItems(prevItems => prevItems.filter(item => !removedIds.has(item.id)));
        setDecks(prevDecks => prevDecks.filter(deck => !removedIds.has(deck.id)));
      }

      // Partial result: keep only the survivors selected so the retry (the
      // confirm button) targets exactly what is still standing.
      const missedIds = deckIds.filter(id => !removedIds.has(id));
      if (missedIds.length > 0) {
        setSelectedItemIds(new Set(missedIds));
        throw new Error(
          `Deleted ${removedIds.size} of ${selectedIds.length}; the rest could not be deleted. Try again.`
        );
      }

      setSelectedItemIds(new Set());
      setIsSelectionMode(false);
      toast.success(`Deleted ${removedIds.size} ${removedIds.size === 1 ? 'item' : 'items'}`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Handle bulk move (not built yet - decks move one at a time via the card menu)
  const handleBulkMove = () => {
    if (selectedItemIds.size === 0) return;
    toast('Bulk move is not available yet - move decks individually from the card menu.');
  };

  // Deck delete - the menu item only opens the gate; the delete itself runs
  // in performDeleteDeck via ConfirmModal's awaited onConfirm.
  const handleDeleteDeck = (deckId, e) => {
    e.stopPropagation(); // Prevent card click
    setActiveMenuId(null); // Close menu
    setDeckToDelete(deckId);
  };

  // Runs inside ConfirmModal: a thrown error keeps the modal open with the
  // failure inline and the confirm button as the retry.
  const performDeleteDeck = async () => {
    const deckId = deckToDelete;
    if (!deckId) return;

    // Pin the card into its busy state (dimmed, pointer-events off) while
    // the delete is in flight, so it can't be opened or re-deleted mid-op.
    setDeletingDeckId(deckId);
    try {
      // Delete the deck (cascade should handle flashcards)
      const { error: deleteError } = await supabase
        .from('decks')
        .delete()
        .eq('id', deckId);

      if (deleteError) {
        throw deleteError;
      }

      // Update local state immediately
      setDecks(prevDecks => prevDecks.filter(deck => deck.id !== deckId));
      toast.success('Deck deleted successfully');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error deleting deck:', error);
      }
      throw new Error('The deck could not be deleted. Try again.');
    } finally {
      setDeletingDeckId(null);
    }
  };

  // Handle rename deck - start editing mode
  const handleRenameDeck = (deckId, e) => {
    e.stopPropagation(); // Prevent card click
    setActiveMenuId(null); // Close menu
    const deck = decks.find(d => d.id === deckId);
    if (deck) {
      setEditingDeckId(deckId);
      setNewDeckName(deck.title || 'Untitled Deck');
      setRenameError(null);
    }
  };

  // Handle updating deck name in Supabase
  const handleUpdateDeckName = async (deckId, newName) => {
    // Enter fires this AND the resulting disable fires blur, which fires it
    // again - the ref (not state, which lags a render) lets only one through.
    if (renameBusyRef.current) return;

    if (!newName.trim()) {
      setEditingDeckId(null);
      setNewDeckName('');
      setRenameError(null);
      return;
    }

    renameBusyRef.current = true;
    setIsSavingRename(true);
    try {
      const { error } = await supabase
        .from('decks')
        .update({ title: newName.trim() })
        .eq('id', deckId)
        .eq('user_id', user.id);

      if (error) {
        throw error;
      }

      // Update local state
      setDecks(prevDecks =>
        prevDecks.map(deck =>
          deck.id === deckId ? { ...deck, title: newName.trim() } : deck
        )
      );

      // Update items array
      setItems(prevItems =>
        prevItems.map(item =>
          item.id === deckId && item.type === 'deck'
            ? { ...item, title: newName.trim() }
            : item
        )
      );

      setEditingDeckId(null);
      setNewDeckName('');
      setRenameError(null);
      toast.success('Deck renamed successfully');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error renaming deck:', error);
      }
      // Keep the editor open with the typed value - the input is the retry
      // anchor, and the inline alert names the one resolving action.
      setRenameError('The name could not be saved - press Enter to try again.');
    } finally {
      renameBusyRef.current = false;
      setIsSavingRename(false);
    }
  };

  // Toggle menu
  const toggleMenu = (deckId, e) => {
    e.stopPropagation(); // Prevent card click
    setActiveMenuId(activeMenuId === deckId ? null : deckId);
  };

  // Toggle folder menu
  const toggleFolderMenu = (folderId, e) => {
    e.stopPropagation(); // Prevent folder click
    setActiveFolderMenuId(activeFolderMenuId === folderId ? null : folderId);
  };

  // Handle create folder - open modal
  const handleCreateFolder = () => {
    setShowCreateFolderModal(true);
    setNewFolderName('');
    setFolderNameError(null);
  };

  // Handle folder creation from modal
  const handleConfirmCreateFolder = () => {
    const folderName = newFolderName.trim();

    // Empty name: say so inline (aria-invalid + describedby via Field)
    // instead of a Create button that silently does nothing.
    if (!folderName) {
      setFolderNameError('Enter a name for this folder.');
      return;
    }

    // Create folder with the provided name (flat structure)
    const newFolder = {
      id: `folder-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique ID
      type: 'folder',
      title: folderName,
      parentId: currentFolderId, // Create folder in current view (null for root)
    };

    setItems((prevItems) => [...prevItems, newFolder]);
    setShowCreateFolderModal(false);
    setNewFolderName('');
    setFolderNameError(null);
  };

  // Handle cancel folder creation
  const handleCancelCreateFolder = () => {
    setShowCreateFolderModal(false);
    setNewFolderName('');
    setFolderNameError(null);
  };

  // Handle move deck to folder
  const handleMoveDeckToFolder = (folderId) => {
    if (!deckToMove) return;

    setItems((items) => {
      return items.map(item =>
        item.id === deckToMove
          ? { ...item, parentId: folderId }
          : item
      );
    });

    setShowMoveToFolderModal(false);
    setDeckToMove(null);
    toast.success('Deck moved to folder');
  };

  // Handle move deck to root
  const handleMoveDeckToRoot = () => {
    if (!deckToMove) return;

    setItems((items) => {
      return items.map(item =>
        item.id === deckToMove
          ? { ...item, parentId: null }
          : item
      );
    });

    setShowMoveToFolderModal(false);
    setDeckToMove(null);
    toast.success('Deck moved to Library');
  };

  // Import an Anki text export (or our CSV) into a new deck. Failures land
  // inline on the form (aria-invalid + describedby) rather than in a toast
  // that outlives the modal.
  const handleImportDeck = async () => {
    setImportError(null);
    if (!user?.id) {
      setImportError('Log in to import decks.');
      return;
    }
    const cards = parseAnkiText(importText);
    if (cards.length === 0) {
      setImportError('No cards found. Export from Anki as "Notes in Plain Text" and paste or upload the file.');
      return;
    }

    setIsImporting(true);
    try {
      const title = importDeckName.trim() ||
        `Anki Import - ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      const result = await saveGeneratedDeck(cards, title, user.id);
      if (!result.success) {
        throw new Error(result.error || 'Failed to save deck');
      }
      toast.success(`Imported ${result.cardCount} cards into "${title}".`);
      setShowImportModal(false);
      // The same form now also lives in the New Deck modal's Anki tab.
      setShowNewDeckModal(false);
      setImportText('');
      setImportDeckName('');
      setImportError(null);
      setDeckRefresh((c) => c + 1);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Anki import failed:', error);
      }
      setImportError('Could not import the deck. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(String(reader.result || ''));
      setImportError(null);
      if (!importDeckName && file.name) {
        setImportDeckName(file.name.replace(/\.(txt|csv|tsv)$/i, ''));
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Export a saved deck as an Anki-importable CSV
  const handleExportDeck = async (deckId, deckTitle) => {
    setActiveMenuId(null);
    if (!user?.id) {
      toast.error('Log in to export decks.');
      return;
    }
    try {
      const { data: cards, error } = await supabase
        .from('flashcards')
        .select('front, back')
        .eq('deck_id', deckId)
        .eq('user_id', user.id);
      if (error) throw error;
      if (!cards || cards.length === 0) {
        toast.error('This deck has no cards to export.');
        return;
      }
      downloadAnkiCsv(cards, deckTitle);
      toast.success('Exported! In Anki: File → Import, choose this file.');
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Deck export failed:', error);
      }
      toast.error('Could not export this deck. Please try again.');
    }
  };

  // Folder delete - the menu item only opens the gate; the delete itself
  // runs in performDeleteFolder via ConfirmModal's awaited onConfirm.
  const handleDeleteFolder = (folderId, e) => {
    e.stopPropagation(); // Prevent folder click
    setActiveFolderMenuId(null); // Close menu

    // Find the folder
    const folder = items.find(item => item.type === 'folder' && item.id === folderId);
    if (!folder) return;

    setFolderToDelete(folderId);
  };

  // Runs inside ConfirmModal. Folders live only in localStorage, so this is
  // synchronous - no failure path to represent.
  const performDeleteFolder = () => {
    const folderId = folderToDelete;
    if (!folderId) return;

    // Count items in this folder (flat structure)
    const hasItems = items.some(item => item.parentId === folderId);

    setItems((prevItems) => {
      // Remove the folder
      let updatedItems = prevItems.filter(item => item.id !== folderId);

      // If folder has items, move them to root level (set parentId to null)
      if (hasItems) {
        updatedItems = updatedItems.map(item =>
          item.parentId === folderId
            ? { ...item, parentId: null }
            : item
        );
      }

      return updatedItems;
    });

    // Show toast notification
    if (hasItems) {
      toast.success('Folder deleted and items moved to Library.');
    } else {
      toast.success('Folder deleted.');
    }

    // If we're currently viewing this folder, go back to root
    if (currentFolderId === folderId) {
      setCurrentFolderId(null);
    }
  };

  // Handle create deck
  const handleCreateDeck = () => {
    // Store current folder context for when deck is created
    setPendingDeckFolderId(currentFolderId);
    setView('create');
  };

  // Handle create test deck
  const handleCreateTestDeck = async () => {
    if (!user) {
      toast.error('You must be logged in to create a deck');
      return;
    }

    try {
      // Generate truly unique title using timestamp + random
      const uniqueId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const randomNumber = Math.floor(Math.random() * 10000);
      const testDeckTitle = `Test Deck ${randomNumber}`;

      // Insert deck into Supabase (Supabase will generate a unique UUID for the ID)
      const { data: newDeck, error: insertError } = await supabase
        .from('decks')
        .insert({
          user_id: user.id,
          title: testDeckTitle,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating test deck:', insertError);
        toast.error('Failed to create test deck');
        return;
      }

      // Update local decks state
      setDecks((prevDecks) => [newDeck, ...prevDecks]);

      // Update local items state to show it in the grid (flat structure)
      // Context-aware: if inside a folder, set parentId to currentFolderId, otherwise null
      const newDeckItem = {
        id: newDeck.id,
        type: 'deck',
        title: newDeck.title || testDeckTitle,
        parentId: currentFolderId || null, // Create in current folder context
      };

      setItems((prevItems) => [newDeckItem, ...prevItems]);

      toast.success('Test deck created!');
    } catch (error) {
      console.error('Error in handleCreateTestDeck:', error);
      toast.error('An error occurred while creating the test deck');
    }
  };

  // Handle exit from study view
  const handleExitStudy = () => {
    setView('dashboard');
    setSelectedDeckId(null);
  };

  // Get visible items based on current folder view (flat structure)
  const getVisibleItems = () => {
    // Filter items by parentId - root items have parentId: null
    return items.filter(item => item.parentId === currentFolderId);
  };

  const visibleItems = getVisibleItems();

  /* ------------------------------------------------------------------ */
  /* Render helpers - plain functions (not components) so nothing        */
  /* remounts on parent re-renders; all handlers reach in via closure.   */
  /* ------------------------------------------------------------------ */

  // Icon-only card menu trigger. Local primitive: the controlled dropdown
  // (activeMenuId + outside-click ref) must stay, so the ui Popover's
  // self-managed open state cannot be used here. Focus is the app-wide
  // :focus-visible ring - nothing re-declared. The 28px visual square
  // extends its hit area to 40px with an ::after inset, not extra height.
  const menuTriggerClasses = (extra) =>
    [
      extra,
      'relative flex h-7 w-7 shrink-0 items-center justify-center rounded-sm text-secondary',
      'after:absolute after:-inset-1.5',
      'transition-colors duration-micro hover:bg-hover hover:text-primary active:bg-active',
    ].join(' ');

  const selectionCheck = (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-accent"
      aria-hidden="true"
    >
      <Check size={12} strokeWidth={2} className="text-on-accent" />
    </span>
  );

  // FolderCard - same row treatment as decks: bg-hover fill at duration-micro,
  // pressed goes bg-active, never a scale or lift. Keyboard reach comes from
  // Card's control contract (plain div + interactive + onClick).
  const renderFolderCard = (folder, itemCount) => {
    const isSelected = selectedItemIds.has(folder.id);
    const isMenuOpen = activeFolderMenuId === folder.id;
    return (
      <Card
        key={folder.id}
        interactive
        aria-pressed={isSelectionMode ? isSelected : undefined}
        className={[
          'relative flex min-h-[132px] flex-col gap-3 p-4',
          'duration-micro active:bg-active',
          isSelected ? 'border-accent-line' : '',
        ].join(' ')}
        onClick={(e) => {
          // Don't trigger folder click if clicking on menu
          if (e.target.closest('.folder-menu-button') || e.target.closest('.folder-menu-dropdown')) {
            return;
          }
          // In selection mode, toggle selection instead of opening
          if (isSelectionMode) {
            // Selection is handled by parent component via handleFolderClick
            handleFolderClick(folder.id);
            return;
          }
          handleFolderClick(folder.id);
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-line bg-canvas text-secondary">
            <Folder size={16} strokeWidth={1.5} />
          </span>
          <div className="flex items-center gap-1.5">
            {isSelected ? selectionCheck : null}
            <button
              type="button"
              aria-label="Folder options"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              className={menuTriggerClasses('folder-menu-button')}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleFolderMenu(folder.id, e);
              }}
            >
              <MoreVertical size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        <h3 className="truncate text-body font-medium text-primary">
          {folder.title || 'Untitled Folder'}
        </h3>

        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="text-label-sm text-secondary">
            {itemCount > 99 ? '99+' : itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Menu Dropdown - controlled, closed by the outside-click effect */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            role="menu"
            className="folder-menu-dropdown absolute right-3 top-11 z-50 min-w-[160px] rounded-lg border border-line bg-raised p-1 shadow-raised"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <PopoverItem
              danger
              onSelect={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleDeleteFolder(folder.id, e);
              }}
            >
              <Trash2 size={14} strokeWidth={1.5} />
              Delete
            </PopoverItem>
          </div>
        )}
      </Card>
    );
  };

  // DeckCard - THE deck row, and the signature moment: layoutId expands into
  // StudyInterface. Row states: hover fills bg-hover at duration-micro and
  // pressed goes bg-active (never a scale or lift); a 2px two-segment bar
  // reads mastery (accent) then in-progress (--text-tertiary) on a bg-inset
  // track; the last review rides the shared staleness scale, and a dormant
  // deck (90+ days) washes the whole row. Card's keyboard contract only
  // fires for a plain div, so this motion.div carries role/tabIndex/keys
  // itself - the primary library action must be reachable by keyboard.
  const renderDeckCard = (deck, cardsDue) => {
    const isSelected = selectedItemIds.has(deck.id);
    const isMenuOpen = activeMenuId === deck.id;
    const isDeleting = deletingDeckId === deck.id;
    const stats = statsByDeck ? statsByDeck[deck.id] : null;
    const lastReviewed = stats?.lastReviewed ?? null;
    const tier = statsByDeck ? stalenessTier(lastReviewed) : null;
    const total = deck.card_count ?? 0;
    const mastered = Math.min(stats?.mastered ?? 0, total);
    const inProgress = Math.min(stats?.inProgress ?? 0, Math.max(0, total - mastered));
    return (
      <Card
        key={deck.id}
        as={motion.div}
        layoutId={`deck-${deck.id}`}
        transition={reduce ? { duration: 0 } : smooth}
        interactive
        role="button"
        tabIndex={isDeleting ? -1 : 0}
        aria-busy={isDeleting || undefined}
        aria-pressed={isSelectionMode ? isSelected : undefined}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return; // inner controls own their keys
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleDeckClick(deck.id, e);
          }
        }}
        className={[
          // group: tertiary staleness copy inside promotes itself to
          // secondary while the row is on bg-hover/bg-active (contrast).
          'group relative isolate flex min-h-[132px] flex-col gap-3 p-4',
          'duration-micro active:bg-active',
          // isolate scopes the dormant-wash overlay but also traps the menu
          // dropdown's z-50 inside this card - raise the whole card while
          // its menu is open so sibling cards can't paint over the menu.
          isMenuOpen ? 'z-10' : '',
          isSelected ? 'border-accent-line' : '',
          isDeleting ? 'pointer-events-none opacity-50' : '',
        ].join(' ')}
        onClick={(e) => {
          // Don't trigger deck click if clicking on menu
          if (e.target.closest('.menu-button') || e.target.closest('.menu-dropdown')) {
            return;
          }
          // In selection mode, the parent handles selection toggle
          // handleDeckClick already handles this
          handleDeckClick(deck.id, e);
        }}
      >
        {/* Dormant wash as an -z-10 overlay (isolate scopes it): Card's own
            bg-surface outranks a bg-accent-wash utility in the compiled
            cascade, so the class can't simply be appended to the row. */}
        {tier === 'dormant' ? (
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 -z-10 rounded-lg ${stalenessRowClass(tier)}`}
          />
        ) : null}
        <div className="flex items-start justify-between gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-line bg-canvas text-secondary">
            <Layers size={16} strokeWidth={1.5} />
          </span>
          <div className="flex items-center gap-1.5">
            {isSelected ? selectionCheck : null}
            <button
              type="button"
              aria-label="Deck options"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              className={menuTriggerClasses('menu-button')}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleMenu(deck.id, e);
              }}
            >
              <MoreVertical size={16} strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Title or inline rename input (disabled while the rename saves,
            so blur/Enter can't race a second submit). A failed save keeps
            the editor open with the typed value - the alert below the input
            names the retry, and the input is the retry anchor. */}
        {editingDeckId === deck.id ? (
          <div className="flex flex-col gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Input
              type="text"
              value={newDeckName}
              onChange={(e) => {
                setNewDeckName(e.target.value);
                if (renameError) setRenameError(null);
              }}
              onBlur={() => handleUpdateDeckName(deck.id, newDeckName)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleUpdateDeckName(deck.id, newDeckName);
                } else if (e.key === 'Escape') {
                  setEditingDeckId(null);
                  setNewDeckName('');
                  setRenameError(null);
                }
              }}
              autoFocus
              disabled={isSavingRename}
              aria-busy={isSavingRename || undefined}
              aria-invalid={renameError ? true : undefined}
              className="h-8"
            />
            {renameError ? (
              <p
                role="alert"
                className="rounded-sm border border-negative-line bg-negative-wash px-2 py-1 text-label-sm text-negative"
              >
                {renameError}
              </p>
            ) : null}
          </div>
        ) : (
          <h3 className="truncate text-body font-medium text-primary">
            {deck.title || 'Untitled Deck'}
          </h3>
        )}

        <div className="mt-auto flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-label-sm text-secondary">
                {total} cards
              </span>
              {statsByDeck ? (
                <Staleness
                  at={lastReviewed}
                  prefix="reviewed"
                  never="never studied"
                  /* Only the tertiary-rendered tiers (fresh, never) need the
                     hover contrast bump - promoting unconditionally would
                     also demote stale/dormant ACCENT labels to secondary. */
                  className={
                    tier === 'fresh' || tier === null
                      ? 'group-hover:text-secondary group-active:text-secondary'
                      : ''
                  }
                />
              ) : null}
            </span>
            {cardsDue > 0 && (
              <Badge variant="accent">{cardsDue > 99 ? '99+' : cardsDue} due</Badge>
            )}
          </div>
          {/* 2px two-segment progress: accent = mastered (box 5), then
              --text-tertiary = reviewed-but-not-mastered, on a bg-inset
              track. The title carries the numbers so the meaning never
              lives in color alone. */}
          {statsByDeck && total > 0 ? (
            <div
              role="img"
              aria-label={`${mastered} of ${total} cards mastered, ${inProgress} in progress`}
              title={`${mastered} of ${total} mastered · ${inProgress} in progress`}
              className="flex h-0.5 w-full overflow-hidden bg-inset"
            >
              <div className="h-full bg-accent" style={{ width: `${(mastered / total) * 100}%` }} />
              <div
                className="h-full"
                style={{
                  width: `${(inProgress / total) * 100}%`,
                  backgroundColor: 'var(--text-tertiary)',
                }}
              />
            </div>
          ) : null}
        </div>

        {/* Menu Dropdown - controlled, closed by the outside-click effect */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            role="menu"
            className="menu-dropdown absolute right-3 top-11 z-50 min-w-[180px] rounded-lg border border-line bg-raised p-1 shadow-raised"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <PopoverItem
              onSelect={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleRenameDeck(deck.id, e);
              }}
            >
              <Pencil size={14} strokeWidth={1.5} />
              Rename
            </PopoverItem>
            <PopoverItem
              onSelect={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setDeckToMove(deck.id);
                setShowMoveToFolderModal(true);
                setActiveMenuId(null);
              }}
            >
              <Folder size={14} strokeWidth={1.5} />
              Move to Folder
            </PopoverItem>
            <PopoverItem
              onSelect={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleExportDeck(deck.id, deck.title);
              }}
            >
              <Upload size={14} strokeWidth={1.5} />
              Export to Anki
            </PopoverItem>
            <PopoverSeparator />
            <PopoverItem
              danger
              onSelect={(e) => {
                e.stopPropagation();
                e.preventDefault();
                handleDeleteDeck(deck.id, e);
              }}
            >
              <Trash2 size={14} strokeWidth={1.5} />
              Delete
            </PopoverItem>
          </div>
        )}
      </Card>
    );
  };

  // Skeleton deck card: same surface, same slot heights as the real card
  // (icon square 32, title line 24, meta line 16, 2px bar) under the same
  // min-height, so nothing in the grid jumps when data lands. Static by
  // rule - reserved space, not activity theater.
  const renderDeckSkeleton = (key) => (
    <div
      key={key}
      aria-hidden="true"
      className="flex min-h-[132px] flex-col gap-3 rounded-lg border border-line bg-surface p-4 shadow-edge"
    >
      <div className="flex items-start justify-between gap-2">
        <Skeleton className="h-8 w-8" />
        <Skeleton className="h-7 w-7" />
      </div>
      <Skeleton className="h-6 w-3/5" />
      <div className="mt-auto flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-0.5 w-full" />
      </div>
    </div>
  );

  // The Anki import form. Rendered by plain function call (no component
  // boundary) so the inputs never remount mid-keystroke. Shared between the
  // standalone Import modal and the New Deck modal's Anki tab.
  const renderAnkiImportForm = (onCancel) => {
    const previewCount = parseAnkiText(importText).length;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-body-sm text-secondary">
          In Anki: File → Export → "Notes in Plain Text (.txt)". Upload that file
          or paste its contents below. Semicolon CSVs (like MindFlow's own export) work too.
        </p>
        <Field label="Deck name">
          <Input
            type="text"
            value={importDeckName}
            onChange={(e) => setImportDeckName(e.target.value)}
            placeholder="Deck name (optional)"
            disabled={isImporting}
          />
        </Field>
        <Field label="Cards" error={importError}>
          <Textarea
            value={importText}
            onChange={(e) => {
              setImportText(e.target.value);
              if (importError) setImportError(null);
            }}
            placeholder={'Front of card\tBack of card\n…'}
            rows={7}
            disabled={isImporting}
            className="text-body-sm"
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* File-picker label: the input is sr-only, so the app-wide
              :focus-visible ring can't surface on the visible control - the
              peer pattern relays keyboard focus onto the visible label with
              the same 2px offset ring, and pointer focus stays quiet. */}
          <label className={isImporting ? 'pointer-events-none inline-flex' : 'cursor-pointer inline-flex'}>
            <input
              type="file"
              accept=".txt,.csv,.tsv,text/plain,text/csv"
              onChange={handleImportFile}
              disabled={isImporting}
              className="peer sr-only"
            />
            <span
              className={[
                'inline-flex h-8 select-none items-center gap-2 rounded-sm border px-3',
                'bg-transparent text-body-sm font-medium',
                'transition-colors duration-micro',
                'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
                'peer-focus-visible:[outline-color:var(--focus-ring)]',
                isImporting
                  ? 'border-faint text-disabled'
                  : 'border-line text-primary hover:border-strong hover:bg-hover active:bg-active',
              ].join(' ')}
            >
              <FileUp
                size={14}
                strokeWidth={1.5}
                className={isImporting ? 'text-disabled' : 'text-secondary'}
              />
              Upload file…
            </span>
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onCancel} disabled={isImporting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleImportDeck}
              disabled={isImporting || !importText.trim()}
              aria-busy={isImporting || undefined}
            >
              {isImporting ? (
                'Importing…'
              ) : previewCount > 0 ? (
                <>
                  Import {previewCount} cards
                </>
              ) : (
                'Import'
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  };

  /* ------------------------------------------------------------------ */
  /* Views - one return, one LayoutGroup, so the deck-card layoutId can  */
  /* match StudyInterface's container when the subtree swaps.            */
  /* ------------------------------------------------------------------ */

  let content = null;

  if (view === 'dashboard') {
    // Determine header title
    let headerTitle;
    if (currentFolderId !== null) {
      const folder = items.find(item => item.type === 'folder' && item.id === currentFolderId);
      if (folder) {
        headerTitle = folder.title;
      } else {
        headerTitle = 'My Library';
      }
    } else {
      headerTitle = 'My Library';
    }

    // The root empty state owns the create CTA, so the toolbar's primary
    // yields for that render - the same CTA never appears twice in a viewport.
    const showLibraryEmptyState =
      items.length === 0 && !decksLoading && !decksError && currentFolderId === null;

    // Names for the ConfirmModal copy - each gate says exactly what is on
    // the line before the danger button is live.
    const deckPendingDelete =
      deckToDelete !== null ? decks.find(d => d.id === deckToDelete) : null;
    const folderPendingDelete =
      folderToDelete !== null
        ? items.find(item => item.type === 'folder' && item.id === folderToDelete)
        : null;
    const folderPendingHasItems =
      folderToDelete !== null && items.some(item => item.parentId === folderToDelete);
    const bulkCount = selectedItemIds.size;

    content = (
      <div className="min-h-full bg-canvas">
        <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8">
          <Breadcrumb
            trail={['MindFlow', 'Library']}
            right={
              decksLoading ? null : (
                <span className="text-label-sm text-secondary">
                  {decks.length} {decks.length === 1 ? 'deck' : 'decks'}
                </span>
              )
            }
          />

          {/* Header + action bar */}
          <div className="mb-8 mt-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {currentFolderId !== null && (
                <Button variant="ghost" size="sm" onClick={() => setCurrentFolderId(null)}>
                  <ChevronLeft size={16} strokeWidth={1.5} />
                  Back to Library
                </Button>
              )}
              <h1 className="text-display-sm text-primary">{headerTitle}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isSelectionMode ? (
                <>
                  <Button variant="ghost" size="sm" onClick={handleToggleSelectionMode}>
                    <Check size={14} strokeWidth={1.5} />
                    Select
                  </Button>
                  <Button variant="secondary" size="sm" onClick={handleCreateFolder}>
                    <FolderPlus size={14} strokeWidth={1.5} />
                    New Folder
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setShowImportModal(true)}>
                    <Upload size={14} strokeWidth={1.5} />
                    Import
                  </Button>
                  {!showLibraryEmptyState && (
                    <Button
                      size="sm"
                      onClick={() => {
                        setNewDeckTab('pdf');
                        setShowNewDeckModal(true);
                      }}
                    >
                      <Layers size={14} strokeWidth={1.5} />
                      New Deck
                    </Button>
                  )}
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleToggleSelectionMode}
                    disabled={isBulkDeleting}
                  >
                    <X size={14} strokeWidth={1.5} />
                    Cancel
                  </Button>
                  {selectedItemIds.size > 0 && (
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={handleBulkMove}
                        disabled={isBulkDeleting}
                      >
                        <Move size={14} strokeWidth={1.5} />
                        Move ({selectedItemIds.size})
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={handleBulkDelete}
                        loading={isBulkDeleting}
                        loadingLabel="Deleting…"
                      >
                        <Trash2 size={14} strokeWidth={1.5} />
                        Delete ({selectedItemIds.size})
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Main Content Area: error panel > loading skeletons > empty
              library > the grid (which itself covers empty folders and
              per-deck skeleton fallbacks). */}
          {decksError && !decksLoading ? (
            <div
              role="alert"
              className="mx-auto mt-12 flex max-w-lg flex-col items-center gap-4 rounded-lg border border-line bg-surface px-6 py-8 text-center shadow-edge"
            >
              <p className="text-body-sm text-negative">
                {decksError} What you see below is a connection problem, not an empty account.
              </p>
              <Button variant="secondary" size="sm" onClick={() => setDeckRefresh((c) => c + 1)}>
                Try again
              </Button>
            </div>
          ) : decksLoading && items.length === 0 ? (
            <div
              aria-busy="true"
              className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4"
            >
              {Array.from({ length: 6 }).map((_, i) => renderDeckSkeleton(`deck-skeleton-${i}`))}
            </div>
          ) : showLibraryEmptyState ? (
            <div className="mx-auto mt-12 max-w-lg">
              <EmptyState
                icon={<Layers size={18} strokeWidth={1.5} />}
                title="Your library is empty"
                description="Create your first deck from a PDF, pasted notes, or an Anki export."
                action={
                  <Button
                    onClick={() => {
                      setNewDeckTab('pdf');
                      setShowNewDeckModal(true);
                    }}
                  >
                    Create First Deck
                  </Button>
                }
              />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentFolderId || 'root'}
                initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
                animate={
                  reduce
                    ? { opacity: 1, transition: reduced }
                    : { opacity: 1, scale: 1, transition: smooth }
                }
                exit={{ opacity: 0, transition: reduced }}
                aria-busy={decksLoading || undefined}
                className={
                  visibleItems.length === 0
                    ? ''
                    : 'grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4'
                }
              >
                {visibleItems.length === 0 ? (
                  /* An open view with nothing in it - name the gap and hand
                     over the one action that fills it. The button stays
                     secondary: the toolbar's primary New Deck is in the same
                     viewport and a CTA never repeats. */
                  <div className="mx-auto mt-12 max-w-lg">
                    <EmptyState
                      icon={<Folder size={18} strokeWidth={1.5} />}
                      title={currentFolderId !== null ? 'This folder is empty' : 'Nothing at the top level'}
                      description={
                        currentFolderId !== null
                          ? 'Decks created here land in this folder, or move one in from its card menu.'
                          : 'Every deck is filed inside a folder - create one here to see it at the top level.'
                      }
                      action={
                        <Button
                          variant="secondary"
                          onClick={() => {
                            setNewDeckTab('pdf');
                            setShowNewDeckModal(true);
                          }}
                        >
                          {currentFolderId !== null ? 'New deck in this folder' : 'New deck here'}
                        </Button>
                      }
                    />
                  </div>
                ) : (
                  visibleItems.map((item) => {
                    if (item.type === 'folder') {
                      const itemCount = items.filter(i => i.parentId === item.id).length;
                      return renderFolderCard(item, itemCount);
                    } else if (item.type === 'deck') {
                      const deck = decks.find(d => d.id === item.id);
                      // Known deck item, data not landed yet: hold its exact
                      // footprint with a skeleton instead of collapsing the grid.
                      if (!deck) return decksLoading ? renderDeckSkeleton(item.id) : null;
                      return renderDeckCard(deck, getCardsDue(deck.id));
                    }
                    return null;
                  })
                )}
              </motion.div>
            </AnimatePresence>
          )}

          {/* New Deck Modal - Tabs route into the existing machinery */}
          <Modal
            open={showNewDeckModal}
            onClose={() => {
              if (!isImporting) setShowNewDeckModal(false);
            }}
            title="New Deck"
            className="max-w-lg"
          >
            <div className="flex flex-col gap-4">
              <Tabs
                items={[
                  { value: 'pdf', label: 'Upload PDF' },
                  { value: 'paste', label: 'Paste Text' },
                  { value: 'anki', label: 'Import Anki' },
                ]}
                value={newDeckTab}
                onChange={setNewDeckTab}
              />
              {newDeckTab === 'anki' ? (
                renderAnkiImportForm(() => setShowNewDeckModal(false))
              ) : (
                <>
                  <p className="text-body-sm text-secondary">
                    {newDeckTab === 'pdf'
                      ? 'Upload a PDF and MindFlow turns it into flashcards.'
                      : 'Paste notes or a summary and MindFlow turns them into flashcards.'}
                  </p>
                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        setShowNewDeckModal(false);
                        handleCreateDeck();
                      }}
                    >
                      Continue
                    </Button>
                  </div>
                </>
              )}
            </div>
          </Modal>

          {/* Anki Import Modal */}
          <Modal
            open={showImportModal}
            onClose={() => {
              if (!isImporting) setShowImportModal(false);
            }}
            title="Import from Anki"
            className="max-w-lg"
          >
            {renderAnkiImportForm(() => setShowImportModal(false))}
          </Modal>

          {/* Create Folder Modal */}
          <Modal
            open={showCreateFolderModal}
            onClose={handleCancelCreateFolder}
            title="Create Folder"
            footer={
              <>
                <Button variant="secondary" size="sm" onClick={handleCancelCreateFolder}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleConfirmCreateFolder}>
                  Create
                </Button>
              </>
            }
          >
            <Field label="Folder name" error={folderNameError}>
              <Input
                type="text"
                value={newFolderName}
                onChange={(e) => {
                  setNewFolderName(e.target.value);
                  if (folderNameError) setFolderNameError(null);
                }}
                placeholder="Enter folder name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirmCreateFolder();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    handleCancelCreateFolder();
                  }
                }}
              />
            </Field>
          </Modal>

          {/* Move to Folder Modal */}
          <Modal
            open={showMoveToFolderModal}
            onClose={() => {
              setShowMoveToFolderModal(false);
              setDeckToMove(null);
            }}
            title="Move to Folder"
            className="max-w-md"
          >
            {/* p-1.5 keeps focus outlines inside the scroll clip
                (CommandPalette precedent). */}
            <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto p-1.5">
              {/* Destination rows: bg-hover fill at duration-micro, pressed
                  bg-active, focus rides the app-wide ring. */}
              <button
                type="button"
                onClick={handleMoveDeckToRoot}
                className={[
                  'flex w-full items-center gap-2.5 rounded-sm border border-line bg-canvas px-3 py-2.5',
                  'text-left text-body-sm font-medium text-primary',
                  'transition-colors duration-micro hover:border-strong hover:bg-hover active:bg-active',
                ].join(' ')}
              >
                <Folder size={16} strokeWidth={1.5} className="text-secondary" />
                Library (Root)
              </button>

              {/* Available Folders */}
              {items.filter(item => item.type === 'folder').map(folder => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => handleMoveDeckToFolder(folder.id)}
                  className={[
                    'flex w-full items-center gap-2.5 rounded-sm border border-line bg-canvas px-3 py-2.5',
                    'text-left text-body-sm font-medium text-primary',
                    'transition-colors duration-micro hover:border-strong hover:bg-hover active:bg-active',
                  ].join(' ')}
                >
                  <Folder size={16} strokeWidth={1.5} className="text-secondary" />
                  {folder.title || 'Untitled Folder'}
                </button>
              ))}

              {items.filter(item => item.type === 'folder').length === 0 && (
                <EmptyState
                  title="No folders yet"
                  description="Create a folder and this deck can move into it."
                  action={
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setShowMoveToFolderModal(false);
                        setDeckToMove(null);
                        handleCreateFolder();
                      }}
                    >
                      New Folder
                    </Button>
                  }
                />
              )}
            </div>
          </Modal>

          {/* Destructive gates - ConfirmModal awaits each delete, pins the
              busy label, and keeps failures inline with the confirm button
              as the retry. */}
          <ConfirmModal
            isOpen={deckToDelete !== null}
            onClose={() => setDeckToDelete(null)}
            onConfirm={performDeleteDeck}
            title="Delete Deck?"
            message={`Delete "${deckPendingDelete?.title || 'Untitled Deck'}"? Its cards go with it. This action cannot be undone.`}
            confirmText="Delete"
            pendingText="Deleting…"
          />

          <ConfirmModal
            isOpen={showBulkDeleteConfirm}
            onClose={() => setShowBulkDeleteConfirm(false)}
            onConfirm={performBulkDelete}
            title="Delete Selected Items?"
            message={`Delete ${bulkCount} ${bulkCount === 1 ? 'item' : 'items'}? This action cannot be undone.`}
            confirmText="Delete"
            pendingText="Deleting…"
          />

          <ConfirmModal
            isOpen={folderToDelete !== null}
            onClose={() => setFolderToDelete(null)}
            onConfirm={performDeleteFolder}
            title="Delete Folder?"
            message={
              folderPendingHasItems
                ? `Delete "${folderPendingDelete?.title || 'this folder'}"? All items inside will be moved to the Library.`
                : `Delete "${folderPendingDelete?.title || 'this folder'}"? This action cannot be undone.`
            }
            confirmText="Delete"
            pendingText="Deleting…"
          />
        </div>
      </div>
    );
  } else if (view === 'create') {
    content = (
      <div className="min-h-full bg-canvas">
        <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8">
          <Breadcrumb trail={['MindFlow', 'Library']} />

          <div className="mb-8 mt-6 flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setView('dashboard')}>
              <ChevronLeft size={16} strokeWidth={1.5} />
              Cancel
            </Button>
            <h1 className="text-display-sm text-primary">Create New Deck</h1>
          </div>

          <PDFToFlashcardUploader
            onDeckSaved={handleDeckSaved}
          />
        </div>
      </div>
    );
  } else if (view === 'study' && selectedDeckId) {
    content = (
      <StudyInterface
        deckId={selectedDeckId}
        onExit={handleExitStudy}
      />
    );
  }

  return <LayoutGroup>{content}</LayoutGroup>;
};

export default FlashcardDashboard;

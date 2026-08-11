import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import PDFToFlashcardUploader from './PDFToFlashcardUploader';
import StudyInterface from './StudyInterface';
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
import FolderGroup from './FolderGroup';
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from '../motion';
import { smooth, reduced } from '../motion/transitions';
import { downloadAnkiCsv, parseAnkiText } from '../utils/ankiExport';
import { saveGeneratedDeck } from '../utils/deckUtils';
import { getDueCountsByDeck } from '../utils/studyLoop';
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
} from './ui';

/**
 * FlashcardDashboard - the deck library, rebuilt on the design system.
 *
 * Visual layer only: every query (deck fetch, per-deck card counts, due
 * counts), the Supabase <-> localStorage 'mindflow-library' merge, folder
 * flows, selection mode, rename/move/delete, and Anki import/export carry
 * over verbatim from the previous build.
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
  // deck id -> number of cards whose next_review has arrived.
  const [dueByDeck, setDueByDeck] = useState({});
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

        // Fetch all decks for the current user
        const { data: decksData, error: decksError } = await supabase
          .from('decks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (decksError) {
          console.error('Error fetching decks:', decksError);
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

          // Due badges for every deck in one query. Failure here returns an
          // empty tally rather than throwing, so the library still renders.
          const { counts: dueCounts } = await getDueCountsByDeck(user.id);
          setDueByDeck(dueCounts);

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

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedItemIds.size === 0) return;

    const count = selectedItemIds.size;
    if (!window.confirm(`Are you sure you want to delete ${count} ${count === 1 ? 'item' : 'items'}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Delete decks from Supabase
      const deckIds = Array.from(selectedItemIds).filter(id => {
        const item = items.find(i => i.id === id);
        return item?.type === 'deck';
      });

      if (deckIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('decks')
          .delete()
          .in('id', deckIds);

        if (deleteError) {
          console.error('Error deleting decks:', deleteError);
          toast.error('Failed to delete some decks');
        }
      }

      // Remove items from local state
      setItems(prevItems => prevItems.filter(item => !selectedItemIds.has(item.id)));

      // Clear selection and exit selection mode
      setSelectedItemIds(new Set());
      setIsSelectionMode(false);

      toast.success(`Deleted ${count} ${count === 1 ? 'item' : 'items'}`);
    } catch (error) {
      console.error('Error in handleBulkDelete:', error);
      toast.error('An error occurred while deleting items');
    }
  };

  // Handle bulk move (not built yet - decks move one at a time via the card menu)
  const handleBulkMove = () => {
    if (selectedItemIds.size === 0) return;
    toast('Bulk move is not available yet - move decks individually from the card menu.');
  };

  // Handle delete deck
  const handleDeleteDeck = async (deckId, e) => {
    e.stopPropagation(); // Prevent card click
    setActiveMenuId(null); // Close menu

    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this deck? This action cannot be undone.')) {
      return;
    }

    try {
      // Delete the deck (cascade should handle flashcards)
      const { error: deleteError } = await supabase
        .from('decks')
        .delete()
        .eq('id', deckId);

      if (deleteError) {
        console.error('Error deleting deck:', deleteError);
        toast.error('Failed to delete deck');
        return;
      }

      // Update local state immediately
      setDecks(prevDecks => prevDecks.filter(deck => deck.id !== deckId));
      toast.success('Deck deleted successfully');
    } catch (error) {
      console.error('Error in handleDeleteDeck:', error);
      toast.error('An error occurred while deleting the deck');
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
    }
  };

  // Handle updating deck name in Supabase
  const handleUpdateDeckName = async (deckId, newName) => {
    if (!newName.trim()) {
      setEditingDeckId(null);
      setNewDeckName('');
      return;
    }

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
      toast.success('Deck renamed successfully');
    } catch (error) {
      console.error('Error renaming deck:', error);
      toast.error('Failed to rename deck');
      setEditingDeckId(null);
      setNewDeckName('');
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
  };

  // Handle folder creation from modal
  const handleConfirmCreateFolder = () => {
    const folderName = newFolderName.trim();

    // If empty string, do nothing
    if (!folderName) {
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
  };

  // Handle cancel folder creation
  const handleCancelCreateFolder = () => {
    setShowCreateFolderModal(false);
    setNewFolderName('');
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

  // Import an Anki text export (or our CSV) into a new deck
  const handleImportDeck = async () => {
    if (!user?.id) {
      toast.error('Log in to import decks.');
      return;
    }
    const cards = parseAnkiText(importText);
    if (cards.length === 0) {
      toast.error('No cards found. Export from Anki as "Notes in Plain Text" and paste or upload the file.');
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
      setDeckRefresh((c) => c + 1);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Anki import failed:', error);
      }
      toast.error('Could not import the deck. Please try again.');
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

  // Handle delete folder
  const handleDeleteFolder = (folderId, e) => {
    e.stopPropagation(); // Prevent folder click
    setActiveFolderMenuId(null); // Close menu

    // Find the folder
    const folder = items.find(item => item.type === 'folder' && item.id === folderId);
    if (!folder) return;

    // Count items in this folder (flat structure)
    const itemsInFolder = items.filter(item => item.parentId === folderId);
    const hasItems = itemsInFolder.length > 0;
    const folderName = folder.title || 'this folder';

    // Confirm deletion
    const confirmMessage = hasItems
      ? `Delete "${folderName}"? All items inside will be moved to the Library.`
      : `Delete "${folderName}"? This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

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
  // self-managed open state cannot be used here.
  const menuTriggerClasses = (extra) =>
    [
      extra,
      'flex h-7 w-7 shrink-0 items-center justify-center rounded-input text-secondary',
      'transition-colors duration-150 hover:bg-elevated hover:text-primary',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
    ].join(' ');

  const selectionCheck = (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-accent"
      aria-hidden="true"
    >
      <Check size={12} strokeWidth={2} className="text-on-accent" />
    </span>
  );

  // FolderCard
  const renderFolderCard = (folder, itemCount) => {
    const isSelected = selectedItemIds.has(folder.id);
    const isMenuOpen = activeFolderMenuId === folder.id;
    return (
      <Card
        key={folder.id}
        interactive
        className={[
          'relative flex min-h-[132px] flex-col gap-3 p-4',
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
          <span className="flex h-8 w-8 items-center justify-center rounded-input border border-soft bg-base text-secondary">
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
          <span className="font-mono text-micro uppercase text-secondary">
            {itemCount > 99 ? '99+' : itemCount} {itemCount === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Menu Dropdown - controlled, closed by the outside-click effect */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            role="menu"
            className="folder-menu-dropdown absolute right-3 top-11 z-50 min-w-[160px] rounded-card border border-soft bg-elevated p-1 shadow-modal"
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

  // DeckCard - the signature moment: layoutId expands into StudyInterface.
  const renderDeckCard = (deck, cardsDue) => {
    const isSelected = selectedItemIds.has(deck.id);
    const isMenuOpen = activeMenuId === deck.id;
    return (
      <Card
        key={deck.id}
        as={motion.div}
        layoutId={`deck-${deck.id}`}
        transition={reduce ? { duration: 0 } : smooth}
        interactive
        className={[
          'relative flex min-h-[132px] flex-col gap-3 p-4',
          isSelected ? 'border-accent-line' : '',
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
        <div className="flex items-start justify-between gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-input border border-soft bg-base text-secondary">
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

        {/* Title or inline rename input */}
        {editingDeckId === deck.id ? (
          <Input
            type="text"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            onBlur={() => handleUpdateDeckName(deck.id, newDeckName)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleUpdateDeckName(deck.id, newDeckName);
              } else if (e.key === 'Escape') {
                setEditingDeckId(null);
                setNewDeckName('');
              }
            }}
            autoFocus
            className="h-8"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <h3 className="truncate text-body font-medium text-primary">
            {deck.title || 'Untitled Deck'}
          </h3>
        )}

        <div className="mt-auto flex items-center justify-between gap-2">
          <span className="font-mono text-micro uppercase text-secondary">
            {deck.card_count ?? 0} cards
          </span>
          {cardsDue > 0 && (
            <Badge variant="accent">{cardsDue > 99 ? '99+' : cardsDue} due</Badge>
          )}
        </div>

        {/* Menu Dropdown - controlled, closed by the outside-click effect */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            role="menu"
            className="menu-dropdown absolute right-3 top-11 z-50 min-w-[180px] rounded-card border border-soft bg-elevated p-1 shadow-modal"
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

  // The Anki import form. Rendered by plain function call (no component
  // boundary) so the inputs never remount mid-keystroke. Shared between the
  // standalone Import modal and the New Deck modal's Anki tab.
  const renderAnkiImportForm = (onCancel) => {
    const previewCount = parseAnkiText(importText).length;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-small text-secondary">
          In Anki: File → Export → "Notes in Plain Text (.txt)". Upload that file
          or paste its contents below. Semicolon CSVs (like MindFlow's own export) work too.
        </p>
        <Field label="Deck name">
          <Input
            type="text"
            value={importDeckName}
            onChange={(e) => setImportDeckName(e.target.value)}
            placeholder="Deck name (optional)"
          />
        </Field>
        <Field label="Cards">
          <Textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder={'Front of card\tBack of card\n…'}
            rows={7}
            className="font-mono text-small"
          />
        </Field>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label
            className={[
              'inline-flex h-8 cursor-pointer select-none items-center gap-2 rounded-input border border-soft',
              'bg-transparent px-3 text-small font-medium text-primary',
              'transition-colors duration-150 hover:border-strong hover:bg-elevated',
              'focus-within:ring-2 focus-within:ring-accent-ring',
            ].join(' ')}
          >
            <FileUp size={14} strokeWidth={1.5} className="text-secondary" />
            Upload file…
            <input
              type="file"
              accept=".txt,.csv,.tsv,text/plain,text/csv"
              onChange={handleImportFile}
              className="sr-only"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onCancel} disabled={isImporting}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleImportDeck} disabled={isImporting || !importText.trim()}>
              {isImporting ? (
                'Importing…'
              ) : previewCount > 0 ? (
                <>
                  Import <span className="font-mono">{previewCount}</span> cards
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

    content = (
      <div className="min-h-full bg-base">
        <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8">
          <Breadcrumb
            trail={['MindFlow', 'Library']}
            right={
              <span className="font-mono text-micro uppercase text-secondary">
                {decks.length} {decks.length === 1 ? 'deck' : 'decks'}
              </span>
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
              <h1 className="text-h1 text-primary">{headerTitle}</h1>
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
                </>
              ) : (
                <>
                  <Button variant="secondary" size="sm" onClick={handleToggleSelectionMode}>
                    <X size={14} strokeWidth={1.5} />
                    Cancel
                  </Button>
                  {selectedItemIds.size > 0 && (
                    <>
                      <Button variant="secondary" size="sm" onClick={handleBulkMove}>
                        <Move size={14} strokeWidth={1.5} />
                        Move (<span className="font-mono">{selectedItemIds.size}</span>)
                      </Button>
                      <Button variant="danger" size="sm" onClick={handleBulkDelete}>
                        <Trash2 size={14} strokeWidth={1.5} />
                        Delete (<span className="font-mono">{selectedItemIds.size}</span>)
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Main Content Area */}
          {items.length === 0 && currentFolderId === null ? (
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
                className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-4"
              >
                {/* Render visible items */}
                {visibleItems.map((item) => {
                  if (item.type === 'folder') {
                    const itemCount = items.filter(i => i.parentId === item.id).length;
                    return renderFolderCard(item, itemCount);
                  } else if (item.type === 'deck') {
                    const deck = decks.find(d => d.id === item.id);
                    if (!deck) return null;
                    return renderDeckCard(deck, getCardsDue(deck.id));
                  }
                  return null;
                })}
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
                  <p className="text-small text-secondary">
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
            <Field label="Folder name">
              <Input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
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
            <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
              {/* Move to Library (Root) */}
              <button
                type="button"
                onClick={handleMoveDeckToRoot}
                className={[
                  'flex w-full items-center gap-2.5 rounded-input border border-soft bg-base px-3 py-2.5',
                  'text-left text-small font-medium text-primary',
                  'transition-colors duration-150 hover:border-strong hover:bg-elevated',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
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
                    'flex w-full items-center gap-2.5 rounded-input border border-soft bg-base px-3 py-2.5',
                    'text-left text-small font-medium text-primary',
                    'transition-colors duration-150 hover:border-strong hover:bg-elevated',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring',
                  ].join(' ')}
                >
                  <Folder size={16} strokeWidth={1.5} className="text-accent" />
                  {folder.title || 'Untitled Folder'}
                </button>
              ))}

              {items.filter(item => item.type === 'folder').length === 0 && (
                <p className="py-4 text-center text-small text-secondary">
                  No folders available. Create a folder first.
                </p>
              )}
            </div>
          </Modal>
        </div>
      </div>
    );
  } else if (view === 'create') {
    content = (
      <div className="min-h-full bg-base">
        <div className="mx-auto w-full max-w-[1200px] px-5 py-8 md:px-8">
          <Breadcrumb trail={['MindFlow', 'Library']} />

          <div className="mb-8 mt-6 flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setView('dashboard')}>
              <ChevronLeft size={16} strokeWidth={1.5} />
              Cancel
            </Button>
            <h1 className="text-h1 text-primary">Create New Deck</h1>
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

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import PDFToFlashcardUploader from './PDFToFlashcardUploader';
import StudyInterface from './StudyInterface';
import { toast } from 'react-hot-toast';
import { Zap, Play, Layers, Folder, FolderPlus, ChevronLeft, X, Check, Trash2, Move, Brain, Hand } from 'lucide-react';
import FolderGroup from './FolderGroup';
import { DndContext, DragOverlay, pointerWithin, useSensor, useSensors, PointerSensor, useDroppable } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, rectSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion } from 'framer-motion';

const FlashcardDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'create' | 'study'
  const [selectedDeckId, setSelectedDeckId] = useState(null);
  const [decks, setDecks] = useState([]);
  const [decksLoading, setDecksLoading] = useState(true);
  const [activeMenuId, setActiveMenuId] = useState(null); // Track which deck's menu is open
  const [activeFolderMenuId, setActiveFolderMenuId] = useState(null); // Track which folder's menu is open
  const [isSelectionMode, setIsSelectionMode] = useState(false); // Multi-select mode
  const [selectedItemIds, setSelectedItemIds] = useState(new Set()); // Selected items
  const [pendingDeckFolderId, setPendingDeckFolderId] = useState(null); // Store folder context when creating deck
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
  const [isDragOverRoot, setIsDragOverRoot] = useState(false); // Track if dragging over root drop zone
  const [dragOverFolderId, setDragOverFolderId] = useState(null); // Track which folder is being dragged over
  const [pulsingFolderId, setPulsingFolderId] = useState(null); // Track folder that just received a drop
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false); // Track create folder modal visibility
  const [newFolderName, setNewFolderName] = useState(''); // Track new folder name input
  const [activeId, setActiveId] = useState(null); // Track which item is currently being dragged
  const [showMoveToFolderModal, setShowMoveToFolderModal] = useState(false); // Track move to folder modal
  const [deckToMove, setDeckToMove] = useState(null); // Track which deck is being moved
  const draggedGroupIdsRef = useRef(null); // Track IDs being dragged as a group (null = single item drag)
  const [editingDeckId, setEditingDeckId] = useState(null); // Track which deck is being renamed
  const [newDeckName, setNewDeckName] = useState(''); // Store new deck name during editing

  // Configure drag sensors with activation constraint
  // Configure drag sensors with activation constraint
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null);
        setActiveFolderMenuId(null);
      }
    };

    if (activeMenuId || activeFolderMenuId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
  }, [user, view]);

  // Handle drag start - with group drag support
  const handleDragStart = (event) => {
    const { active } = event;
    setActiveId(active.id);
    
    // Check if the item being dragged is currently selected
    if (selectedItemIds.has(active.id) && selectedItemIds.size > 1) {
      // Scenario B: Dragging a selection - store all selected IDs
      draggedGroupIdsRef.current = Array.from(selectedItemIds);
      console.log('Group drag started:', draggedGroupIdsRef.current.length, 'items');
    } else {
      // Scenario A: Dragging a generic item - single item drag
      draggedGroupIdsRef.current = null;
    }
  };

  // Handle drag over (with folder drop detection)
  const handleDragOver = (event) => {
    const { active, over } = event;
    
    if (!over) {
      setIsDragOverRoot(false);
      setDragOverFolderId(null);
      return;
    }

    // Check if dragging over root drop zone
    if (over.id === 'root-drop-zone') {
      setIsDragOverRoot(true);
      setDragOverFolderId(null);
      return;
    }

    setIsDragOverRoot(false);

    // Guard Clause: Prevent grid reordering when dragging deck over folder
    const activeItem = items.find(item => item.id === active.id);
    const overItem = items.find(item => item.id === over.id);

    if (activeItem?.type === 'deck' && overItem?.type === 'folder') {
      // Deck over folder - set visual feedback and return early
      // This prevents the grid from shifting/reordering
      setDragOverFolderId(over.id);
      return; // Early return prevents any reordering logic
    }

    // Normal sorting behavior for deck-to-deck or folder-to-folder
    setDragOverFolderId(null);
  };

  // Handle drag end (with folder drop support and group drag)
  const handleDragEnd = (event) => {
    const { active, over } = event;

    // Determine which items to move (group or single)
    const itemsToMove = draggedGroupIdsRef.current || [active.id];
    const isGroupDrag = draggedGroupIdsRef.current !== null && draggedGroupIdsRef.current.length > 1;

    // Reset drag states
    setActiveId(null);
    setIsDragOverRoot(false);
    setDragOverFolderId(null);
    draggedGroupIdsRef.current = null; // Clear group drag ref

    // Log for debugging
    console.log('Drag End - active.id:', active.id, 'over.id:', over?.id, 'itemsToMove:', itemsToMove.length);

    if (!over || active.id === over.id) {
      console.log('Drag cancelled - no over or same position');
      return;
    }

    // Check if dropping on root drop zone (move to root)
    if (over.id === 'root-drop-zone') {
      console.log('Moving to root:', isGroupDrag ? `${itemsToMove.length} items` : '1 item');
      setItems((items) => {
        return items.map(item => 
          itemsToMove.includes(item.id)
            ? { ...item, parentId: null }
            : item
        );
      });
      
      // Clear selection after successful move
      if (isGroupDrag) {
        setSelectedItemIds(new Set());
        setIsSelectionMode(false);
      }
      
      toast.success(isGroupDrag ? `${itemsToMove.length} items moved to Library` : 'Item moved to Library');
      return;
    }

    // Check if dropping into a folder (Trap Door Logic)
    const activeItem = items.find(item => item.id === active.id);
    const overItem = items.find(item => item.id === over.id);

    if (activeItem?.type === 'deck' && overItem?.type === 'folder') {
      console.log('Moving to folder:', over.id, isGroupDrag ? `${itemsToMove.length} items` : '1 item');
      
      // Atomic state update - move all items in group to folder
      setItems((items) => {
        return items.map(item => 
          itemsToMove.includes(item.id)
            ? { ...item, parentId: over.id }
            : item
        );
      });

      // Trigger pulse animation
      setPulsingFolderId(over.id);
      setTimeout(() => setPulsingFolderId(null), 600);

      // Clear selection after successful move
      if (isGroupDrag) {
        setSelectedItemIds(new Set());
        setIsSelectionMode(false);
      }

      toast.success(isGroupDrag ? `${itemsToMove.length} items moved to folder` : 'Item moved to folder');
      return;
    }

    // Reordering within the same view (same parentId) - only for single item drags
    // Group reordering is complex, so we'll only allow single item reordering
    if (!isGroupDrag) {
      const oldIndex = visibleItems.findIndex((item) => item.id === active.id);
      const newIndex = visibleItems.findIndex((item) => item.id === over.id);

      console.log('Reordering - oldIndex:', oldIndex, 'newIndex:', newIndex);

      if (oldIndex === -1 || newIndex === -1) {
        console.log('Item not found in visible items - oldIndex:', oldIndex, 'newIndex:', newIndex);
        return; // Item not found in visible items
      }

      // Simple reordering using arrayMove
      setItems((items) => {
        const reorderedVisible = arrayMove(visibleItems, oldIndex, newIndex);
        
        // Get all items that are NOT in the current view (different parentId)
        const otherItems = items.filter(item => item.parentId !== currentFolderId);
        
        // Return reordered visible items + other items
        return [...reorderedVisible, ...otherItems];
      });
    }
  };

  // BackToLibraryButton Component
  const BackToLibraryButton = ({ onClick }) => {
    return (
      <button
        onClick={onClick}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          padding: '8px 12px',
          color: '#ffffff',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '500',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = '#00FF94';
          e.currentTarget.style.backgroundColor = 'rgba(0, 255, 148, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <ChevronLeft size={18} style={{ stroke: '#00FF94' }} />
        Back to Library
      </button>
    );
  };

  // FolderCard Component
  const FolderCard = ({ folder, itemCount, onClick, isMenuOpen, onToggleMenu, onDelete, isSelected, isSelectionMode }) => {
    const style = {
      transition: 'border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease',
      background: '#0A0A0A', // Deep dark grey/black - matches deck cards
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderRadius: '24px',
      border: isSelected
        ? '3px solid #00FF94'
        : '1px solid rgba(255, 255, 255, 0.08)',
      outline: isSelected ? '2px solid #00FF94' : 'none',
      outlineOffset: isSelected ? '2px' : '0',
      cursor: 'pointer',
      boxShadow: isSelected
        ? '0 0 40px rgba(0, 255, 148, 0.6), 0 0 20px rgba(0, 255, 148, 0.3), 0 4px 24px rgba(0, 0, 0, 0.4)'
        : '0 4px 24px rgba(0, 0, 0, 0.4)',
      position: 'relative',
      overflow: 'visible',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px 20px 24px 20px', // Increased bottom padding
      aspectRatio: '1 / 1', // Force square aspect ratio
      width: '100%',
      zIndex: isSelected ? 40 : 'auto',
    };

    return (
      <motion.div
        style={style}
        onClick={(e) => {
          // Don't trigger folder click if clicking on menu
          if (e.target.closest('.folder-menu-button') || e.target.closest('.folder-menu-dropdown')) {
            return;
          }
          // In selection mode, toggle selection instead of opening
          if (isSelectionMode) {
            // Selection is handled by parent component via handleFolderClick
            onClick();
            return;
          }
          onClick();
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
          e.currentTarget.style.boxShadow = '0 4px 24px rgba(0, 0, 0, 0.4)';
        }}
      >
        {/* Clean Menu Button */}
        <button
          className="folder-menu-button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onToggleMenu(folder.id, e);
          }}
          style={{
          position: 'absolute',
            top: '16px',
            right: '16px',
            width: '36px',
            height: '36px',
            borderRadius: '12px', // Squircle style
            border: 'none',
            background: 'rgba(10, 10, 10, 0.8)', // Subtle dark glass
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: '#00FF94', // Neon green icon
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            zIndex: 10,
            padding: '8px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 255, 148, 0.1)'; // Subtle green tint on hover
            e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 255, 148, 0.2)'; // Subtle neon glow
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(10, 10, 10, 0.8)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <svg style={{ width: '20px', height: '20px', stroke: 'currentColor', fill: 'none', strokeWidth: '2' }} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>

        {/* Menu Dropdown */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="folder-menu-dropdown"
            style={{
            position: 'absolute',
              top: '48px',
              right: '16px',
              backgroundColor: 'rgba(30, 41, 59, 0.95)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '8px',
              minWidth: '160px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              zIndex: 50,
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDelete(folder.id, e);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: '#ef4444',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'background 0.2s ease',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg style={{ width: '16px', height: '16px', stroke: 'currentColor', fill: 'none', strokeWidth: '2' }} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Delete
            </button>
          </div>
        )}

        {/* Folder Icon - Clean and Neutral */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Clean Icon - No background container */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {/* Folder Icon - Clean and Neutral */}
            <Folder 
              size={64} 
              style={{ 
                stroke: '#ffffff',
                fill: 'none',
                strokeWidth: '1.5',
              }} 
            />
            
            {/* iOS Notification Badge for Item Count */}
            {itemCount > 0 && (
              <div style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                minWidth: '20px',
                height: '20px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                fontSize: '11px',
                fontWeight: '700',
                color: '#ffffff',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(0, 0, 0, 0.2)',
                zIndex: 10,
              }}>
                {itemCount > 99 ? '99+' : itemCount}
              </div>
            )}
          </div>
        </div>

        {/* Selection Checkmark Badge */}
        {isSelected && (
        <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '32px',
            height: '32px',
            background: '#00FF94',
            borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0, 255, 148, 0.4), 0 0 0 2px rgba(0, 0, 0, 0.2)',
            zIndex: 50,
            padding: '4px',
          }}>
            <Check size={20} style={{ stroke: '#000000', strokeWidth: '3', fill: 'none' }} />
        </div>
        )}

        {/* Folder Title - Bottom Aligned */}
        <h3 style={{
          fontSize: '16px',
          fontWeight: '700',
          color: '#ffffff',
          textAlign: 'center',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          margin: '0',
          marginTop: 'auto',
          paddingTop: '20px',
          paddingBottom: '4px',
          position: 'relative',
          zIndex: 1,
        }}>
          {folder.title || 'Untitled Folder'}
        </h3>

      </motion.div>
    );
  };

  // DeckCard Component
  const DeckCard = ({ deck, cardsDue, isMenuOpen, onDeckClick, onToggleMenu, onRename, onDelete, isSelected, isSelectionMode, editingDeckId, newDeckName, setNewDeckName, onUpdateDeckName }) => {
    const gradient = getDeckGradient();

    const style = {
      background: '#0A0A0A', // Deep dark grey/black
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      borderRadius: '24px',
      border: isSelected
        ? '3px solid #00FF94'
        : '1px solid rgba(255, 255, 255, 0.1)',
      outline: isSelected ? '2px solid #00FF94' : 'none',
      outlineOffset: isSelected ? '2px' : '0',
      cursor: 'pointer',
      boxShadow: isSelected
        ? '0 0 40px rgba(0, 255, 148, 0.6), 0 0 20px rgba(0, 255, 148, 0.3), 0 4px 24px rgba(0, 0, 0, 0.4)'
        : '0 4px 24px rgba(0, 0, 0, 0.4)',
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      padding: '24px',
      aspectRatio: '1 / 1', // Force square aspect ratio
      width: '100%',
      zIndex: isSelected ? 40 : 'auto',
    };

    return (
      <div
        style={style}
        onClick={(e) => {
          // Don't trigger deck click if clicking on menu
          if (e.target.closest('.menu-button') || e.target.closest('.menu-dropdown')) {
            return;
          }
          // In selection mode, the parent handles selection toggle
          // onDeckClick already handles this via handleDeckClick
          onDeckClick(deck.id, e);
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.02)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          e.currentTarget.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = '';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.boxShadow = '0 4px 16px rgba(0, 0, 0, 0.3)';
        }}
      >

        {/* Deck Icon with Ambient Light - Centered in Middle */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          position: 'relative',
          zIndex: 1,
          minHeight: '100px',
        }}>
          {/* Clean Icon - No background container, just the icon */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Layers Icon - Clean and Neutral */}
            <Layers 
              size={64} 
              style={{ 
                stroke: '#ffffff',
                fill: 'none',
                strokeWidth: '1.5',
              }} 
            />
            
            {/* iOS Notification Badge for Cards Due */}
            {cardsDue > 0 && (
              <div style={{
                position: 'absolute',
                top: '-4px',
                right: '-4px',
                minWidth: '20px',
                height: '20px',
                background: 'rgba(255, 255, 255, 0.2)',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 6px',
                fontSize: '11px',
                fontWeight: '700',
                color: '#ffffff',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 2px rgba(0, 0, 0, 0.2)',
                zIndex: 10,
              }}>
                {cardsDue > 99 ? '99+' : cardsDue}
              </div>
            )}
          </div>
        </div>

        {/* Selection Checkmark Badge */}
        {isSelected && (
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            width: '32px',
            height: '32px',
            background: '#00FF94',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0, 255, 148, 0.4), 0 0 0 2px rgba(0, 0, 0, 0.2)',
            zIndex: 50,
            padding: '4px',
          }}>
            <Check size={20} style={{ stroke: '#000000', strokeWidth: '3', fill: 'none' }} />
          </div>
        )}

        {/* Bottom Section: Title + Card Count Badge */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          position: 'relative',
          zIndex: 1,
          width: '100%',
          flexShrink: 0,
        }}>
          {/* Card Count Badge */}
          <div style={{
            fontSize: '12px',
            fontWeight: '500',
            color: 'rgba(255, 255, 255, 0.6)',
            background: 'rgba(255, 255, 255, 0.05)',
            padding: '4px 8px',
            borderRadius: '9999px',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          }}>
            {deck.card_count ?? 0} Cards
          </div>

          {/* Title or Edit Input */}
          {editingDeckId === deck.id ? (
            <input
              type="text"
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              onBlur={() => onUpdateDeckName(deck.id, newDeckName)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onUpdateDeckName(deck.id, newDeckName);
                } else if (e.key === 'Escape') {
                  setEditingDeckId(null);
                  setNewDeckName('');
                }
              }}
              autoFocus
              style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#ffffff',
                textAlign: 'center',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                padding: '4px 8px',
                width: '100%',
                maxWidth: '100%',
                outline: 'none',
                margin: 0,
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h3 style={{
              fontSize: '16px',
              fontWeight: '700',
              color: '#ffffff',
              textAlign: 'center',
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              margin: 0,
              padding: '0 8px',
              width: '100%',
              textDecoration: 'none',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineClamp: 2,
              maxHeight: '48px',
            }}>
              {deck.title || 'Untitled Deck'}
            </h3>
          )}
        </div>

        {/* Three Dots Menu Button */}
        <button
          className="menu-button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onToggleMenu(deck.id, e);
          }}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            border: 'none',
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(8px)',
            color: 'rgba(255, 255, 255, 0.9)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease',
            zIndex: 10,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(0, 255, 148, 0.2)';
            e.currentTarget.style.color = '#00FF94';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.3)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
          }}
        >
          <svg style={{ width: '20px', height: '20px', stroke: 'currentColor', fill: 'none', strokeWidth: '2' }} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>

        {/* Menu Dropdown */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            className="menu-dropdown"
            style={{
              position: 'absolute',
              top: '48px',
              right: '16px',
              backgroundColor: 'rgba(30, 41, 59, 0.95)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '8px',
              minWidth: '160px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
              zIndex: 50,
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRename(deck.id, e);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'background 0.2s ease',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 255, 148, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg style={{ width: '16px', height: '16px', stroke: 'currentColor', fill: 'none', strokeWidth: '2' }} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              Rename
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                setDeckToMove(deck.id);
                setShowMoveToFolderModal(true);
                setActiveMenuId(null);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'background 0.2s ease',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 255, 148, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg style={{ width: '16px', height: '16px', stroke: 'currentColor', fill: 'none', strokeWidth: '2' }} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
              </svg>
              Move to Folder
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onDelete(deck.id, e);
              }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: 'none',
                background: 'transparent',
                color: '#ef4444',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'background 0.2s ease',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <svg style={{ width: '16px', height: '16px', stroke: 'currentColor', fill: 'none', strokeWidth: '2' }} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
              Delete
            </button>
          </div>
        )}

      </div>
    );
  };

  // Get emoji based on first letter of title
  const getDeckEmoji = (title) => {
    if (!title) return '📚';
    const firstLetter = title.charAt(0).toUpperCase();
    const emojiMap = {
      'A': '📖', 'B': '📘', 'C': '📗', 'D': '📙', 'E': '📕',
      'F': '📓', 'G': '📔', 'H': '📒', 'I': '📑', 'J': '📋',
      'K': '📊', 'L': '📈', 'M': '📉', 'N': '📇', 'O': '📅',
      'P': '📆', 'Q': '📝', 'R': '📄', 'S': '📃', 'T': '📜',
      'U': '📰', 'V': '📑', 'W': '📋', 'X': '📊', 'Y': '📈', 'Z': '📉'
    };
    return emojiMap[firstLetter] || '📚';
  };

  // Green gradient for deck icons (consistent theme)
  const getDeckGradient = () => {
    // Always return green gradient for consistent branding
    return { from: '#00FF94', to: '#00D977' }; // Neon green to darker emerald
  };

  // Calculate cards due (placeholder - can be enhanced later)
  const getCardsDue = (deckId) => {
    // For now, return a dummy value
    // Later: Query flashcards where next_review <= today
    return 0;
  };

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

  // Handle bulk move (placeholder for now)
  const handleBulkMove = () => {
    if (selectedItemIds.size === 0) return;
    toast.info('Bulk move feature coming soon!');
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

  // Handle reset data
  const handleResetData = () => {
    if (window.confirm('Are you sure you want to reset all data? This will clear your library and reload the page.')) {
      localStorage.removeItem('mindflow-library');
      window.location.reload();
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

  // Get visible items based on current folder view (flat structure)
  const getVisibleItems = () => {
    // Filter items by parentId - root items have parentId: null
    return items.filter(item => item.parentId === currentFolderId);
  };
  
  const visibleItems = getVisibleItems();

  // Dashboard View
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

    return (
      <div style={{
        padding: '32px',
        minHeight: '100%',
        background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.8) 0%, rgba(3, 7, 18, 0.95) 40%, #030712 100%)',
      }}>
        {/* Header and Action Bar Container - Centered */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          marginBottom: '32px',
        }}>
          {/* Top Navigation Bar - Centered */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            marginBottom: '24px',
          }}>
            {/* Title with Back button if in folder or unsorted decks view */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            {currentFolderId !== null && (
                <BackToLibraryButton onClick={() => {
                  setCurrentFolderId(null);
                }} />
              )}
              <h1 style={{
                fontSize: '48px', // text-5xl equivalent
                fontWeight: '700',
                color: '#00FF94', // Neon green text
                margin: 0,
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                textShadow: '0 0 20px rgba(0, 255, 148, 0.6), 0 0 40px rgba(0, 255, 148, 0.3)',
              }}>
                {headerTitle}
              </h1>
            </div>
          </div>

          {/* Action Bar - Show everywhere */}
          <div style={{
              maxWidth: '1200px',
              width: '100%',
              background: 'rgba(255, 255, 255, 0.05)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              borderRadius: '16px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'row',
              gap: '12px',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {/* Select Button / Cancel Button */}
            {!isSelectionMode ? (
              <button
                onClick={handleToggleSelectionMode}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(0, 255, 148, 0.2)',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  color: '#00FF94',
                  fontSize: '14px',
                  fontWeight: '600',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 255, 148, 0.1)';
                  e.currentTarget.style.borderColor = 'rgba(0, 255, 148, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.borderColor = 'rgba(0, 255, 148, 0.2)';
                }}
              >
                <Check size={18} style={{ stroke: '#00FF94', fill: 'none' }} />
                Select
              </button>
            ) : (
              <>
                <button
                  onClick={handleToggleSelectionMode}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    padding: '10px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease',
                    color: 'rgba(255, 255, 255, 0.8)',
                    fontSize: '14px',
                    fontWeight: '600',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }}
                >
                  <X size={18} style={{ stroke: 'currentColor', fill: 'none' }} />
                  Cancel
                </button>
                
                {selectedItemIds.size > 0 && (
                  <>
                    <button
                      onClick={handleBulkMove}
                      style={{
                        background: 'rgba(0, 255, 148, 0.1)',
                        border: '1px solid rgba(0, 255, 148, 0.3)',
                        borderRadius: '12px',
                        padding: '10px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        color: '#00FF94',
                        fontSize: '14px',
                        fontWeight: '600',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(0, 255, 148, 0.15)';
                        e.currentTarget.style.borderColor = 'rgba(0, 255, 148, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(0, 255, 148, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(0, 255, 148, 0.3)';
                      }}
                    >
                      <Move size={18} style={{ stroke: '#00FF94', fill: 'none' }} />
                      Move ({selectedItemIds.size})
                    </button>
                    
                    <button
                      onClick={handleBulkDelete}
                      style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '12px',
                        padding: '10px 16px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease',
                        color: '#ef4444',
                        fontSize: '14px',
                        fontWeight: '600',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                        e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                      }}
                    >
                      <Trash2 size={18} style={{ stroke: '#ef4444', fill: 'none' }} />
                      Delete ({selectedItemIds.size})
                    </button>
                  </>
                )}
              </>
            )}

            {/* New Folder Button - Dark with Green Accent */}
            {!isSelectionMode && (
              <button
                onClick={handleCreateFolder}
                style={{
                  background: 'rgba(10, 10, 10, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  color: '#ffffff', // White text
                  fontSize: '14px',
                  fontWeight: '600',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 255, 148, 0.1)'; // Subtle green tint on hover
                  e.currentTarget.style.borderColor = 'rgba(0, 255, 148, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(10, 10, 10, 0.8)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                <FolderPlus size={18} style={{ stroke: '#00FF94', fill: 'none' }} />
                New Folder
              </button>
            )}

            {/* New Deck Button - Dark with Green Accent */}
            {!isSelectionMode && (
              <button
                onClick={handleCreateDeck}
                style={{
                  background: 'rgba(10, 10, 10, 0.8)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  padding: '10px 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.2s ease',
                  color: '#ffffff', // White text
                  fontSize: '14px',
                  fontWeight: '600',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 255, 148, 0.1)'; // Subtle green tint on hover
                  e.currentTarget.style.borderColor = 'rgba(0, 255, 148, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(10, 10, 10, 0.8)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                <Layers size={18} style={{ stroke: '#00FF94', fill: 'none' }} />
                New Deck
              </button>
            )}

          </div>
        </div>

        {/* Main Content Area */}
        {/* Check for Empty State - Show Welcome Hero */}
        {items.length === 0 && currentFolderId === null ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            width: '100%',
            position: 'relative',
            padding: '64px 32px',
          }}>
            {/* Background Radial Gradient */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '800px',
              height: '800px',
              background: 'radial-gradient(circle at center, rgba(0, 255, 148, 0.08) 0%, rgba(0, 255, 148, 0.02) 40%, transparent 70%)',
              pointerEvents: 'none',
              zIndex: 0,
            }} />

            {/* Welcome Hero Content */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                position: 'relative',
                zIndex: 1,
                maxWidth: '600px',
              }}
            >
              {/* Pulsing Icon */}
              <motion.div
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.8, 1, 0.8],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                style={{
                  marginBottom: '32px',
                }}
              >
                <Brain 
                  size={96} 
                  style={{ 
                    stroke: '#00FF94',
                    fill: 'none',
                    strokeWidth: '2',
                    filter: 'drop-shadow(0 0 20px rgba(0, 255, 148, 0.5))',
                  }} 
                />
              </motion.div>

              {/* Title */}
              <h2 style={{
                fontSize: '36px',
                fontWeight: '700',
                color: '#ffffff',
                marginBottom: '16px',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}>
                Welcome to Mindflow
              </h2>

              {/* Subtitle */}
              <p style={{
                fontSize: '18px',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '40px',
                maxWidth: '480px',
                lineHeight: '1.6',
                fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              }}>
                Your AI-powered path to mastery. Create your first deck to get started.
              </p>

              {/* Primary Action Button */}
              <button
                onClick={handleCreateDeck}
                style={{
                  background: '#00FF94',
                  color: '#000000',
                  border: 'none',
                  padding: '16px 32px',
                  borderRadius: '12px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                  transition: 'all 0.3s ease',
                  boxShadow: '0 0 0 0 rgba(0, 255, 148, 0.4)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 255, 148, 0.6), 0 0 60px rgba(0, 255, 148, 0.3)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 0 0 rgba(0, 255, 148, 0.4)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                Create First Deck
              </button>
            </motion.div>
          </div>
        ) : (
              <div style={{
                maxWidth: '1200px',
                margin: '0 auto',
                width: '100%',
              }}>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentFolderId || 'root'}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: '32px',
                      marginTop: '32px',
                      minHeight: '500px',
                      flexGrow: 1,
                    }}
                  >

              {/* Render visible items */}
              {visibleItems.map((item) => {
                if (item.type === 'folder') {
                  const itemCount = items.filter(i => i.parentId === item.id).length;
                  return (
                    <FolderCard
                      key={item.id}
                      folder={item}
                      itemCount={itemCount}
                      isMenuOpen={activeFolderMenuId === item.id}
                      onClick={() => handleFolderClick(item.id)}
                      onToggleMenu={toggleFolderMenu}
                      onDelete={handleDeleteFolder}
                      isSelected={selectedItemIds.has(item.id)}
                      isSelectionMode={isSelectionMode}
                    />
                  );
                } else if (item.type === 'deck') {
                  const deck = decks.find(d => d.id === item.id);
                  if (!deck) return null;
                  const cardsDue = getCardsDue(deck.id);
                  return (
                    <DeckCard
                      key={item.id}
                      deck={deck}
                      cardsDue={cardsDue}
                      isMenuOpen={activeMenuId === deck.id}
                      onDeckClick={handleDeckClick}
                      onToggleMenu={toggleMenu}
                      onRename={handleRenameDeck}
                      onDelete={handleDeleteDeck}
                      isSelected={selectedItemIds.has(item.id)}
                      isSelectionMode={isSelectionMode}
                      editingDeckId={editingDeckId}
                      newDeckName={newDeckName}
                      setNewDeckName={setNewDeckName}
                      onUpdateDeckName={handleUpdateDeckName}
                    />
                  );
                }
                return null;
              })}
                </motion.div>
              </AnimatePresence>
            </div>
        )}

        {/* Create Folder Modal */}
        {showCreateFolderModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={handleCancelCreateFolder}
          >
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.9)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(0, 255, 148, 0.2)',
                borderRadius: '24px',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                padding: '32px',
                width: '90%',
                maxWidth: '480px',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#ffffff',
                  margin: 0,
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                }}>
                  Create Folder
                </h2>
                <button
                  onClick={handleCancelCreateFolder}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.6)',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Input Field */}
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name"
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '12px',
                  color: '#ffffff',
                  fontSize: '16px',
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                  outline: 'none',
                  transition: 'all 0.2s ease',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = '#00FF94';
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 255, 148, 0.1)';
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
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

              {/* Buttons */}
              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end',
              }}>
                <button
                  onClick={handleCancelCreateFolder}
                  style={{
                    padding: '12px 24px',
                    background: 'transparent',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '12px',
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmCreateFolder}
                  style={{
                    padding: '12px 24px',
                    background: 'rgba(0, 255, 148, 0.1)',
                    border: '1px solid rgba(0, 255, 148, 0.3)',
                    borderRadius: '12px',
                    color: '#00FF94',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 255, 148, 0.2)';
                    e.currentTarget.style.borderColor = '#00FF94';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 255, 148, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(0, 255, 148, 0.3)';
                  }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Move to Folder Modal */}
        {showMoveToFolderModal && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => {
              setShowMoveToFolderModal(false);
              setDeckToMove(null);
            }}
          >
            <div
              style={{
                background: 'rgba(30, 41, 59, 0.9)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(0, 255, 148, 0.2)',
                borderRadius: '24px',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
                padding: '32px',
                width: '90%',
                maxWidth: '480px',
                maxHeight: '80vh',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <h2 style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#ffffff',
                  margin: 0,
                  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                }}>
                  Move to Folder
                </h2>
                <button
                  onClick={() => {
                    setShowMoveToFolderModal(false);
                    setDeckToMove(null);
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'rgba(255, 255, 255, 0.6)',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Folder List */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}>
                {/* Move to Library (Root) */}
                <button
                  onClick={handleMoveDeckToRoot}
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    color: 'rgba(255, 255, 255, 0.9)',
                    fontSize: '16px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 255, 148, 0.1)';
                    e.currentTarget.style.borderColor = 'rgba(0, 255, 148, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                >
                  <Folder size={20} style={{ stroke: 'currentColor', fill: 'none' }} />
                  Library (Root)
                </button>

                {/* Available Folders */}
                {items.filter(item => item.type === 'folder').map(folder => (
                  <button
                    key={folder.id}
                    onClick={() => handleMoveDeckToFolder(folder.id)}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontSize: '16px',
                      fontWeight: '500',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 255, 148, 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(0, 255, 148, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                    }}
                  >
                    <Folder size={20} style={{ stroke: '#00FF94', fill: 'none' }} />
                    {folder.title || 'Untitled Folder'}
                  </button>
                ))}

                {items.filter(item => item.type === 'folder').length === 0 && (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: 'rgba(255, 255, 255, 0.5)',
                    fontSize: '14px',
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                  }}>
                    No folders available. Create a folder first.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reset Data Button */}
        <button
          onClick={handleResetData}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            padding: '10px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '12px',
            color: '#ef4444',
            fontSize: '12px',
            fontWeight: '600',
            cursor: 'pointer',
            fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            transition: 'all 0.2s ease',
            zIndex: 100,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
            e.currentTarget.style.borderColor = '#ef4444';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
          }}
        >
          Reset Data
        </button>
      </div>
    );
  }

  // Create view
  if (view === 'create') {
    return (
      <div style={{
        padding: '32px',
        minHeight: '100%',
        background: 'radial-gradient(ellipse at center, rgba(15, 23, 42, 0.8) 0%, rgba(3, 7, 18, 0.95) 40%, #030712 100%)',
      }}>
        {/* Top Navigation Bar with Cancel Button */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
          }}>
            <button
              onClick={() => setView('dashboard')}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: '#ffffff',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#00FF94';
                  e.currentTarget.style.backgroundColor = 'rgba(0, 255, 148, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <ChevronLeft size={18} style={{ stroke: '#00FF94' }} />
              Cancel
              </button>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              color: '#ffffff',
              margin: 0,
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            }}>
              Create New Deck
            </h1>
          </div>
        </div>

        {/* Create Deck Form */}
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          width: '100%',
        }}>
          <PDFToFlashcardUploader
            onDeckSaved={handleDeckSaved}
          />
        </div>
      </div>
    );
  }

  // Handle exit from study view
  const handleExitStudy = () => {
    setView('dashboard');
    setSelectedDeckId(null);
  };

  // Study view
  if (view === 'study' && selectedDeckId) {
                return (
      <StudyInterface
        deckId={selectedDeckId}
        onExit={handleExitStudy}
      />
    );
  }

  return null;
};

export default FlashcardDashboard;
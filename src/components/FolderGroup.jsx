import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { Button, Card, EmptyState, Modal } from './ui';

/**
 * FolderGroup - a folder tile with a 3x3 preview grid that opens into a
 * modal listing its items. Visual layer rebuilt on the design system; the
 * behavior contract is unchanged: closed tile opens on click, backdrop click
 * closes, clicking an item calls onItemClick(item) and closes.
 *
 * Row states: tile and item cards fill bg-hover at duration-micro and press
 * to bg-active (never a scale or lift); keyboard reach comes from Card's
 * control contract (plain div + interactive + onClick), with focus rendered
 * by the app-wide :focus-visible ring. An empty folder's modal names the
 * gap instead of showing a blank grid. Everything here is synchronous and
 * read-only, so there is no loading or error state to represent.
 */
const FolderGroup = ({ folder, children = [], onItemClick }) => {
  const [isOpen, setIsOpen] = useState(false);

  // Get preview items (first 9 for 3x3 grid)
  const previewItems = children.slice(0, 9);

  // Fill empty slots to always show 3x3 grid
  const gridItems = [...previewItems];
  while (gridItems.length < 9) {
    gridItems.push(null);
  }

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Closed State - Folder Tile */}
      <Card
        interactive
        onClick={handleOpen}
        className="relative flex h-[200px] w-full flex-col p-4 duration-micro active:bg-active"
      >
        {/* 3x3 Grid of Previews - decorative, so hidden from assistive tech;
            hollow cells read as remaining capacity, filled cells as decks. */}
        <div className="grid flex-1 grid-cols-3 grid-rows-3 gap-1" aria-hidden="true">
          {gridItems.map((item, index) => (
            <div
              key={index}
              className={
                item
                  ? 'border border-accent-line bg-accent-wash'
                  : 'border border-line bg-canvas'
              }
            />
          ))}
        </div>

        {/* Overflow Count Badge */}
        {children.length > 9 && (
          <span className="absolute right-3 top-3 rounded-pill border border-line bg-raised px-2 py-0.5 text-label-sm text-secondary">
            +{children.length - 9}
          </span>
        )}

        {/* Folder Title (Bottom) */}
        <h3 className="mt-3 w-full truncate text-center text-body-sm font-medium text-primary">
          {folder.title || 'Untitled Folder'}
        </h3>
      </Card>

      {/* Open State - Modal (portals to body; scrim click and Escape close) */}
      <Modal
        open={isOpen}
        onClose={handleClose}
        title={folder.title || 'Untitled Folder'}
        className="max-w-3xl"
        footer={
          <span className="text-label-sm text-secondary">
            {children.length} {children.length === 1 ? 'item' : 'items'}
          </span>
        }
      >
        {children.length === 0 ? (
          /* Decks arrive here by being moved from the library, so the one
             resolving action is to go back where the moving happens. */
          <EmptyState
            icon={<Layers size={18} strokeWidth={1.5} />}
            title="This folder is empty"
            description="Move decks into it from the library and they will show up here."
            action={
              <Button variant="secondary" size="sm" onClick={handleClose}>
                Back to Library
              </Button>
            }
          />
        ) : (
          /* p-1.5 keeps focus outlines inside the scroll clip
             (CommandPalette precedent). */
          <div className="grid max-h-[60vh] grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 overflow-y-auto p-1.5">
            {children.map((item, index) => (
              <Card
                key={item.id || index}
                interactive
                onClick={() => {
                  if (onItemClick) {
                    onItemClick(item);
                  }
                  handleClose();
                }}
                className="flex flex-col items-center gap-2 p-4 duration-micro active:bg-active"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-sm border border-line bg-canvas text-secondary">
                  <Layers size={16} strokeWidth={1.5} />
                </span>
                <span className="w-full truncate text-center text-body-sm font-medium text-primary">
                  {item.title || 'Untitled'}
                </span>
              </Card>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
};

export default FolderGroup;

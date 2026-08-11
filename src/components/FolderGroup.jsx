import React, { useState } from 'react';
import { Layers } from 'lucide-react';
import { Card, Modal } from './ui';

/**
 * FolderGroup - a folder tile with a 3x3 preview grid that opens into a
 * modal listing its items. Visual layer rebuilt on the design system; the
 * behavior contract is unchanged: closed tile opens on click, backdrop click
 * closes, clicking an item calls onItemClick(item) and closes.
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
        className="relative flex h-[200px] w-full flex-col p-4"
      >
        {/* 3x3 Grid of Previews */}
        <div className="grid flex-1 grid-cols-3 grid-rows-3 gap-1" aria-hidden="true">
          {gridItems.map((item, index) => (
            <div
              key={index}
              className={
                item
                  ? 'border border-accent-line bg-accent-wash'
                  : 'border border-soft bg-base'
              }
            />
          ))}
        </div>

        {/* Overflow Count Badge */}
        {children.length > 9 && (
          <span className="absolute right-3 top-3 rounded-pill border border-soft bg-elevated px-2 py-0.5 font-mono text-micro text-secondary">
            +{children.length - 9}
          </span>
        )}

        {/* Folder Title (Bottom) */}
        <h3 className="mt-3 w-full truncate text-center text-small font-medium text-primary">
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
          <span className="font-mono text-micro uppercase text-secondary">
            {children.length} {children.length === 1 ? 'item' : 'items'}
          </span>
        }
      >
        <div className="grid max-h-[60vh] grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 overflow-y-auto">
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
              className="flex flex-col items-center gap-2 p-4"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-input border border-soft bg-base text-secondary">
                <Layers size={16} strokeWidth={1.5} />
              </span>
              <span className="w-full truncate text-center text-small font-medium text-primary">
                {item.title || 'Untitled'}
              </span>
            </Card>
          ))}
        </div>
      </Modal>
    </>
  );
};

export default FolderGroup;

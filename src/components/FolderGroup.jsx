import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  return (
    <>
      {/* Closed State - Folder Icon */}
      <motion.div
        onClick={handleOpen}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        style={{
          width: '100%',
          height: '200px',
          borderRadius: '16px',
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Folder Title (Bottom) */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '16px',
          right: '16px',
          textAlign: 'center',
          fontSize: '14px',
          fontWeight: '600',
          color: '#ffffff',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
          zIndex: 2,
        }}>
          {folder.title || 'Untitled Folder'}
        </div>

        {/* 3x3 Grid of Previews */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gridTemplateRows: 'repeat(3, 1fr)',
          gap: '4px',
          flex: 1,
          marginBottom: '32px',
        }}>
          {gridItems.map((item, index) => (
            <div
              key={index}
              style={{
                background: item 
                  ? 'rgba(0, 255, 148, 0.2)' 
                  : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${item ? 'rgba(0, 255, 148, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
                color: item ? '#00FF94' : 'rgba(255, 255, 255, 0.3)',
                fontFamily: 'monospace',
                fontWeight: '600',
              }}
            >
              {item ? '📚' : ''}
            </div>
          ))}
        </div>

        {/* Item Count Badge */}
        {children.length > 9 && (
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(0, 255, 148, 0.2)',
            border: '1px solid rgba(0, 255, 148, 0.4)',
            borderRadius: '8px',
            padding: '4px 8px',
            fontSize: '11px',
            fontWeight: '600',
            color: '#00FF94',
            fontFamily: 'monospace',
            zIndex: 2,
          }}>
            +{children.length - 9}
          </div>
        )}
      </motion.div>

      {/* Open State - Modal Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleBackdropClick}
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.8)',
                backdropFilter: 'blur(20px)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px',
              }}
            >
              {/* Folder Modal */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: '100%',
                  maxWidth: '1200px',
                  maxHeight: '90vh',
                  background: 'rgba(18, 18, 18, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(0, 255, 148, 0.3)',
                  borderRadius: '24px',
                  padding: '32px',
                  boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                }}
              >
                {/* Header */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '24px',
                  paddingBottom: '16px',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                }}>
                  <h2 style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: '#ffffff',
                    margin: 0,
                    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                  }}>
                    {folder.title || 'Untitled Folder'}
                  </h2>
                  <button
                    onClick={handleClose}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#ffffff',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: '500',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#00FF94';
                      e.currentTarget.style.backgroundColor = 'rgba(0, 255, 148, 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Close
                  </button>
                </div>

                {/* Items Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '16px',
                  overflowY: 'auto',
                  flex: 1,
                  paddingRight: '8px',
                }}>
                  {children.map((item, index) => (
                    <motion.div
                      key={item.id || index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => {
                        if (onItemClick) {
                          onItemClick(item);
                        }
                        handleClose();
                      }}
                      style={{
                        background: '#121212',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '12px',
                        padding: '16px',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      whileHover={{ scale: 1.05, borderColor: '#00FF94' }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <div style={{
                        fontSize: '32px',
                        marginBottom: '8px',
                        textAlign: 'center',
                      }}>
                        📚
                      </div>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#ffffff',
                        textAlign: 'center',
                        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {item.title || 'Untitled'}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Footer */}
                <div style={{
                  marginTop: '24px',
                  paddingTop: '16px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontFamily: 'monospace',
                }}>
                  {children.length} {children.length === 1 ? 'item' : 'items'}
                </div>
              </motion.div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default FolderGroup;


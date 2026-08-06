import React, { useState, useEffect } from 'react';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', cancelText = 'Cancel', typeToConfirm }) => {
  // For irreversible actions: the caller passes typeToConfirm (e.g. "DELETE")
  // and the confirm button stays disabled until the user types it exactly.
  const [typedValue, setTypedValue] = useState('');

  useEffect(() => {
    if (!isOpen) setTypedValue('');
  }, [isOpen]);

  if (!isOpen) return null;

  const confirmBlocked = typeToConfirm ? typedValue !== typeToConfirm : false;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'rgba(17, 24, 39, 0.95)', // bg-gray-900
          border: '1px solid rgba(31, 41, 55, 0.8)', // border-gray-800
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '480px',
          width: '90%',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title */}
        <h2
          style={{
            fontSize: '24px',
            fontWeight: '700',
            color: '#ffffff',
            marginBottom: '16px',
          }}
        >
          {title}
        </h2>

        {/* Message */}
        <p
          style={{
            fontSize: '16px',
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '32px',
            lineHeight: '1.6',
          }}
        >
          {message}
        </p>

        {typeToConfirm && (
          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                color: 'rgba(255, 255, 255, 0.6)',
                marginBottom: '8px',
              }}
            >
              Type <span style={{ color: '#ef4444', fontWeight: '700' }}>{typeToConfirm}</span> to confirm
            </label>
            <input
              type="text"
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={typeToConfirm}
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                borderRadius: '8px',
                color: '#ffffff',
                fontSize: '16px',
                outline: 'none',
              }}
            />
          </div>
        )}

        {/* Buttons */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end',
          }}
        >
          {/* Cancel Button */}
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'rgba(55, 65, 81, 0.6)', // gray-700
              border: '1px solid rgba(75, 85, 99, 0.5)', // gray-600
              color: '#ffffff',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(75, 85, 99, 0.8)';
              e.currentTarget.style.borderColor = 'rgba(107, 114, 128, 0.7)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(55, 65, 81, 0.6)';
              e.currentTarget.style.borderColor = 'rgba(75, 85, 99, 0.5)';
            }}
          >
            {cancelText}
          </button>

          {/* Confirm/Action Button */}
          <button
            onClick={() => {
              if (confirmBlocked) return;
              onConfirm();
              onClose();
            }}
            disabled={confirmBlocked}
            style={{
              backgroundColor: confirmBlocked ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.9)', // red-500
              border: '1px solid rgba(220, 38, 38, 0.8)', // red-600
              color: confirmBlocked ? 'rgba(255, 255, 255, 0.5)' : '#ffffff',
              borderRadius: '12px',
              padding: '12px 24px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: confirmBlocked ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              if (confirmBlocked) return;
              e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 1)';
              e.currentTarget.style.borderColor = 'rgba(185, 28, 28, 0.9)';
            }}
            onMouseLeave={(e) => {
              if (confirmBlocked) return;
              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.9)';
              e.currentTarget.style.borderColor = 'rgba(220, 38, 38, 0.8)';
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;


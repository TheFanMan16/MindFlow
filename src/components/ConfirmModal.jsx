import React, { useState, useEffect, useId } from 'react';
import { Modal, Button, Input } from './ui';

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  typeToConfirm,
}) => {
  // For irreversible actions: the caller passes typeToConfirm (e.g. "DELETE")
  // and the confirm button stays disabled until the user types it exactly.
  const [typedValue, setTypedValue] = useState('');
  const inputId = useId();

  useEffect(() => {
    if (!isOpen) setTypedValue('');
  }, [isOpen]);

  const confirmBlocked = typeToConfirm ? typedValue !== typeToConfirm : false;

  const handleConfirm = () => {
    if (confirmBlocked) return;
    onConfirm();
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {cancelText}
          </Button>
          <Button variant="danger" onClick={handleConfirm} disabled={confirmBlocked}>
            {confirmText}
          </Button>
        </>
      }
    >
      <p className="text-small leading-relaxed text-secondary">{message}</p>

      {typeToConfirm ? (
        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor={inputId} className="font-mono text-micro uppercase text-secondary">
            Type <span className="font-medium text-danger">{typeToConfirm}</span> to confirm
          </label>
          <Input
            id={inputId}
            type="text"
            value={typedValue}
            onChange={(e) => setTypedValue(e.target.value)}
            placeholder={typeToConfirm}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
          />
        </div>
      ) : null}
    </Modal>
  );
};

export default ConfirmModal;

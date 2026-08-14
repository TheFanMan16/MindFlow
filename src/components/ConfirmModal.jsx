import React, { useState, useEffect, useId } from 'react';
import { Modal, Button, Input } from './ui';

/**
 * Destructive-action gate. Cancel is a quiet secondary; the confirming
 * button is the danger variant (outlined red, wash on hover - never a solid
 * red fill at rest).
 *
 * Async contract: onConfirm may return a promise. While it runs the confirm
 * button keeps its width (both labels are laid in the same grid cell and
 * toggled), swaps to the in-progress verb, sets aria-busy and ignores
 * pointers - no spinner. Escape, the scrim and Cancel are all inert
 * mid-flight: a half-finished deletion has no sane "dismissed" state. On
 * rejection the modal stays open and explains the failure in a live region;
 * the confirm button doubles as the retry.
 *
 * Focus: Modal moves initial focus to [data-initial-focus] - Cancel (the
 * least destructive control), or the type-to-confirm input when that gate
 * is present, since nothing can proceed until it is satisfied.
 */
const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  /** In-progress verb while onConfirm runs, e.g. "Deleting…". */
  pendingText,
  cancelText = 'Cancel',
  typeToConfirm,
}) => {
  // For irreversible actions: the caller passes typeToConfirm (e.g. "DELETE")
  // and the confirm button stays disabled until the user types it exactly.
  const [typedValue, setTypedValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputId = useId();
  const errorId = useId();

  useEffect(() => {
    if (!isOpen) {
      setTypedValue('');
      setBusy(false);
      setError(null);
    }
  }, [isOpen]);

  const confirmBlocked = typeToConfirm ? typedValue !== typeToConfirm : false;
  const busyLabel = pendingText || `${confirmText}…`;

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleConfirm = async () => {
    if (confirmBlocked || busy) return;
    setError(null);
    setBusy(true);
    try {
      await onConfirm();
    } catch (err) {
      setBusy(false);
      setError(err?.message || 'The action could not be completed. Try again.');
      return;
    }
    setBusy(false);
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      onClose={handleClose}
      title={title}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={busy}
            data-initial-focus={typeToConfirm ? undefined : ''}
          >
            {cancelText}
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={confirmBlocked}
            aria-busy={busy || undefined}
            className={busy ? 'pointer-events-none' : undefined}
          >
            {/* Both labels share one grid cell so the button is always as
                wide as the wider label - no resize when the state flips. */}
            <span className="grid text-center">
              <span className={`col-start-1 row-start-1 ${busy ? 'invisible' : ''}`}>
                {confirmText}
              </span>
              <span
                aria-hidden={busy ? undefined : 'true'}
                className={`col-start-1 row-start-1 ${busy ? '' : 'invisible'}`}
              >
                {busyLabel}
              </span>
            </span>
          </Button>
        </>
      }
    >
      <p className="text-body-sm leading-relaxed text-secondary">{message}</p>

      {typeToConfirm ? (
        <div className="mt-4 flex flex-col gap-1.5">
          <label htmlFor={inputId} className="text-label-sm text-secondary">
            Type <span className="font-medium text-negative">{typeToConfirm}</span> to confirm
          </label>
          <Input
            id={inputId}
            type="text"
            value={typedValue}
            onChange={(e) => setTypedValue(e.target.value)}
            placeholder={typeToConfirm}
            disabled={busy}
            autoComplete="off"
            spellCheck={false}
            data-initial-focus=""
          />
        </div>
      ) : null}

      {error ? (
        <div
          id={errorId}
          role="alert"
          className="mt-4 rounded-sm border border-line bg-negative-wash px-3 py-2"
        >
          <p className="text-body-sm text-negative">{error}</p>
        </div>
      ) : null}
    </Modal>
  );
};

export default ConfirmModal;

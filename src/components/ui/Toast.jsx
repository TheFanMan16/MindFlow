import React from 'react';
import { Toaster, toast } from 'react-hot-toast';

/**
 * Themed wrapper over react-hot-toast, which the app already uses
 * everywhere - restyling the one Toaster beats introducing a parallel toast
 * system and migrating every call site. Mount <AppToaster /> once per tree;
 * call sites keep using toast()/toast.success()/toast.error() unchanged.
 *
 * Tones: success gets the positive icon; error gets the negative icon plus
 * the red hairline border and a longer read time - failures should not
 * vanish mid-read. toast.loading()'s built-in spinner is suppressed (icon:
 * null): nothing in this system loops, so a loading toast is its in-progress
 * verb as plain text until the caller resolves it.
 */
export const AppToaster = () => (
  <Toaster
    position="top-right"
    gutter={8}
    toastOptions={{
      duration: 3500,
      style: {
        background: 'var(--bg-raised)',
        color: 'var(--text-primary)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-lg)',
        boxShadow: 'var(--shadow-raised)',
        padding: '12px 16px',
        fontSize: '13px',
        maxWidth: '380px',
      },
      success: { iconTheme: { primary: 'var(--positive)', secondary: 'var(--bg-canvas)' } },
      error: {
        duration: 5500,
        style: { border: '1px solid var(--danger-line)' },
        iconTheme: { primary: 'var(--negative)', secondary: 'var(--bg-canvas)' },
      },
      loading: { icon: null },
    }}
  />
);

export { toast };
export default AppToaster;

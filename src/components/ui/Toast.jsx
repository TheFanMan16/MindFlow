import React from 'react';
import { Toaster, toast } from 'react-hot-toast';

/**
 * Themed wrapper over react-hot-toast, which the app already uses
 * everywhere - restyling the one Toaster beats introducing a parallel toast
 * system and migrating every call site. Mount <AppToaster /> once per tree;
 * call sites keep using toast()/toast.success()/toast.error() unchanged.
 */
export const AppToaster = () => (
  <Toaster
    position="top-right"
    gutter={8}
    toastOptions={{
      duration: 3500,
      style: {
        background: 'var(--bg-elevated)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--radius-card)',
        boxShadow: 'var(--shadow-modal)',
        padding: '12px 16px',
        fontSize: '13px',
        maxWidth: '380px',
      },
      success: { iconTheme: { primary: 'var(--success)', secondary: 'var(--bg-base)' } },
      error: { iconTheme: { primary: 'var(--danger)', secondary: 'var(--bg-base)' } },
    }}
  />
);

export { toast };
export default AppToaster;

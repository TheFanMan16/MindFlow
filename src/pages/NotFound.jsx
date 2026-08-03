import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

/**
 * Shown for any URL the router does not recognise.
 *
 * The app previously redirected every unknown path to the dashboard. That
 * made a typo, a dead link and a genuinely broken route indistinguishable -
 * you could not tell whether you had mistyped or the app had failed.
 */
const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        width: '100%',
        padding: '48px',
        textAlign: 'center',
        gap: '16px',
      }}
    >
      <h1
        style={{
          fontSize: '64px',
          fontWeight: '700',
          color: '#00FF94',
          margin: 0,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        }}
      >
        404
      </h1>

      <h2
        style={{
          fontSize: '22px',
          fontWeight: '600',
          color: '#ffffff',
          margin: 0,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        }}
      >
        This page doesn't exist
      </h2>

      <p
        style={{
          fontSize: '14px',
          color: 'rgba(255, 255, 255, 0.5)',
          margin: 0,
          fontFamily: 'monospace',
          wordBreak: 'break-all',
          maxWidth: '480px',
        }}
      >
        {location.pathname}
      </p>

      <button
        onClick={() => navigate('/dashboard')}
        style={{
          marginTop: '16px',
          background: '#00FF94',
          color: '#000000',
          border: 'none',
          padding: '14px 28px',
          borderRadius: '12px',
          fontSize: '15px',
          fontWeight: '600',
          cursor: 'pointer',
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        }}
      >
        Back to Dashboard
      </button>
    </div>
  );
};

export default NotFound;

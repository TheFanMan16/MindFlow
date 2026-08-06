import React from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Graceful paywall: shown when a free user hits their AI limit, instead of a
 * raw error toast. Sells the upgrade, offers a way out, touches no billing
 * logic itself - the Settings page owns the actual Stripe flow.
 */
const UpgradeModal = ({ isOpen, onClose, message }) => {
  const navigate = useNavigate();
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div style={{
        backgroundColor: 'rgba(17, 24, 39, 0.97)',
        border: '1px solid rgba(139, 92, 246, 0.4)',
        borderRadius: '20px',
        padding: '36px',
        maxWidth: '440px',
        width: '92%',
        textAlign: 'center',
        boxShadow: '0 20px 80px rgba(139, 92, 246, 0.25)',
      }}>
        <div style={{ fontSize: '40px', marginBottom: '12px' }}>✨</div>
        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#ffffff', marginBottom: '10px' }}>
          You're on a roll
        </h2>
        <p style={{ fontSize: '15px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, marginBottom: '8px' }}>
          {message || "You've used your 5 free AI actions for today."}
        </p>
        <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, marginBottom: '24px' }}>
          Pro removes the limit — unlimited recall grading, deck generation and
          Feynman feedback, plus exam countdown and unlimited streak freezes.
        </p>
        <button
          onClick={() => {
            onClose();
            navigate('/settings');
          }}
          style={{
            width: '100%',
            padding: '14px 24px',
            background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
            border: 'none',
            borderRadius: '12px',
            color: '#ffffff',
            fontSize: '16px',
            fontWeight: 700,
            cursor: 'pointer',
            marginBottom: '10px',
            boxShadow: '0 4px 20px rgba(139, 92, 246, 0.35)',
          }}
        >
          See Pro plans
        </button>
        <button
          onClick={onClose}
          style={{
            width: '100%',
            padding: '12px 24px',
            background: 'transparent',
            border: 'none',
            color: 'rgba(255,255,255,0.5)',
            fontSize: '14px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Maybe later — limits reset tomorrow
        </button>
      </div>
    </div>
  );
};

export default UpgradeModal;

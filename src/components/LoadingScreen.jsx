import React from 'react';

const LoadingScreen = ({ isLoading = false, isBuffering = false }) => {
  const show = isLoading || isBuffering;

  if (!show) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        opacity: show ? 1 : 0,
        transition: 'opacity 0.3s ease-in-out',
      }}
    >
      {/* Spinner Ring */}
      <div
        className="loading-spinner"
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          border: '4px solid transparent',
          borderTop: '4px solid #3b82f6', // Light Blue
          borderRight: '4px solid #8b5cf6', // Dark Purple
        }}
      />
    </div>
  );
};

export default LoadingScreen;

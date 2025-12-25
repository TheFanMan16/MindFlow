/**
 * Admin Panel Component
 * 
 * Allows admins to gift Pro subscriptions to users.
 * Only visible to users with is_admin = true in their profile.
 */

import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AdminPanel = ({ onGiftSuccess }) => {
  const [targetEmail, setTargetEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleGift = async (durationHours) => {
    if (!targetEmail.trim()) {
      setError('Please enter a user email');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let newExpiresAt;

      if (durationHours === 'lifetime') {
        // Set expiration to year 2099 (effectively lifetime)
        newExpiresAt = new Date('2099-12-31T23:59:59Z').toISOString();
      } else {
        // Calculate expiration date
        const now = new Date();
        const expiresAt = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
        newExpiresAt = expiresAt.toISOString();
      }

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({ pro_expires_at: newExpiresAt })
        .eq('email', targetEmail.trim().toLowerCase())
        .select();

      if (updateError) {
        throw updateError;
      }

      if (!data || data.length === 0) {
        setError('User not found. Please check the email address.');
      } else {
        const durationText = durationHours === 'lifetime' 
          ? 'Lifetime' 
          : durationHours === 24 
          ? '24 Hours' 
          : '1 Month';
        setSuccess(`Successfully gifted ${durationText} Pro to ${targetEmail}`);
        setTargetEmail(''); // Clear input on success
        
        // Notify parent component to refresh
        if (onGiftSuccess) {
          onGiftSuccess();
        }
      }
    } catch (err) {
      console.error('Error gifting Pro:', err);
      setError(`Failed to gift Pro: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{
      backgroundColor: 'rgba(168, 85, 247, 0.1)',
      borderRadius: '16px',
      padding: '24px',
      marginTop: '32px',
      border: '1px solid rgba(168, 85, 247, 0.3)',
    }}>
      <h3 style={{
        fontSize: '20px',
        fontWeight: '600',
        color: '#ffffff',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <span>⚡</span>
        Admin Panel - Gift Pro
      </h3>

      <div style={{
        marginBottom: '16px',
      }}>
        <input
          type="email"
          value={targetEmail}
          onChange={(e) => {
            setTargetEmail(e.target.value);
            setError(null);
            setSuccess(null);
          }}
          placeholder="User Email"
          style={{
            width: '100%',
            padding: '12px 16px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: '8px',
            color: '#ffffff',
            fontSize: '14px',
            outline: 'none',
          }}
          disabled={isLoading}
        />
      </div>

      <div style={{
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
      }}>
        <button
          onClick={() => handleGift(24)}
          disabled={isLoading || !targetEmail.trim()}
          style={{
            background: isLoading || !targetEmail.trim()
              ? 'rgba(255, 255, 255, 0.1)'
              : 'linear-gradient(90deg, #a855f7, #ec4899)',
            color: '#ffffff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: isLoading || !targetEmail.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            opacity: isLoading || !targetEmail.trim() ? 0.5 : 1,
          }}
        >
          Gift 24 Hours
        </button>

        <button
          onClick={() => handleGift(30 * 24)} // 1 month = 30 days
          disabled={isLoading || !targetEmail.trim()}
          style={{
            background: isLoading || !targetEmail.trim()
              ? 'rgba(255, 255, 255, 0.1)'
              : 'linear-gradient(90deg, #a855f7, #ec4899)',
            color: '#ffffff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: isLoading || !targetEmail.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            opacity: isLoading || !targetEmail.trim() ? 0.5 : 1,
          }}
        >
          Gift 1 Month
        </button>

        <button
          onClick={() => handleGift('lifetime')}
          disabled={isLoading || !targetEmail.trim()}
          style={{
            background: isLoading || !targetEmail.trim()
              ? 'rgba(255, 255, 255, 0.1)'
              : 'linear-gradient(90deg, #f59e0b, #ea580c)',
            color: '#ffffff',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: isLoading || !targetEmail.trim() ? 'not-allowed' : 'pointer',
            transition: 'all 0.3s ease',
            opacity: isLoading || !targetEmail.trim() ? 0.5 : 1,
          }}
        >
          Gift Lifetime
        </button>
      </div>

      {error && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#ef4444',
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '8px',
          fontSize: '14px',
          color: '#22c55e',
        }}>
          {success}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;


import React from 'react';
import { useAuth } from '../context/AuthContext';
// Note: We do NOT use useNavigate for logout to prevent the "Bounce Back" bug.
export default function ProfileMode() {
  const { user, profile, signOut } = useAuth();
  const handleSignOut = async () => {
    // 1. Confirmation
    if (!window.confirm("Are you sure you want to sign out?")) return;
    try {
      // 2. Clear Session
      await signOut();
      localStorage.clear(); // Safety clear
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      // 3. NUCLEAR OPTION: Hard refresh to Landing Page
      // This guarantees the user is removed from the dashboard.
      window.location.href = '/';
    }
  };
  const handleSubscribe = () => {
    if (profile?.is_pro) {
      alert("You are already a Pro member!");
      return;
    }
    // Placeholder Stripe Link
    const stripeLink = "https://buy.stripe.com/test_..."; 
    if (stripeLink.includes("test_")) {
        alert("Dev Note: Add your real Stripe link in ProfileMode.jsx");
    } else {
        window.open(stripeLink, '_blank');
    }
  };
  return (
    <div className="h-full w-full p-8 overflow-y-auto">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="bg-slate-900/50 p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-slate-700 rounded-full flex items-center justify-center text-2xl font-bold text-white">
              {user?.email?.[0].toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Welcome, {user?.email}</h1>
              <span className="text-slate-400 text-sm bg-slate-800 px-2 py-1 rounded">
                Plan: {profile?.is_pro ? 'MindFlow Pro' : 'MindFlow Free'}
              </span>
            </div>
          </div>
        </div>
        {/* Upgrade Section */}
        {!profile?.is_pro && (
          <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 p-8 rounded-2xl border border-purple-500/30 text-center">
            <h2 className="text-2xl font-bold text-purple-400 mb-2">Upgrade to Pro</h2>
            <button onClick={handleSubscribe} className="bg-gradient-to-r from-purple-600 to-blue-600 px-8 py-3 rounded-xl font-bold text-white hover:opacity-90 transition-all w-full max-w-md">
              Subscribe for $5.99/mo
            </button>
          </div>
        )}
        {/* Sign Out Button */}
        <button onClick={handleSignOut} className="mt-auto w-full bg-slate-800 hover:bg-red-900/20 text-slate-400 hover:text-red-400 py-4 rounded-xl border border-slate-700 hover:border-red-500/50 transition-all font-semibold">
          Sign Out
        </button>
      </div>
    </div>
  );
}

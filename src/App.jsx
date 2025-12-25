import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import BlurtingMode from './components/BlurtingMode';
import TimerMode from './components/TimerMode';
import SettingsMode from './components/SettingsMode';
import ProfileMode from './components/ProfileMode';
import FeynmanMode from './components/FeynmanMode';
import FlashcardMode from './components/FlashcardMode';
import Success from './pages/Success';
import Landing from './pages/Landing';
import Onboarding from './pages/Onboarding';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import { useAuth } from './context/AuthContext';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-6">
          <div className="w-12 h-12 border-4 border-white/10 border-t-purple-500 rounded-full animate-spin" />
          <div className="text-slate-400 text-lg">Loading...</div>
        </div>
      </div>
    );
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return (
    <div className="flex h-full w-full bg-slate-950 text-white overflow-hidden">
      <Sidebar />
      <main className="flex-1 h-full overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

// Public Route Component (for pages without sidebar)
const PublicRoute = ({ children }) => {
  return (
    <div className="flex h-full w-full bg-slate-950 text-white overflow-hidden items-center justify-center">
      {children}
    </div>
  );
};

function App() {
  const { session, loading: authLoading } = useAuth();
  const location = useLocation();
  
  // Check if user has seen onboarding
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(() => {
    try {
      return localStorage.getItem('hasSeenOnboarding') === 'true';
    } catch {
      return false;
    }
  });

  // Listen for onboarding status changes
  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const onboardingStatus = localStorage.getItem('hasSeenOnboarding') === 'true';
        setHasSeenOnboarding(onboardingStatus);
      } catch (error) {
        console.error('Error reading onboarding status:', error);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Loading check removed - app will render immediately
  // if (authLoading) {
  //   return <div className="flex h-screen items-center justify-center bg-slate-950 text-white">Loading MindFlow...</div>;
  // }

  // Onboarding route guard
  if (!hasSeenOnboarding && !session && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-white overflow-hidden">
      <Routes>
      {/* Public Routes */}
      <Route 
        path="/" 
        element={
          session ? (
            <Navigate to="/dashboard" replace />
          ) : hasSeenOnboarding ? (
            <PublicRoute><Landing /></PublicRoute>
          ) : (
            <Navigate to="/onboarding" replace />
          )
        } 
      />
      <Route 
        path="/onboarding" 
        element={
          session ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <PublicRoute><Onboarding /></PublicRoute>
          )
        } 
      />
      <Route 
        path="/login" 
        element={
          session ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <PublicRoute><Login /></PublicRoute>
          )
        } 
      />

      {/* Protected Routes */}
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/blurting" 
        element={
          <ProtectedRoute>
            <BlurtingMode />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/focus" 
        element={
          <ProtectedRoute>
            <TimerMode />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/feynman" 
        element={
          <ProtectedRoute>
            <FeynmanMode />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/flashcards" 
        element={
          <ProtectedRoute>
            <FlashcardMode />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/settings" 
        element={
          <ProtectedRoute>
            <SettingsMode />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/profile" 
        element={
          <ProtectedRoute>
            <ProfileMode />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/success" 
        element={
          <PublicRoute>
            <Success />
          </PublicRoute>
        } 
      />
      <Route 
        path="/admin" 
        element={
          <ProtectedRoute>
            <AdminDashboard />
          </ProtectedRoute>
        } 
      />

      {/* Catch All */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default App;

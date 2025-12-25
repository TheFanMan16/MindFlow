import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Library, Zap, TrendingUp } from 'lucide-react';

import { useNavigate } from 'react-router-dom';

const Onboarding = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      icon: Library,
      title: 'Your Digital Brain',
      text: 'Upload lectures and let AI organize your entire semester.',
      iconColor: '#a855f7',
      iconBg: 'rgba(168, 85, 247, 0.2)',
    },
    {
      icon: Zap,
      title: 'Active Recall',
      text: 'Stop re-reading. Start testing yourself with AI-generated exams.',
      iconColor: '#fbbf24',
      iconBg: 'rgba(251, 191, 36, 0.2)',
    },
    {
      icon: TrendingUp,
      title: 'Master Everything',
      text: 'Spaced repetition ensures you never forget a concept again.',
      iconColor: '#10b981',
      iconBg: 'rgba(16, 185, 129, 0.2)',
    },
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleGetStarted();
    }
  };

  const handleSkip = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    window.dispatchEvent(new Event('storage'));
    navigate('/login');
  };

  const handleGetStarted = () => {
    localStorage.setItem('hasSeenOnboarding', 'true');
    window.dispatchEvent(new Event('storage'));
    navigate('/login');
  };

  const IconComponent = slides[currentSlide].icon;

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      backgroundColor: '#030712',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated gradient background */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'radial-gradient(circle at 30% 50%, rgba(168, 85, 247, 0.15) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)',
      }} />

      {/* Skip Button - Top Right */}
      <button
        onClick={handleSkip}
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          color: 'rgba(255, 255, 255, 0.7)',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          backdropFilter: 'blur(10px)',
          zIndex: 10,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          e.currentTarget.style.color = '#ffffff';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        }}
      >
        Skip
      </button>

      {/* Centered Card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'rgba(255, 255, 255, 0.03)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '32px',
          padding: '64px 48px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Icon */}
        <motion.div
          key={currentSlide}
          initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.5, type: 'spring' }}
          style={{
            width: '120px',
            height: '120px',
            borderRadius: '32px',
            background: slides[currentSlide].iconBg,
            border: `2px solid ${slides[currentSlide].iconColor}40`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '48px',
            boxShadow: `0 0 40px ${slides[currentSlide].iconColor}30`,
          }}
        >
          <IconComponent
            size={64}
            color={slides[currentSlide].iconColor}
            strokeWidth={2}
          />
        </motion.div>

        {/* Text Content */}
        <div style={{
          width: '100%',
          position: 'relative',
          minHeight: '180px',
          marginBottom: '48px',
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              style={{
                textAlign: 'center',
              }}
            >
              <h1 style={{
                fontSize: '32px',
                fontWeight: '800',
                color: '#ffffff',
                marginBottom: '16px',
                lineHeight: '1.2',
              }}>
                {slides[currentSlide].title}
              </h1>
              <p style={{
                fontSize: '18px',
                color: 'rgba(255, 255, 255, 0.6)',
                lineHeight: '1.6',
              }}>
                {slides[currentSlide].text}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Progress Dots */}
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '48px',
        }}>
          {slides.map((_, index) => (
            <div
              key={index}
              style={{
                width: currentSlide === index ? '32px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: currentSlide === index
                  ? slides[currentSlide].iconColor
                  : 'rgba(255, 255, 255, 0.2)',
                transition: 'all 0.3s ease',
                cursor: 'pointer',
              }}
              onClick={() => setCurrentSlide(index)}
            />
          ))}
        </div>

        {/* Next/Get Started Button */}
        <button
          onClick={handleNext}
          style={{
            width: '100%',
            background: `linear-gradient(90deg, ${slides[currentSlide].iconColor}, ${slides[currentSlide].iconColor}dd)`,
            color: '#ffffff',
            border: 'none',
            padding: '16px 32px',
            borderRadius: '12px',
            fontSize: '18px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: `0 4px 20px ${slides[currentSlide].iconColor}40`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = `0 8px 30px ${slides[currentSlide].iconColor}50`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 4px 20px ${slides[currentSlide].iconColor}40`;
          }}
        >
          {currentSlide === slides.length - 1 ? 'Get Started' : 'Next'}
        </button>
      </motion.div>
    </div>
  );
};

export default Onboarding;


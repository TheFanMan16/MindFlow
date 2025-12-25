import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { BookOpen, Clock, Zap, ChevronRight } from 'lucide-react';

const Landing = () => {
  const navigate = useNavigate();
  const { session } = useAuth();

  const handleGetStarted = () => {
    console.log("Get Started Clicked. Session:", session);
    if (session) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 flex items-center justify-center overflow-hidden">
      {/* --- Background Ambient Orbs (The "Vibe") --- */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] animate-pulse" />
      
      {/* --- Main Content --- */}
      <div className="z-10 text-center max-w-4xl px-6">
        
        {/* Hero Title */}
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-6xl md:text-7xl font-bold mb-6 tracking-tight"
        >
          MindFlow
        </motion.h1>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="text-2xl md:text-3xl font-medium mb-8 text-slate-300"
        >
          The <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-pink-500 font-bold">AI-Powered</span> Study Assistant
        </motion.p>
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-slate-400 text-lg mb-12 max-w-2xl mx-auto"
        >
          Master any subject with Active Recall, Spaced Repetition, and your Personal Library.
        </motion.p>
        
        {/* --- Buttons --- */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex gap-4 justify-center mb-20"
        >
          <button 
            onClick={handleGetStarted}
            className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl font-bold text-lg shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-105 transition-all duration-300 flex items-center gap-2"
          >
            {session ? 'Go to Dashboard' : 'Get Started'}
            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          
          <button className="px-8 py-4 bg-white/5 border border-white/10 rounded-xl font-medium text-lg hover:bg-white/10 transition-all backdrop-blur-md">
            Learn More
          </button>
        </motion.div>
        
        {/* --- Feature Grid (Glassmorphism) --- */}
        <div className="grid md:grid-cols-3 gap-6 text-left">
          {[
            { icon: Zap, title: "AI Flashcards", desc: "Generate intelligent flashcards from your study materials instantly.", color: "text-purple-400" },
            { icon: Clock, title: "Spaced Repetition", desc: "Master information with scientifically-proven algorithms.", color: "text-blue-400" },
            { icon: BookOpen, title: "Smart Library", desc: "Organize all your study materials in one intelligent, searchable place.", color: "text-pink-400" }
          ].map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 * index }}
              viewport={{ once: true }}
              className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 hover:-translate-y-2 transition-all duration-300"
            >
              <div className={`p-3 rounded-lg bg-white/5 w-fit mb-4 ${item.color}`}>
                <item.icon size={24} />
              </div>
              <h3 className="text-xl font-bold mb-2">{item.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Landing;

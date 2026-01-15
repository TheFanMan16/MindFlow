import React from 'react';
import { LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SignInButton = () => {
    const navigate = useNavigate();

    return (
        <button
            onClick={() => navigate('/login')}
            className="
        group
        relative
        flex items-center gap-2
        px-6 py-2.5
        text-sm font-medium text-white
        bg-white/10
        hover:bg-white/20
        backdrop-blur-md
        border border-white/10
        rounded-full
        shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]
        transition-all duration-300 ease-out
        hover:-translate-y-0.5
        hover:shadow-[0_8px_32px_0_rgba(255,255,255,0.1)]
        overflow-hidden
      "
        >
            {/* Shine effect overlay */}
            <div
                className="
          absolute inset-0 
          bg-gradient-to-r from-transparent via-white/10 to-transparent 
          translate-x-[-100%] group-hover:translate-x-[100%] 
          transition-transform duration-700 ease-in-out
        "
            />

            <LogIn size={18} className="text-purple-300 group-hover:text-purple-200 transition-colors" />
            <span className="relative z-10 tracking-wide">Sign In</span>
        </button>
    );
};

export default SignInButton;

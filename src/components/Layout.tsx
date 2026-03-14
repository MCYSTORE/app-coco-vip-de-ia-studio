import React, { useState } from 'react';
import { Menu, X, Sparkles, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// Custom Premium Icons as SVG components - colores sólidos sin gradientes
const PicksIcon = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-all">
    <path 
      d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
      fill={active ? "#5E5CE6" : "none"}
      stroke={active ? "#5E5CE6" : "#AEAEB2"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const AnalysisIcon = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-all">
    <path 
      d="M21 21H4.6C4.03995 21 3.75992 21 3.54601 20.891C3.35785 20.7951 3.20487 20.6422 3.10899 20.454C3 20.2401 3 19.9601 3 19.4V3" 
      stroke={active ? "#5E5CE6" : "#AEAEB2"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path 
      d="M7 14L11 9L15 12L20 6" 
      stroke={active ? "#5E5CE6" : "#AEAEB2"}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="20" cy="6" r="2.5" fill={active ? "#5E5CE6" : "#AEAEB2"}/>
  </svg>
);

const HistoryIcon = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-all">
    <circle 
      cx="12" cy="12" r="9" 
      stroke={active ? "#5E5CE6" : "#AEAEB2"}
      strokeWidth="2"
    />
    <path 
      d="M12 7V12L15 15" 
      stroke={active ? "#5E5CE6" : "#AEAEB2"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="2" fill={active ? "#5E5CE6" : "#AEAEB2"}/>
  </svg>
);

const ProfileIcon = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-all">
    <circle 
      cx="12" cy="8" r="4" 
      fill={active ? "#5E5CE6" : "none"}
      stroke={active ? "#5E5CE6" : "#AEAEB2"}
      strokeWidth="2"
    />
    <path 
      d="M4 21V19C4 16.7909 5.79086 15 8 15H16C18.2091 15 20 16.7909 20 19V21" 
      stroke={active ? "#5E5CE6" : "#AEAEB2"}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const ScannerIcon = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-all">
    <circle 
      cx="12" cy="12" r="10" 
      stroke={active ? "#5E5CE6" : "#AEAEB2"}
      strokeWidth="2"
    />
    <circle 
      cx="12" cy="12" r="6" 
      stroke={active ? "#5E5CE6" : "#AEAEB2"}
      strokeWidth="2"
      strokeDasharray="4 2"
    />
    <circle 
      cx="12" cy="12" r="2" 
      fill={active ? "#5E5CE6" : "#AEAEB2"}
    />
    <path 
      d="M12 2V6" 
      stroke={active ? "#5E5CE6" : "#AEAEB2"}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path 
      d="M12 18V22" 
      stroke={active ? "#5E5CE6" : "#AEAEB2"}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path 
      d="M2 12H6" 
      stroke={active ? "#5E5CE6" : "#AEAEB2"}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path 
      d="M18 12H22" 
      stroke={active ? "#5E5CE6" : "#AEAEB2"}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const tabs = [
    { id: 'picks', label: 'Picks', icon: PicksIcon },
    { id: 'analysis', label: 'Analysis', icon: AnalysisIcon },
    { id: 'history', label: 'History', icon: HistoryIcon },
    { id: 'profile', label: 'Profile', icon: ProfileIcon },
  ];

  return (
    <div className="relative flex h-screen max-w-md mx-auto flex-col bg-[#F5F5F7] overflow-hidden shadow-2xl">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-white/95 backdrop-blur-xl p-4 border-b border-[#E5E5EA]">
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)} 
          className="flex size-11 items-center justify-center rounded-xl bg-[#F5F5F7] text-[#6E6E73] hover:bg-[#EEEEFF] hover:text-[#5E5CE6] transition-all duration-200"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-2.5">
          <div className="bg-[#5E5CE6] p-2 rounded-xl shadow-lg shadow-[#5E5CE6]/20">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-[#1D1D1F]">
            {activeTab === 'scanner' ? 'Scanner' : tabs.find(t => t.id === activeTab)?.label || 'Coco VIP'}
          </h1>
        </div>
        
        <div className="flex size-11 items-center justify-center rounded-xl bg-[#5E5CE6] text-white shadow-lg shadow-[#5E5CE6]/20">
          <User className="w-5 h-5" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-28">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-md mx-auto">
          <div className="mx-3 mb-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl shadow-black/5 border border-[#E5E5EA] px-2 py-3">
            <div className="flex items-center justify-around">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 transition-all duration-200 px-4 py-2 rounded-xl relative group",
                      isActive ? "text-[#5E5CE6]" : "text-[#AEAEB2] hover:text-[#6E6E73]"
                    )}
                  >
                    {/* Active Background */}
                    {isActive && (
                      <motion.div
                        layoutId="navGlow"
                        className="absolute inset-0 bg-[#EEEEFF] rounded-xl"
                        initial={false}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    
                    {/* Icon */}
                    <div className="relative z-10">
                      <tab.icon active={isActive} />
                    </div>
                    
                    {/* Label */}
                    <span className={cn(
                      "text-[10px] font-bold uppercase tracking-wider relative z-10 transition-all duration-200",
                      isActive ? "text-[#5E5CE6]" : "text-[#AEAEB2] group-hover:text-[#6E6E73]"
                    )}>
                      {tab.label}
                    </span>
                    
                    {/* Active Dot Indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="navDot"
                        className="absolute -bottom-0.5 w-1 h-1 rounded-full bg-[#5E5CE6]"
                        initial={false}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Side Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed top-0 left-0 bottom-0 w-72 bg-white z-50 shadow-2xl"
            >
              <div className="p-6 h-full flex flex-col">
                {/* Close Button */}
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-xl bg-[#F5F5F7] text-[#6E6E73] hover:bg-[#E5E5EA] hover:text-[#1D1D1F] transition-all"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Logo */}
                <div className="flex items-center gap-3 mb-10 mt-4">
                  <div className="bg-[#5E5CE6] p-3 rounded-2xl shadow-lg shadow-[#5E5CE6]/20">
                    <Sparkles className="text-white w-7 h-7" />
                  </div>
                  <div>
                    <span className="font-bold text-xl text-[#1D1D1F]">Coco VIP</span>
                    <p className="text-xs text-[#6E6E73]">Value Bets Assistant</p>
                  </div>
                </div>

                {/* Menu Items */}
                <nav className="space-y-2 flex-1">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => { setActiveTab(tab.id); setIsMenuOpen(false); }}
                        className={cn(
                          "w-full flex items-center gap-3 p-3.5 rounded-xl font-medium transition-all duration-200",
                          isActive 
                            ? "bg-[#EEEEFF] text-[#5E5CE6]" 
                            : "text-[#6E6E73] hover:bg-[#F5F5F7]"
                        )}
                      >
                        <tab.icon active={isActive} />
                        {tab.label}
                        {isActive && (
                          <div className="ml-auto w-2 h-2 rounded-full bg-[#5E5CE6]" />
                        )}
                      </button>
                    );
                  })}
                  
                  {/* Scanner - Special Menu Item */}
                  <div className="pt-2 border-t border-[#E5E5EA] mt-2">
                    <button
                      onClick={() => { setActiveTab('scanner'); setIsMenuOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-3 p-3.5 rounded-xl font-medium transition-all duration-200",
                        activeTab === 'scanner' 
                          ? "bg-[#EEEEFF] text-[#5E5CE6]" 
                          : "text-[#6E6E73] hover:bg-[#F5F5F7]"
                      )}
                    >
                      <ScannerIcon active={activeTab === 'scanner'} />
                      Scanner
                      {activeTab === 'scanner' && (
                        <div className="ml-auto w-2 h-2 rounded-full bg-[#5E5CE6]" />
                      )}
                    </button>
                  </div>
                </nav>

                {/* Bottom Info */}
                <div className="mt-auto">
                  {/* Divider */}
                  <div className="my-4 border-t border-[#E5E5EA]"></div>

                  {/* Info */}
                  <div className="bg-[#F5F5F7] rounded-2xl p-4">
                    <p className="text-xs text-[#6E6E73] mb-3 font-medium">Deportes disponibles:</p>
                    <div className="flex gap-2">
                      <span className="px-3 py-1.5 bg-white rounded-xl text-xs font-medium border border-[#E5E5EA]">⚽ Fútbol</span>
                      <span className="px-3 py-1.5 bg-white rounded-xl text-xs font-medium border border-[#E5E5EA]">🏀 Basketball</span>
                      <span className="px-3 py-1.5 bg-white rounded-xl text-xs font-medium border border-[#E5E5EA]">⚾ Béisbol</span>
                    </div>
                  </div>

                  {/* Version */}
                  <div className="mt-4 text-center">
                    <span className="text-xs text-[#AEAEB2] font-medium">Coco VIP v2.0</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

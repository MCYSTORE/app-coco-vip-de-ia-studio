import React, { useState } from 'react';
import { Trophy, History, BarChart3, User as UserIcon, Menu, X } from 'lucide-react';
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

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const tabs = [
    { id: 'picks', label: 'Picks', icon: Trophy },
    { id: 'analysis', label: 'Analysis', icon: BarChart3 },
    { id: 'history', label: 'History', icon: History },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ];

  return (
    <div className="relative flex h-screen max-w-md mx-auto flex-col bg-[#f6f5f8] overflow-hidden shadow-2xl">
      {/* Header */}
      <header className="sticky top-0 z-10 flex items-center justify-between bg-white/90 backdrop-blur-md p-4 border-b border-slate-200">
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)} 
          className="flex size-10 items-center justify-center rounded-full bg-[#895af6]/10 text-[#895af6] hover:bg-[#895af6]/20 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        <div className="flex items-center gap-2">
          <div className="bg-gradient-to-r from-[#895af6] to-[#7c4df2] p-1.5 rounded-lg">
            <BarChart3 className="text-white w-5 h-5" />
          </div>
          <h1 className="text-lg font-bold tracking-tight text-slate-900">
            {tabs.find(t => t.id === activeTab)?.label || 'Coco VIP'}
          </h1>
        </div>
        
        <div className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-[#895af6] to-[#7c4df2] text-white">
          <UserIcon className="w-5 h-5" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4 pb-24">
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
      <nav className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur-lg px-2 pb-8 pt-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 transition-all px-4 py-2 rounded-xl",
              activeTab === tab.id 
                ? "text-[#895af6] bg-[#895af6]/10" 
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            <tab.icon className={cn("w-6 h-6", activeTab === tab.id && "fill-current")} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
          </button>
        ))}
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
              className="absolute inset-0 bg-black/20 z-30"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute top-0 left-0 bottom-0 w-72 bg-white z-40 shadow-2xl"
            >
              <div className="p-6">
                {/* Close Button */}
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Logo */}
                <div className="flex items-center gap-3 mb-8 mt-4">
                  <div className="bg-gradient-to-r from-[#895af6] to-[#7c4df2] p-3 rounded-xl shadow-lg shadow-[#895af6]/20">
                    <BarChart3 className="text-white w-7 h-7" />
                  </div>
                  <div>
                    <span className="font-bold text-xl text-slate-900">Coco VIP</span>
                    <p className="text-xs text-slate-500">Value Bets Assistant</p>
                  </div>
                </div>

                {/* Menu Items */}
                <nav className="space-y-2">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id); setIsMenuOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-colors",
                        activeTab === tab.id 
                          ? "bg-[#895af6]/10 text-[#895af6]" 
                          : "text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <tab.icon className="w-5 h-5" />
                      {tab.label}
                    </button>
                  ))}
                </nav>

                {/* Divider */}
                <div className="my-6 border-t border-slate-100"></div>

                {/* Info */}
                <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4">
                  <p className="text-xs text-slate-500 mb-2">Deportes disponibles:</p>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 bg-white rounded-lg text-xs font-medium">⚽ Fútbol</span>
                    <span className="px-2 py-1 bg-white rounded-lg text-xs font-medium">🏀 Basketball</span>
                    <span className="px-2 py-1 bg-white rounded-lg text-xs font-medium">⚾ Béisbol</span>
                  </div>
                </div>

                {/* Version */}
                <div className="mt-6 text-center">
                  <span className="text-xs text-slate-400">Coco VIP v2.0</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

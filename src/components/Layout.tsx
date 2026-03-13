import React, { useState, useEffect } from 'react';
import { auth, signInWithGoogle, logout } from '../firebase';
import { User } from 'firebase/auth';
import { Trophy, History, BarChart3, User as UserIcon, LogOut, Menu } from 'lucide-react';
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
  const [user, setUser] = useState<User | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => setUser(u));
    return () => unsubscribe();
  }, []);

  const tabs = [
    { id: 'picks', label: 'Picks', icon: Trophy },
    { id: 'analysis', label: 'Analysis', icon: BarChart3 },
    { id: 'history', label: 'History', icon: History },
    { id: 'profile', label: 'Profile', icon: UserIcon },
  ];

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f6f5f8] flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl p-8 shadow-xl text-center">
          <div className="bg-[#895af6] w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <BarChart3 className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Coco VIP</h1>
          <p className="text-slate-500 mb-8">Value Bets Assistant</p>
          <button
            onClick={signInWithGoogle}
            className="w-full py-4 bg-white border border-slate-200 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/layout/google.svg" className="w-6 h-6" alt="Google" />
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-screen max-w-md mx-auto flex-col bg-[#f6f5f8] overflow-hidden shadow-2xl">
      <header className="sticky top-0 z-10 flex items-center justify-between bg-white/90 backdrop-blur-md p-4 border-b border-slate-200">
        <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="flex size-10 items-center justify-center rounded-full bg-[#895af6]/10 text-[#895af6]">
          <Menu className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">
          {tabs.find(t => t.id === activeTab)?.label || 'Coco VIP'}
        </h1>
        <div className="flex size-10 items-center justify-center rounded-full bg-[#895af6]/10 text-[#895af6] overflow-hidden">
          {user.photoURL ? (
            <img src={user.photoURL} alt="User" className="w-full h-full object-cover" />
          ) : (
            <UserIcon className="w-6 h-6" />
          )}
        </div>
      </header>

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

      <nav className="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-around border-t border-slate-200 bg-white/95 backdrop-blur-lg px-2 pb-8 pt-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex flex-col items-center gap-1 transition-colors",
              activeTab === tab.id ? "text-[#895af6]" : "text-slate-400"
            )}
          >
            <tab.icon className={cn("w-6 h-6", activeTab === tab.id && "fill-current")} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
          </button>
        ))}
      </nav>

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
              className="absolute top-0 left-0 bottom-0 w-64 bg-white z-40 p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="bg-[#895af6] p-2 rounded-lg">
                  <BarChart3 className="text-white w-6 h-6" />
                </div>
                <span className="font-bold text-xl">Coco VIP</span>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => { logout(); setIsMenuOpen(false); }}
                  className="w-full flex items-center gap-3 p-3 text-red-500 font-medium hover:bg-red-50 rounded-xl transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Sign Out
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

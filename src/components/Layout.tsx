import React, { useState, useEffect } from 'react';
import { Menu, X, Sparkles, User, Database, Microscope, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTheme } from '../contexts/ThemeContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// Custom Premium Icons as SVG components - usando variables CSS
const PicksIcon = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-all">
    <path 
      d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" 
      fill={active ? "var(--color-accent-primary)" : "none"}
      stroke={active ? "var(--color-accent-primary)" : "var(--color-text-muted)"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// Analysis icon using Microscope from lucide-react
const AnalysisIcon = ({ active }: { active?: boolean }) => (
  <Microscope 
    size={24} 
    className="transition-all"
    stroke={active ? "var(--color-accent-primary)" : "var(--color-text-muted)"}
    strokeWidth={2}
  />
);

const HistoryIcon = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-all">
    <circle 
      cx="12" cy="12" r="9" 
      stroke={active ? "var(--color-accent-primary)" : "var(--color-text-muted)"}
      strokeWidth="2"
    />
    <path 
      d="M12 7V12L15 15" 
      stroke={active ? "var(--color-accent-primary)" : "var(--color-text-muted)"}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="2" fill={active ? "var(--color-accent-primary)" : "var(--color-text-muted)"}/>
  </svg>
);

const ProfileIcon = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-all">
    <circle 
      cx="12" cy="8" r="4" 
      fill={active ? "var(--color-accent-primary)" : "none"}
      stroke={active ? "var(--color-accent-primary)" : "var(--color-text-muted)"}
      strokeWidth="2"
    />
    <path 
      d="M4 21V19C4 16.7909 5.79086 15 8 15H16C18.2091 15 20 16.7909 20 19V21" 
      stroke={active ? "var(--color-accent-primary)" : "var(--color-text-muted)"}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const ScannerIcon = ({ active }: { active?: boolean }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="transition-all">
    <circle 
      cx="12" cy="12" r="10" 
      stroke={active ? "var(--color-accent-primary)" : "var(--color-text-muted)"}
      strokeWidth="2"
    />
    <circle 
      cx="12" cy="12" r="6" 
      stroke={active ? "var(--color-accent-primary)" : "var(--color-text-muted)"}
      strokeWidth="2"
      strokeDasharray="4 2"
    />
    <circle 
      cx="12" cy="12" r="2" 
      fill={active ? "var(--color-accent-primary)" : "var(--color-text-muted)"}
    />
    <path 
      d="M12 2V6" 
      stroke={active ? "var(--color-accent-primary)" : "var(--color-text-muted)"}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path 
      d="M12 18V22" 
      stroke={active ? "var(--color-accent-primary)" : "var(--color-text-muted)"}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path 
      d="M2 12H6" 
      stroke={active ? "var(--color-accent-primary)" : "var(--color-text-muted)"}
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path 
      d="M18 12H22" 
      stroke={active ? "var(--color-accent-primary)" : "var(--color-text-muted)"}
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [cacheStatus, setCacheStatus] = useState<{ hasCache: boolean; lastUpdated: string | null; todayEntries: number } | null>(null);
  const { theme, toggleTheme } = useTheme();

  // Fetch cache status on mount
  useEffect(() => {
    const fetchCacheStatus = async () => {
      try {
        const response = await fetch('/api/cache-status');
        const data = await response.json();
        setCacheStatus(data);
      } catch (error) {
        console.error("Error fetching cache status:", error);
      }
    };
    fetchCacheStatus();
  }, []);

  // Format time ago
  const formatTimeAgo = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours > 24) {
      return `${Math.floor(diffHours / 24)}d`;
    } else if (diffHours > 0) {
      return `${diffHours}h`;
    } else {
      const diffMins = Math.floor(diffMs / (1000 * 60));
      return `${diffMins}m`;
    }
  };

  const tabs = [
    { id: 'picks', label: 'Picks', icon: PicksIcon },
    { id: 'analysis', label: 'Analysis', icon: AnalysisIcon },
    { id: 'history', label: 'History', icon: HistoryIcon },
    { id: 'profile', label: 'Profile', icon: ProfileIcon },
  ];

  return (
    <div className="relative flex h-screen max-w-md mx-auto flex-col overflow-hidden shadow-2xl" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* Header */}
      <header className="header-glass sticky top-0 z-10 flex items-center justify-between p-4">
        <button 
          onClick={() => setIsMenuOpen(!isMenuOpen)} 
          className="flex size-11 items-center justify-center rounded-xl transition-all duration-200"
          style={{ 
            backgroundColor: 'var(--color-bg-secondary)', 
            color: 'var(--color-text-secondary)' 
          }}
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-2.5">
          <div 
            className="p-2 rounded-xl shadow-lg"
            style={{ backgroundColor: 'var(--color-accent-primary)' }}
          >
            <Sparkles className="w-5 h-5" style={{ color: 'var(--color-bg-primary)' }} />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-tight leading-tight" style={{ color: 'var(--color-text-primary)' }}>
              {activeTab === 'scanner' ? 'Scanner' : tabs.find(t => t.id === activeTab)?.label || 'Coco VIP'}
            </h1>
            {/* Cache Status Indicator */}
            {cacheStatus?.hasCache && (
              <div className="flex items-center gap-1 text-[9px]" style={{ color: 'var(--color-text-secondary)' }}>
                <Database className="w-2.5 h-2.5" />
                <span>
                  {cacheStatus.todayEntries > 0 ? (
                    <>
                      {cacheStatus.todayEntries} entradas • {formatTimeAgo(cacheStatus.lastUpdated)}
                    </>
                  ) : (
                    'Sin datos hoy'
                  )}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Theme Toggle + User Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleTheme}
            className="flex size-11 items-center justify-center rounded-xl transition-all duration-200"
            style={{ 
              backgroundColor: 'var(--color-bg-secondary)', 
              color: 'var(--color-text-secondary)' 
            }}
            title={theme === 'light' ? 'Activar modo oscuro' : 'Activar modo claro'}
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
          </button>
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
          <div className="nav-glass mx-3 mb-4 rounded-2xl shadow-xl shadow-black/5 px-2 py-3">
            <div className="flex items-center justify-around">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 transition-all duration-200 px-4 py-2 rounded-xl relative group"
                    )}
                    style={{ 
                      color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-muted)' 
                    }}
                  >
                    {/* Active Background */}
                    {isActive && (
                      <motion.div
                        layoutId="navGlow"
                        className="absolute inset-0 rounded-xl nav-active-bg"
                        initial={false}
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                    
                    {/* Icon */}
                    <div className="relative z-10">
                      <tab.icon active={isActive} />
                    </div>
                    
                    {/* Label */}
                    <span className="text-[10px] font-bold uppercase tracking-wider relative z-10 transition-all duration-200">
                      {tab.label}
                    </span>
                    
                    {/* Active Dot Indicator */}
                    {isActive && (
                      <motion.div
                        layoutId="navDot"
                        className="absolute -bottom-0.5 w-1 h-1 rounded-full"
                        style={{ backgroundColor: 'var(--color-accent-primary)' }}
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
              className="fixed top-0 left-0 bottom-0 w-72 z-50 shadow-2xl"
              style={{ backgroundColor: 'var(--color-bg-card)' }}
            >
              <div className="p-6 h-full flex flex-col">
                {/* Close Button */}
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-xl transition-all"
                  style={{ 
                    backgroundColor: 'var(--color-bg-secondary)', 
                    color: 'var(--color-text-secondary)' 
                  }}
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Logo */}
                <div className="flex items-center gap-3 mb-10 mt-4">
                  <div 
                    className="p-3 rounded-2xl shadow-lg"
                    style={{ backgroundColor: 'var(--color-accent-primary)' }}
                  >
                    <Sparkles className="w-7 h-7" style={{ color: 'var(--color-bg-primary)' }} />
                  </div>
                  <div>
                    <span className="font-bold text-xl" style={{ color: 'var(--color-text-primary)' }}>Coco VIP</span>
                    <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>Value Bets Assistant</p>
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
                        className="w-full flex items-center gap-3 p-3.5 rounded-xl font-medium transition-all duration-200"
                        style={{ 
                          backgroundColor: isActive ? 'var(--color-bg-secondary)' : 'transparent',
                          color: isActive ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)'
                        }}
                      >
                        <tab.icon active={isActive} />
                        {tab.label}
                        {isActive && (
                          <div 
                            className="ml-auto w-2 h-2 rounded-full"
                            style={{ backgroundColor: 'var(--color-accent-primary)' }}
                          />
                        )}
                      </button>
                    );
                  })}
                  
                  {/* Scanner - Special Menu Item */}
                  <div 
                    className="pt-2 mt-2"
                    style={{ borderTop: '1px solid var(--color-border)' }}
                  >
                    <button
                      onClick={() => { setActiveTab('scanner'); setIsMenuOpen(false); }}
                      className="w-full flex items-center gap-3 p-3.5 rounded-xl font-medium transition-all duration-200"
                      style={{ 
                        backgroundColor: activeTab === 'scanner' ? 'var(--color-bg-secondary)' : 'transparent',
                        color: activeTab === 'scanner' ? 'var(--color-accent-primary)' : 'var(--color-text-secondary)'
                      }}
                    >
                      <ScannerIcon active={activeTab === 'scanner'} />
                      Scanner
                      {activeTab === 'scanner' && (
                        <div 
                          className="ml-auto w-2 h-2 rounded-full"
                          style={{ backgroundColor: 'var(--color-accent-primary)' }}
                        />
                      )}
                    </button>
                  </div>
                </nav>

                {/* Bottom Info */}
                <div className="mt-auto">
                  {/* Divider */}
                  <div 
                    className="my-4"
                    style={{ borderTop: '1px solid var(--color-border)' }}
                  />

                  {/* Info */}
                  <div 
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                  >
                    <p className="text-xs font-medium mb-3" style={{ color: 'var(--color-text-secondary)' }}>Deportes disponibles:</p>
                    <div className="flex gap-2">
                      <span 
                        className="px-3 py-1.5 rounded-xl text-xs font-medium"
                        style={{ 
                          backgroundColor: 'var(--color-bg-card)', 
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        ⚽ Fútbol
                      </span>
                      <span 
                        className="px-3 py-1.5 rounded-xl text-xs font-medium"
                        style={{ 
                          backgroundColor: 'var(--color-bg-card)', 
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        🏀 Basketball
                      </span>
                      <span 
                        className="px-3 py-1.5 rounded-xl text-xs font-medium"
                        style={{ 
                          backgroundColor: 'var(--color-bg-card)', 
                          border: '1px solid var(--color-border)',
                          color: 'var(--color-text-primary)'
                        }}
                      >
                        ⚾ Béisbol
                      </span>
                    </div>
                  </div>

                  {/* Version */}
                  <div className="mt-4 text-center">
                    <span className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>Coco VIP v2.0</span>
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

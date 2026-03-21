import React, { useState } from 'react';
import PickCard from '../components/PickCard';
import SniperPicksModal from '../components/SniperPicksModal';
import { Prediction } from '../types';
import { Loader2, TrendingUp, Sparkles, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PicksProps {
  onNavigate?: (tab: string) => void;
  onAnalyzeMatch?: (matchName: string) => void;
}

export default function Picks({ onNavigate, onAnalyzeMatch }: PicksProps) {
  const [picks, setPicks] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  // Sniper Modal State
  const [sniperModalOpen, setSniperModalOpen] = useState(false);
  const [selectedSport, setSelectedSport] = useState<'football' | 'basketball' | 'baseball'>('football');

  const fetchPicks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/top-picks');
      const data = await response.json();
      setPicks(data);
      setLastUpdate(new Date());
      setHasLoaded(true);
    } catch (error) {
      console.error("Error fetching picks:", error);
    } finally {
      setLoading(false);
    }
  };

  const openSniperModal = (sport: 'football' | 'basketball' | 'baseball') => {
    setSelectedSport(sport);
    setSniperModalOpen(true);
  };

  const handleAnalyzeFromSniper = (matchName: string) => {
    if (onAnalyzeMatch) {
      onAnalyzeMatch(matchName);
    }
    if (onNavigate) {
      onNavigate('analysis');
    }
  };

  // Loading state
  if (loading && picks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-10 h-10 text-[var(--color-accent-primary)]" />
        </motion.div>
        <p className="text-[var(--color-text-secondary)] font-medium mt-4">Analizando mercados...</p>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════════════════════════
  // VISUAL DESIGN - Premium Image Cards with Glass Effects
  // ═════════════════════════════════════════════════════════════════════════════════
  
  return (
    <div className="space-y-6">
      {/* Header - Simple and Clean */}
      <div className="mb-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
          Top Picks
        </h1>
        <p className="text-sm flex items-center gap-1" style={{ color: 'var(--color-text-secondary)' }}>
          <TrendingUp className="w-3.5 h-3.5" />
          Mejores oportunidades detectadas
        </p>
      </div>

      {/* Sport Cards - Premium Image Cards with Glass Effects */}
      <div className="space-y-4">
        {/* Fútbol Card */}
        <motion.section
          whileTap={{ scale: 0.98 }}
          onClick={() => openSniperModal('football')}
          className="relative h-48 rounded-[1.25rem] overflow-hidden shadow-xl group cursor-pointer"
        >
          {/* Background Image */}
          <img 
            alt="Estadio de fútbol" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
            src="https://images.unsplash.com/photo-1489944440615-453fc2b6a9a9?w=800&q=80"
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          
          {/* Content */}
          <div className="relative h-full p-6 flex flex-col justify-end">
            {/* Icon at top */}
            <div className="mb-auto">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl backdrop-blur-md bg-white/10 border border-white/20">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.38 0 2.66.41 3.74 1.11L12 10l-3.74-3.89C9.34 5.41 10.62 5 12 5zm-7 7c0-2.03.76-3.88 2-5.29L12 12l-5 5.29C5.76 15.88 5 14.03 5 12zm7 7c-1.38 0-2.66-.41-3.74-1.11L12 14l3.74 3.89C14.66 18.59 13.38 19 12 19zm7-7c0 2.03-.76 3.88-2 5.29L12 12l5-5.29C18.24 8.12 19 9.97 19 12z" fill="currentColor"/>
                </svg>
              </div>
            </div>
            {/* Text at bottom */}
            <div>
              <h2 className="text-3xl font-bold text-white mb-1">Fútbol</h2>
              <p className="text-white/80 text-sm leading-tight">Top 5 ligas + UEFA Champions League, La Liga, Premier League</p>
            </div>
          </div>
        </motion.section>

        {/* NBA Card */}
        <motion.section
          whileTap={{ scale: 0.98 }}
          onClick={() => openSniperModal('basketball')}
          className="relative h-48 rounded-[1.25rem] overflow-hidden shadow-xl group cursor-pointer"
        >
          {/* Background Image */}
          <img 
            alt="Jugador de NBA" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
            src="https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80"
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          
          {/* Content */}
          <div className="relative h-full p-6 flex flex-col justify-end">
            {/* Icon at top */}
            <div className="mb-auto">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl backdrop-blur-md bg-white/10 border border-white/20">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.45.39-2.81 1.07-3.98L6 9l1.5-1.5L9 9l1.5-1.5L12 9l1.5-1.5L15 9l1.5-1.5L18 9l-.93-.98A7.95 7.95 0 0112 20z" fill="currentColor"/>
                </svg>
              </div>
            </div>
            {/* Text at bottom */}
            <div>
              <h2 className="text-3xl font-bold text-white mb-1">NBA + Player Props</h2>
              <p className="text-white/80 text-sm leading-tight">Puntos, rebotes, asistencias, triples, robos, bloqueos</p>
            </div>
          </div>
        </motion.section>

        {/* MLB Card */}
        <motion.section
          whileTap={{ scale: 0.98 }}
          onClick={() => openSniperModal('baseball')}
          className="relative h-48 rounded-[1.25rem] overflow-hidden shadow-xl group cursor-pointer"
        >
          {/* Background Image */}
          <img 
            alt="Estadio de béisbol" 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
            src="https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800&q=80"
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          
          {/* Content */}
          <div className="relative h-full p-6 flex flex-col justify-end">
            {/* Icon at top */}
            <div className="mb-auto">
              <div className="w-10 h-10 flex items-center justify-center rounded-xl backdrop-blur-md bg-white/10 border border-white/20">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 2v4M12 18v4M2 12h4M18 12h4" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
            {/* Text at bottom */}
            <div>
              <h2 className="text-3xl font-bold text-white mb-1">MLB</h2>
              <p className="text-white/80 text-sm leading-tight">Run lines, totales, apuestas en vivo, futures</p>
            </div>
          </div>
        </motion.section>
      </div>

      {/* Last Update */}
      {lastUpdate && (
        <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
          Última actualización: {lastUpdate.toLocaleTimeString('es-ES')}
        </div>
      )}

      {/* Picks List */}
      <AnimatePresence mode="wait">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-4"
        >
          {picks.length === 0 ? (
            <div className="text-center py-12">
              <div 
                className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'var(--color-bg-secondary)' }}
              >
                {!hasLoaded ? (
                  <Sparkles className="w-8 h-8" style={{ color: 'var(--color-accent-primary)' }} />
                ) : (
                  <Shield className="w-8 h-8" style={{ color: 'var(--color-accent-primary)' }} />
                )}
              </div>
              {!hasLoaded ? (
                <>
                  <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Selecciona un deporte para ver picks
                  </p>
                  <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
                    Pulsa una tarjeta para ver los picks sniper del día
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Sin picks de calidad hoy
                  </p>
                  <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
                    El sistema es estricto para proteger tu bankroll. Vuelve mañana para nuevas oportunidades.
                  </p>
                </>
              )}
            </div>
          ) : (
            picks.map((pick, index) => (
              <motion.div
                key={pick.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <PickCard pick={pick} />
              </motion.div>
            ))
          )}
        </motion.div>
      </AnimatePresence>

      {/* Sniper Picks Modal */}
      <SniperPicksModal
        isOpen={sniperModalOpen}
        onClose={() => setSniperModalOpen(false)}
        sport={selectedSport}
        onAnalyzeMatch={handleAnalyzeFromSniper}
      />
    </div>
  );
}

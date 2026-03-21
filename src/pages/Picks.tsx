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
            src="https://i.ibb.co/ycxRrxXS/image.png"
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          
          {/* Content */}
          <div className="relative h-full p-6 flex flex-col justify-end">
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
            src="https://i.ibb.co/bRsY0201/image.png"
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          
          {/* Content */}
          <div className="relative h-full p-6 flex flex-col justify-end">
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
            src="https://i.ibb.co/20VVXfRG/image.png"
          />
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/40 to-transparent" />
          
          {/* Content */}
          <div className="relative h-full p-6 flex flex-col justify-end">
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

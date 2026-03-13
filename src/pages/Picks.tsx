import React, { useState, useEffect } from 'react';
import PickCard from '../components/PickCard';
import { Prediction } from '../types';
import { Loader2, RefreshCw, Filter, Zap, Clock, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Picks() {
  const [picks, setPicks] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'upcoming'>('all');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchPicks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/top-picks');
      const data = await response.json();
      setPicks(data);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Error fetching picks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPicks();
    const interval = setInterval(fetchPicks, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredPicks = picks.filter(pick => {
    if (activeFilter === 'live') return pick.isLive;
    if (activeFilter === 'upcoming') return !pick.isLive;
    return true;
  });

  const liveCount = picks.filter(p => p.isLive).length;

  if (loading && picks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <Loader2 className="w-10 h-10 text-[#5E5CE6]" />
        </motion.div>
        <p className="text-[#6E6E73] font-medium mt-4">Analizando mercados en tiempo real...</p>
        <p className="text-[#AEAEB2] text-sm mt-1">Conectando con API-Sports</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1D1D1F]">Top Picks</h2>
          <p className="text-sm text-[#6E6E73] flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            Mejores oportunidades detectadas
          </p>
        </div>
        <button
          onClick={fetchPicks}
          disabled={loading}
          className="p-2 text-[#5E5CE6] hover:bg-[#EEEEFF] rounded-full transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Stats Bar */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        <motion.div 
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveFilter('all')}
          className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium text-sm transition-all cursor-pointer ${
            activeFilter === 'all' 
              ? 'bg-[#5E5CE6] text-white' 
              : 'bg-white text-[#6E6E73] border border-[#E5E5EA]'
          }`}
        >
          Todos ({picks.length})
        </motion.div>
        <motion.div 
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveFilter('live')}
          className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium text-sm transition-all cursor-pointer flex items-center gap-2 ${
            activeFilter === 'live' 
              ? 'bg-[#FF3B30] text-white' 
              : 'bg-white text-[#6E6E73] border border-[#E5E5EA]'
          }`}
        >
          <Zap className="w-3 h-3" />
          En Vivo ({liveCount})
        </motion.div>
        <motion.div 
          whileTap={{ scale: 0.95 }}
          onClick={() => setActiveFilter('upcoming')}
          className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium text-sm transition-all cursor-pointer flex items-center gap-2 ${
            activeFilter === 'upcoming' 
              ? 'bg-[#34C759] text-white' 
              : 'bg-white text-[#6E6E73] border border-[#E5E5EA]'
          }`}
        >
          <Clock className="w-3 h-3" />
          Próximos
        </motion.div>
      </div>

      {/* Last Update */}
      <div className="text-xs text-[#AEAEB2] flex items-center gap-1">
        <Clock className="w-3 h-3" />
        Última actualización: {lastUpdate.toLocaleTimeString('es-ES')}
      </div>

      {/* Picks List */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeFilter}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {filteredPicks.length === 0 ? (
            <div className="text-center py-12">
              <div className="bg-[#F5F5F7] w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Filter className="text-[#AEAEB2] w-8 h-8" />
              </div>
              <p className="text-[#6E6E73]">No hay picks disponibles en esta categoría</p>
              <p className="text-[#AEAEB2] text-sm mt-1">Intenta con otro filtro o recarga</p>
            </div>
          ) : (
            filteredPicks.map((pick, index) => (
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

      {/* Live Indicator */}
      {liveCount > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#1C1C1E] text-white px-4 py-2 rounded-full text-sm font-bold flex items-center gap-2"
        >
          <span className="w-2 h-2 bg-[#FF3B30] rounded-full animate-pulse"></span>
          {liveCount} evento{liveCount !== 1 ? 's' : ''} en vivo
        </motion.div>
      )}
    </div>
  );
}

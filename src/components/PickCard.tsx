import React, { useState } from 'react';
import { Prediction, calculateExtraEdge } from '../types';
import { TrendingUp, Verified, Target, BookOpen, X, Clock, Flame, Zap, Building2, Bookmark, Check, ShoppingBag, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY = 'coco_vip_predictions';

interface PickCardProps {
  pick: Prediction;
  onDetail?: (pick: Prediction) => void;
}

export default function PickCard({ pick, onDetail }: PickCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [saved, setSaved] = useState(false);
  
  // Calculate odds shopping data
  const hasBestOdd = pick.bestOdd && pick.bestOdd > pick.odds;
  const extraEdgePercent = hasBestOdd ? calculateExtraEdge(pick.bestOdd!, pick.odds) : 0;
  const numAlternativeBookmakers = pick.allOdds?.length ? pick.allOdds.length - 1 : 0;

  const saveToHistory = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const existing: Prediction[] = stored ? JSON.parse(stored) : [];
      
      // Check if already saved
      if (existing.some(p => p.id === pick.id)) {
        setSaved(true);
        return;
      }
      
      const newPrediction: Prediction = {
        ...pick,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify([newPrediction, ...existing]));
      setSaved(true);
    } catch (error) {
      console.error("Error saving to history:", error);
    }
  };

  const getSportEmoji = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'football': return '⚽';
      case 'basketball': return '🏀';
      case 'baseball': return '⚾';
      default: return '🎯';
    }
  };

  const getSportColor = (sport: string) => {
    switch (sport.toLowerCase()) {
      case 'football': return '#34C759';
      case 'basketball': return '#FF9500';
      case 'baseball': return '#007AFF';
      default: return '#5E5CE6';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 9) return '#34C759';
    if (confidence >= 7) return '#FF9500';
    return '#6E6E73';
  };

  return (
    <>
      <motion.div
        whileHover={{ y: -4 }}
        className="group flex flex-col overflow-hidden rounded-2xl bg-white transition-all hover:shadow-lg border border-[#E5E5EA]"
        style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)' }}
      >
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#1C1C1E]">
          {!imageError ? (
            <img
              src={`https://picsum.photos/seed/${encodeURIComponent(pick.matchName)}/800/450`}
              alt={pick.matchName}
              className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-60"
              referrerPolicy="no-referrer"
              onError={() => setImageError(true)}
            />
          ) : null}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Sport Badge */}
          <div 
            className="absolute top-3 left-3 px-3 py-1 rounded-full text-white text-xs font-bold flex items-center gap-1 shadow-lg"
            style={{ backgroundColor: getSportColor(pick.sport) }}
          >
            <span>{getSportEmoji(pick.sport)}</span>
            <span>{pick.sport}</span>
          </div>

          {/* Live Badge */}
          {pick.isLive && (
            <div className="absolute top-3 right-14 px-2 py-1 rounded-full bg-[#FF3B30] text-white text-[10px] font-bold flex items-center gap-1 animate-pulse">
              <Zap className="w-3 h-3" />
              LIVE
            </div>
          )}

          {/* Top Pick Badge */}
          {pick.confidence >= 9 && (
            <div className="absolute top-3 right-3 rounded-full bg-[#FF9500] px-2 py-1 text-[10px] font-bold text-white shadow-lg flex items-center gap-1">
              <Flame className="w-3 h-3" />
              TOP PICK
            </div>
          )}

          {/* Match Name Overlay */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-lg font-bold text-white leading-tight drop-shadow-lg">{pick.matchName}</h2>
            {pick.league && (
              <p className="text-xs text-white/70 mt-1">{pick.league}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5" style={{ color: '#34C759' }}>
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-bold">+{pick.edgePercent.toFixed(1)}% Edge</span>
            </div>
            <div className="flex items-center gap-1" style={{ color: getConfidenceColor(pick.confidence) }}>
              <Verified className="w-4 h-4" />
              <span className="text-sm font-bold">{pick.confidence}/10</span>
            </div>
          </div>

          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2 text-[#6E6E73] text-sm">
              <Target className="w-4 h-4 text-[#5E5CE6]" />
              <span><strong className="text-[#1D1D1F]">{pick.selection}</strong></span>
            </div>
            
            {/* Odds Shopping Display */}
            {hasBestOdd ? (
              <div className="bg-[#F0FFF4] rounded-xl p-3 border border-[#34C759]/20">
                <div className="flex items-center gap-2 mb-1">
                  <ShoppingBag className="w-4 h-4 text-[#34C759]" />
                  <span className="text-xs font-bold text-[#34C759] uppercase">Mejor cuota disponible</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-xl font-bold text-[#1D1D1F]">{pick.bestOdd?.toFixed(2)}</span>
                  <span className="text-sm text-[#6E6E73]">en {pick.bestBookmaker}</span>
                </div>
                {extraEdgePercent > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <ArrowUpRight className="w-3 h-3 text-[#16A34A]" />
                    <span className="text-xs font-medium text-[#16A34A]">
                      +{extraEdgePercent.toFixed(1)}% edge extra vs cuota base
                    </span>
                  </div>
                )}
                {numAlternativeBookmakers > 0 && (
                  <p className="text-[10px] text-[#6E6E73] mt-1">
                    {numAlternativeBookmakers} otra{numAlternativeBookmakers > 1 ? 's' : ''} casa{numAlternativeBookmakers > 1 ? 's' : ''} disponible{numAlternativeBookmakers > 1 ? 's' : ''}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-[#6E6E73] text-sm">
                <Building2 className="w-4 h-4 text-[#5E5CE6]" />
                <span>Cuota: <strong className="text-[#1D1D1F]">{pick.odds.toFixed(2)}</strong> @ {pick.bookmaker}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={saveToHistory}
              disabled={saved}
              className={`flex-1 flex items-center justify-center rounded-xl py-3 text-sm font-bold transition-all active:scale-95 ${
                saved 
                  ? 'bg-[#F0FFF4] text-[#34C759] border border-[#34C759]/20' 
                  : 'bg-white text-[#5E5CE6] border-2 border-[#5E5CE6]'
              }`}
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Guardado
                </>
              ) : (
                <>
                  <Bookmark className="w-4 h-4 mr-2" />
                  Guardar
                </>
              )}
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex-1 flex items-center justify-center rounded-xl py-3 text-sm font-bold text-white transition-all active:scale-95"
              style={{ backgroundColor: '#5E5CE6', boxShadow: '0 2px 8px rgba(94,92,230,0.3)' }}
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Ver Análisis
            </button>
          </div>
        </div>
      </motion.div>

      {/* Detail Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-md mx-auto"
            >
              <div className="bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[85vh] overflow-y-auto">
                {/* Header */}
                <div className="p-6 text-white relative" style={{ backgroundColor: getSportColor(pick.sport) }}>
                  <button
                    onClick={() => setShowModal(false)}
                    className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                  
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{getSportEmoji(pick.sport)}</span>
                    <span className="text-sm font-medium opacity-90">{pick.sport}</span>
                    {pick.isLive && (
                      <span className="ml-2 px-2 py-0.5 bg-[#FF3B30] rounded text-xs font-bold animate-pulse">LIVE</span>
                    )}
                  </div>
                  
                  <h2 className="text-2xl font-bold mb-1">{pick.matchName}</h2>
                  {pick.league && <p className="text-sm opacity-80">{pick.league}</p>}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Key Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: '#F0FFF4' }}>
                      <div className="text-2xl font-bold" style={{ color: '#34C759' }}>+{pick.edgePercent.toFixed(1)}%</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: '#34C759', opacity: 0.7 }}>Edge</div>
                    </div>
                    <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: '#EEEEFF' }}>
                      <div className="text-2xl font-bold text-[#5E5CE6]">{pick.odds.toFixed(2)}</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#5E5CE6]/70">Cuota</div>
                    </div>
                    <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: '#FFF8F0' }}>
                      <div className="text-2xl font-bold text-[#FF9500]">{pick.confidence}/10</div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#FF9500]/70">Confianza</div>
                    </div>
                  </div>

                  {/* Bet Details */}
                  <div className="bg-[#F5F5F7] rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#6E6E73]">Mercado</span>
                      <span className="font-bold text-[#1D1D1F]">{pick.bestMarket}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#6E6E73]">Selección</span>
                      <span className="font-bold text-[#5E5CE6]">{pick.selection}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[#6E6E73]">Bookmaker</span>
                      <span className="font-bold text-[#1D1D1F]">{pick.bookmaker}</span>
                    </div>
                  </div>

                  {/* Analysis */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-[#1D1D1F] flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#5E5CE6]" />
                      Análisis Detallado
                    </h3>
                    <p className="text-sm text-[#6E6E73] leading-relaxed bg-[#F5F5F7] rounded-xl p-4">
                      {pick.analysisText}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-2 text-xs text-[#AEAEB2]">
                    <Clock className="w-3 h-3" />
                    <span>Creado: {new Date(pick.createdAt).toLocaleString('es-ES')}</span>
                  </div>

                  {/* Save Button in Modal */}
                  <button
                    onClick={saveToHistory}
                    disabled={saved}
                    className={`w-full py-4 font-bold rounded-xl flex items-center justify-center gap-2 transition-all ${
                      saved 
                        ? 'bg-[#F0FFF4] text-[#34C759] border border-[#34C759]/20' 
                        : 'bg-[#34C759] hover:bg-[#2DB94D] text-white'
                    }`}
                  >
                    {saved ? (
                      <>
                        <Check className="w-5 h-5" />
                        Guardado en Historial
                      </>
                    ) : (
                      <>
                        <Bookmark className="w-5 h-5" />
                        Guardar en Historial
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

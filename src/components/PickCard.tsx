import React, { useState } from 'react';
import { Prediction } from '../types';
import { TrendingUp, Verified, Target, BookOpen, X, Clock, Flame, Zap, Building2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface PickCardProps {
  pick: Prediction;
  onDetail?: (pick: Prediction) => void;
}

export default function PickCard({ pick, onDetail }: PickCardProps) {
  const [showModal, setShowModal] = useState(false);
  const [imageError, setImageError] = useState(false);

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
      case 'football': return 'from-green-500 to-emerald-600';
      case 'basketball': return 'from-orange-500 to-red-500';
      case 'baseball': return 'from-blue-500 to-indigo-600';
      default: return 'from-purple-500 to-pink-500';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 9) return 'text-emerald-500';
    if (confidence >= 7) return 'text-amber-500';
    return 'text-slate-500';
  };

  return (
    <>
      <motion.div
        whileHover={{ y: -4 }}
        className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-all hover:shadow-lg border border-slate-100"
      >
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900">
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
          <div className={`absolute top-3 left-3 px-3 py-1 rounded-full bg-gradient-to-r ${getSportColor(pick.sport)} text-white text-xs font-bold flex items-center gap-1 shadow-lg`}>
            <span>{getSportEmoji(pick.sport)}</span>
            <span>{pick.sport}</span>
          </div>

          {/* Live Badge */}
          {pick.isLive && (
            <div className="absolute top-3 right-14 px-2 py-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center gap-1 animate-pulse">
              <Zap className="w-3 h-3" />
              LIVE
            </div>
          )}

          {/* Top Pick Badge */}
          {pick.confidence >= 9 && (
            <div className="absolute top-3 right-3 rounded-full bg-amber-400 px-2 py-1 text-[10px] font-bold text-amber-900 shadow-lg flex items-center gap-1">
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
            <div className="flex items-center gap-1.5 text-emerald-500">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-bold">+{pick.edgePercent.toFixed(1)}% Edge</span>
            </div>
            <div className={`flex items-center gap-1 ${getConfidenceColor(pick.confidence)}`}>
              <Verified className="w-4 h-4" />
              <span className="text-sm font-bold">{pick.confidence}/10</span>
            </div>
          </div>

          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Target className="w-4 h-4 text-[#895af6]" />
              <span><strong className="text-slate-700">{pick.selection}</strong> @ {pick.bookmaker}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-sm">
              <Building2 className="w-4 h-4 text-[#895af6]" />
              <span>Cuota: <strong className="text-slate-700">{pick.odds.toFixed(2)}</strong></span>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex w-full items-center justify-center rounded-xl bg-[#895af6] py-3 text-sm font-bold text-white transition-all active:scale-95 hover:bg-[#7c4df2] shadow-md shadow-[#895af6]/20"
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Ver Análisis Completo
          </button>
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
                <div className={`bg-gradient-to-r ${getSportColor(pick.sport)} p-6 text-white relative`}>
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
                      <span className="ml-2 px-2 py-0.5 bg-red-500 rounded text-xs font-bold animate-pulse">LIVE</span>
                    )}
                  </div>
                  
                  <h2 className="text-2xl font-bold mb-1">{pick.matchName}</h2>
                  {pick.league && <p className="text-sm opacity-80">{pick.league}</p>}
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                  {/* Key Stats */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-emerald-50 rounded-2xl p-3 text-center">
                      <div className="text-2xl font-bold text-emerald-600">+{pick.edgePercent.toFixed(1)}%</div>
                      <div className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-wider">Edge</div>
                    </div>
                    <div className="bg-purple-50 rounded-2xl p-3 text-center">
                      <div className="text-2xl font-bold text-[#895af6]">{pick.odds.toFixed(2)}</div>
                      <div className="text-[10px] font-bold text-[#895af6]/70 uppercase tracking-wider">Cuota</div>
                    </div>
                    <div className="bg-amber-50 rounded-2xl p-3 text-center">
                      <div className="text-2xl font-bold text-amber-600">{pick.confidence}/10</div>
                      <div className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider">Confianza</div>
                    </div>
                  </div>

                  {/* Bet Details */}
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">Mercado</span>
                      <span className="font-bold text-slate-900">{pick.bestMarket}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">Selección</span>
                      <span className="font-bold text-[#895af6]">{pick.selection}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-slate-500">Bookmaker</span>
                      <span className="font-bold text-slate-900">{pick.bookmaker}</span>
                    </div>
                  </div>

                  {/* Analysis */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-[#895af6]" />
                      Análisis Detallado
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-4">
                      {pick.analysisText}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>Creado: {new Date(pick.createdAt).toLocaleString('es-ES')}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Sniper Picks Modal - Bottom Sheet
 * Muestra 2-3 picks sniper de alta calidad al presionar las tarjetas del Home
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, TrendingUp, Target, ChevronRight, Star, ExternalLink, AlertCircle } from 'lucide-react';

interface SniperPick {
  id: string;
  match: string;
  league: string;
  kickoff: string;
  market: string;
  selection: string;
  odds: number;
  edge_percentage: number;
  confidence_score: number;
  tier: string;
  kelly_stake: number;
  reason: string;
  source: string;
}

interface SniperPicksModalProps {
  isOpen: boolean;
  onClose: () => void;
  sport: 'football' | 'basketball' | 'baseball';
  onAnalyzeMatch?: (matchName: string) => void;
}

const SPORT_CONFIG = {
  football: { emoji: '⚽', name: 'Fútbol', gradient: 'from-green-600 to-green-800' },
  basketball: { emoji: '🏀', name: 'NBA', gradient: 'from-orange-500 to-red-600' },
  baseball: { emoji: '🏆', name: 'MLB', gradient: 'from-blue-500 to-blue-700' }
};

export default function SniperPicksModal({ isOpen, onClose, sport, onAnalyzeMatch }: SniperPicksModalProps) {
  const [picks, setPicks] = useState<SniperPick[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedPicks, setSavedPicks] = useState<Set<string>>(new Set());

  const config = SPORT_CONFIG[sport];

  useEffect(() => {
    if (isOpen) {
      fetchSniperPicks();
    }
  }, [isOpen, sport]);

  const fetchSniperPicks = async () => {
    setLoading(true);
    setError(null);
    setPicks([]);

    try {
      const response = await fetch(`/api/sniper-picks?sport=${sport}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else if (data.picks && data.picks.length > 0) {
        setPicks(data.picks);
      } else {
        setError(data.message || 'No hay picks sniper disponibles');
      }
    } catch (e: any) {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePick = async (pick: SniperPick) => {
    try {
      const response = await fetch('/api/history-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          result: {
            matchName: pick.match,
            sport: sport === 'football' ? 'Football' : sport === 'basketball' ? 'Basketball' : 'Baseball',
            bestMarket: pick.market,
            selection: pick.selection,
            odds: pick.odds,
            edgePercent: pick.edge_percentage,
            confidence: Math.round(pick.confidence_score * 10),
            tier: pick.tier,
            kellyStake: pick.kelly_stake,
            analysisText: pick.reason,
            best_pick: {
              market: pick.market,
              selection: pick.selection,
              odds: pick.odds,
              edge_percentage: pick.edge_percentage,
              confidence_score: pick.confidence_score,
              tier: pick.tier,
              kelly_stake_units: pick.kelly_stake,
              analysis: {
                pros: [],
                cons: [],
                conclusion: pick.reason
              }
            }
          }
        })
      });

      if (response.ok) {
        setSavedPicks(prev => new Set([...prev, pick.id]));
      }
    } catch (e) {
      console.error('Error saving pick:', e);
    }
  };

  const handleAnalyzeMatch = (matchName: string) => {
    onClose();
    if (onAnalyzeMatch) {
      onAnalyzeMatch(matchName);
    }
  };

  // Confidence bar color
  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-500';
    if (score >= 0.65) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  // Tier badge style
  const getTierStyle = (tier: string) => {
    if (tier === 'A+') return 'bg-green-500/20 text-green-400 border-green-500/30';
    return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-hidden"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.3)'
            }}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-gray-600" />
            </div>

            {/* Header */}
            <div className="px-5 pb-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${config.gradient}`}>
                    <span className="text-2xl">{config.emoji}</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: 'var(--color-text-primary)' }}>
                      Picks Sniper — {config.name}
                    </h2>
                    <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                      Top 3 oportunidades del día
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                >
                  <X className="w-5 h-5" style={{ color: 'var(--color-text-secondary)' }} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[60vh] p-5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-accent-primary)' }} />
                  <p className="mt-3 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                    Buscando oportunidades...
                  </p>
                </div>
              ) : error ? (
                <div className="text-center py-10">
                  <div 
                    className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                    style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                  >
                    <span className="text-4xl">😴</span>
                  </div>
                  <p className="font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Sin picks sniper disponibles
                  </p>
                  <p className="text-sm mt-2 max-w-xs mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
                    {error}
                  </p>
                  <button
                    onClick={() => onAnalyzeMatch && onAnalyzeMatch('')}
                    className="mt-4 px-5 py-2.5 rounded-xl font-medium text-sm flex items-center gap-2 mx-auto"
                    style={{ backgroundColor: 'var(--color-accent-primary)', color: 'white' }}
                  >
                    <Target className="w-4 h-4" />
                    Análisis manual
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {picks.map((pick, index) => (
                    <motion.div
                      key={pick.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="rounded-2xl border overflow-hidden"
                      style={{ 
                        backgroundColor: 'var(--color-bg-card)', 
                        borderColor: 'var(--color-border)' 
                      }}
                    >
                      {/* Match Header */}
                      <div 
                        className="px-4 py-3 flex items-center justify-between"
                        style={{ backgroundColor: 'var(--color-bg-secondary)' }}
                      >
                        <div>
                          <p className="font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>
                            {pick.match}
                          </p>
                          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                            {pick.league} · Hoy {pick.kickoff}
                          </p>
                        </div>
                        <span 
                          className={`px-2 py-0.5 rounded-full text-xs font-bold border ${getTierStyle(pick.tier)}`}
                        >
                          {pick.tier}
                        </span>
                      </div>

                      {/* Pick Selection */}
                      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🎯</span>
                          <span className="font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            {pick.selection}
                          </span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                          {pick.market}
                        </p>
                      </div>

                      {/* Stats Row */}
                      <div className="px-4 py-3 grid grid-cols-4 gap-2 text-center border-b" style={{ borderColor: 'var(--color-border)' }}>
                        <div>
                          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Cuota</p>
                          <p className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{pick.odds.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Edge</p>
                          <p className="font-bold text-green-500">+{pick.edge_percentage.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Confianza</p>
                          <p className="font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            {Math.round(pick.confidence_score * 10)}/10
                          </p>
                        </div>
                        <div>
                          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Kelly</p>
                          <p className="font-bold" style={{ color: 'var(--color-text-primary)' }}>
                            {pick.kelly_stake?.toFixed(2) || '0.05'}
                          </p>
                        </div>
                      </div>

                      {/* Confidence Bar */}
                      <div className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                            <div 
                              className={`h-full rounded-full ${getConfidenceColor(pick.confidence_score)}`}
                              style={{ width: `${pick.confidence_score * 100}%` }}
                            />
                          </div>
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            {Math.round(pick.confidence_score * 100)}%
                          </span>
                        </div>
                      </div>

                      {/* Reason */}
                      {pick.reason && (
                        <div className="px-4 py-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
                          <p className="text-xs italic" style={{ color: 'var(--color-text-secondary)' }}>
                            💡 {pick.reason}
                          </p>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="px-4 py-3 flex gap-2">
                        <button
                          onClick={() => handleAnalyzeMatch(pick.match)}
                          className="flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                          style={{ 
                            backgroundColor: 'var(--color-bg-secondary)', 
                            color: 'var(--color-text-primary)',
                            border: '1px solid var(--color-border)'
                          }}
                        >
                          <ExternalLink className="w-4 h-4" />
                          Ver análisis completo
                        </button>
                        <button
                          onClick={() => handleSavePick(pick)}
                          disabled={savedPicks.has(pick.id)}
                          className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 ${
                            savedPicks.has(pick.id) 
                              ? 'bg-green-500/20 text-green-400' 
                              : 'bg-yellow-500/20 text-yellow-400'
                          }`}
                        >
                          <Star className={`w-4 h-4 ${savedPicks.has(pick.id) ? 'fill-current' : ''}`} />
                          {savedPicks.has(pick.id) ? 'Guardado' : 'Guardar'}
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {!loading && !error && picks.length > 0 && (
              <div 
                className="px-5 py-4 border-t text-center"
                style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg-secondary)' }}
              >
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  ⚠️ Picks generados por IA. Apuesta responsablemente.
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

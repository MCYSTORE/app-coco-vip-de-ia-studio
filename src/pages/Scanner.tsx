import React, { useState, useEffect } from 'react';
import { Radar, Loader2, Filter, TrendingUp, Target, Clock, ChevronRight, RefreshCw, Search, AlertTriangle, ShoppingBag, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Helper function to calculate extra edge
const calculateExtraEdge = (bestOdd: number, baseOdd: number): number => {
  if (!bestOdd || !baseOdd || bestOdd <= baseOdd) return 0;
  return ((bestOdd - baseOdd) / baseOdd) * 100;
};

interface ScanResult {
  id: string;
  rank: number;
  match_name: string;
  sport: string;
  league: string;
  market: string;
  selection: string;
  bookmaker: string;
  odds: number;
  implied_prob: number;
  estimated_edge: number;
  confidence: number;
  analysis_short: string;
  // Odds Shopping fields
  all_odds?: Array<{ bookmaker: string; odds: number }>;
  best_bookmaker?: string;
  best_odd?: number;
}

interface ScanResponse {
  scan_date: string;
  total_matches_analyzed: number;
  value_bets_found: number;
  results: ScanResult[];
}

const SPORTS_FILTERS = [
  { id: 'all', name: 'Todos', emoji: '🎯' },
  { id: 'Football', name: 'Fútbol', emoji: '⚽' },
  { id: 'Basketball', name: 'Basket', emoji: '🏀' },
  { id: 'Baseball', name: 'Béisbol', emoji: '⚾' }
];

export default function Scanner() {
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [data, setData] = useState<ScanResponse | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [onAnalyze, setOnAnalyze] = useState<((match: string) => void) | null>(null);

  const runScan = async () => {
    setScanning(true);
    try {
      const response = await fetch('/api/scanner');
      const result = await response.json();
      setData(result);
      setLastUpdate(new Date());
    } catch (error) {
      console.error("Scanner error:", error);
    } finally {
      setLoading(false);
      setScanning(false);
    }
  };

  useEffect(() => {
    runScan();
    // Auto-refresh every 30 minutes
    const interval = setInterval(runScan, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredResults = data?.results?.filter(r => {
    if (activeFilter === 'all') return true;
    return r.sport === activeFilter;
  }) || [];

  const stats = {
    totalMatches: data?.total_matches_analyzed || 0,
    valueBets: data?.value_bets_found || 0,
    bestEdge: data?.results?.length > 0 ? Math.max(...data.results.map(r => r.estimated_edge)) : 0,
    avgConfidence: data?.results?.length > 0 
      ? (data.results.reduce((acc, r) => acc + r.confidence, 0) / data.results.length).toFixed(1)
      : 0
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
      case 'football': return 'var(--color-success)';
      case 'basketball': return 'var(--color-warning)';
      case 'baseball': return '#007AFF';
      default: return 'var(--color-accent-primary)';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 8) return 'var(--color-success)';
    if (confidence >= 6) return 'var(--color-warning)';
    return 'var(--color-danger)';
  };

  // Expose analyze function for navigation
  useEffect(() => {
    const handleAnalyze = (matchName: string) => {
      // Store the match name and switch to analysis tab
      localStorage.setItem('coco_scanner_match', matchName);
      window.dispatchEvent(new CustomEvent('navigateToAnalysis', { detail: matchName }));
    };
    setOnAnalyze(() => handleAnalyze);
  }, []);

  const handleAnalyzeMatch = (matchName: string) => {
    localStorage.setItem('coco_scanner_match', matchName);
    window.dispatchEvent(new CustomEvent('navigateToAnalysis', { detail: matchName }));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Radar className="w-12 h-12" style={{ color: 'var(--color-accent-primary)' }} />
        </motion.div>
        <p className="font-medium mt-4" style={{ color: 'var(--color-text-secondary)' }}>Iniciando escáner...</p>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Conectando con API-Sports</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: 'var(--color-text-primary)' }}>
            <Radar className="w-7 h-7" style={{ color: 'var(--color-accent-primary)' }} />
            Escáner de Value Bets
          </h2>
          <p className="text-sm flex items-center gap-1 mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            <Target className="w-3 h-3" />
            Radar de oportunidades en tiempo real
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="p-2 rounded-full transition-colors disabled:opacity-50"
          style={{ color: 'var(--color-accent-primary)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--color-bg-secondary)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <RefreshCw className={`w-5 h-5 ${scanning ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Last Update Badge */}
      <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        <Clock className="w-3 h-3" />
        <span>Último escaneo: {lastUpdate.toLocaleTimeString('es-ES')}</span>
        {scanning && (
          <motion.span
            animate={{ opacity: [1, 0.5] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="font-medium"
            style={{ color: 'var(--color-accent-primary)' }}
          >
            • Escaneando...
          </motion.span>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{stats.totalMatches}</div>
          <div className="text-[9px] uppercase font-bold" style={{ color: 'var(--color-text-muted)' }}>Analizados</div>
        </div>
        <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: 'var(--color-success-bg)', borderColor: 'rgba(22, 163, 74, 0.2)' }}>
          <div className="text-xl font-bold" style={{ color: 'var(--color-success)' }}>{stats.valueBets}</div>
          <div className="text-[9px] uppercase font-bold" style={{ color: 'var(--color-success)' }}>Value Bets</div>
        </div>
        <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'rgba(94, 92, 230, 0.2)' }}>
          <div className="text-xl font-bold" style={{ color: 'var(--color-accent-primary)' }}>+{stats.bestEdge.toFixed(1)}%</div>
          <div className="text-[9px] uppercase font-bold" style={{ color: 'var(--color-accent-primary)' }}>Mejor Edge</div>
        </div>
        <div className="rounded-xl p-3 text-center border" style={{ backgroundColor: 'var(--color-warning-bg)', borderColor: 'rgba(255, 149, 0, 0.2)' }}>
          <div className="text-xl font-bold" style={{ color: 'var(--color-warning)' }}>{stats.avgConfidence}</div>
          <div className="text-[9px] uppercase font-bold" style={{ color: 'var(--color-warning)' }}>Conf. Media</div>
        </div>
      </div>

      {/* Scanning Animation */}
      {scanning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4 flex items-center justify-center gap-3"
          style={{ backgroundColor: 'var(--color-bg-secondary)' }}
        >
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-accent-primary)' }} />
          <span className="font-medium" style={{ color: 'var(--color-accent-primary)' }}>Analizando {stats.totalMatches} partidos...</span>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
        {SPORTS_FILTERS.map((filter) => (
          <motion.button
            key={filter.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => setActiveFilter(filter.id)}
            className={`flex-shrink-0 px-4 py-2 rounded-xl font-medium text-sm transition-all flex items-center gap-2 ${
              activeFilter === filter.id 
                ? 'text-white' 
                : 'border'
            }`}
            style={activeFilter === filter.id 
              ? { backgroundColor: 'var(--color-accent-primary)' }
              : { backgroundColor: 'var(--color-bg-card)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)' }
            }
          >
            <span>{filter.emoji}</span>
            {filter.name}
          </motion.button>
        ))}
      </div>

      {/* Results List */}
      <AnimatePresence mode="wait">
        {filteredResults.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="text-center py-12"
          >
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
              <AlertTriangle className="w-10 h-10" style={{ color: 'var(--color-text-muted)' }} />
            </div>
            <p className="font-semibold text-lg" style={{ color: 'var(--color-text-primary)' }}>No se detectaron value bets</p>
            <p className="text-sm mt-2" style={{ color: 'var(--color-text-secondary)' }}>con edge superior a 3% en este momento.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>El escáner se actualiza automáticamente cada 30 minutos.</p>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {filteredResults.map((result, index) => (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-2xl p-4 border"
                style={{ backgroundColor: 'var(--color-bg-card)', borderColor: 'var(--color-border)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getSportEmoji(result.sport)}</span>
                    <div>
                      <h4 className="font-bold" style={{ color: 'var(--color-text-primary)' }}>{result.match_name}</h4>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{result.league}</p>
                    </div>
                  </div>
                  <div 
                    className="px-3 py-1 rounded-full text-xs font-bold text-white"
                    style={{ backgroundColor: getSportColor(result.sport) }}
                  >
                    {result.market}
                  </div>
                </div>

                {/* Main Stats */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-[10px] uppercase font-bold" style={{ color: 'var(--color-text-muted)' }}>Selección</p>
                      <p className="font-bold" style={{ color: 'var(--color-accent-primary)' }}>{result.selection}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>+{result.estimated_edge.toFixed(1)}%</div>
                    <div className="text-[10px] uppercase font-bold" style={{ color: 'var(--color-success)' }}>Edge</div>
                  </div>
                </div>

                {/* Odds Shopping Display */}
                {result.best_odd && result.best_odd > result.odds ? (
                  <div className="rounded-xl p-3 mb-3 border" style={{ backgroundColor: 'var(--color-success-bg)', borderColor: 'rgba(22, 163, 74, 0.2)' }}>
                    <div className="flex items-center gap-2 mb-1">
                      <ShoppingBag className="w-4 h-4" style={{ color: 'var(--color-success)' }} />
                      <span className="text-xs font-bold uppercase" style={{ color: 'var(--color-success)' }}>Mejor cuota disponible</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>{result.best_odd.toFixed(2)}</span>
                      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>en {result.best_bookmaker}</span>
                    </div>
                    {(() => {
                      const extraEdge = calculateExtraEdge(result.best_odd!, result.odds);
                      return extraEdge > 0 ? (
                        <div className="flex items-center gap-1 mt-1">
                          <ArrowUpRight className="w-3 h-3" style={{ color: 'var(--color-success)' }} />
                          <span className="text-xs font-medium" style={{ color: 'var(--color-success)' }}>
                            +{extraEdge.toFixed(1)}% edge extra vs cuota base
                          </span>
                        </div>
                      ) : null;
                    })()}
                    {result.all_odds && result.all_odds.length > 1 && (
                      <p className="text-[10px] mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                        {result.all_odds.length - 1} otra{result.all_odds.length > 2 ? 's' : ''} casa{result.all_odds.length > 2 ? 's' : ''} disponible{result.all_odds.length > 2 ? 's' : ''}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-sm mb-3" style={{ color: 'var(--color-text-secondary)' }}>
                    <span>Cuota: <strong style={{ color: 'var(--color-text-primary)' }}>{result.odds.toFixed(2)}</strong></span>
                    <span>@ {result.bookmaker}</span>
                  </div>
                )}

                {/* Confidence Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span style={{ color: 'var(--color-text-muted)' }}>Confianza</span>
                    <span className="font-bold" style={{ color: getConfidenceColor(result.confidence) }}>
                      {result.confidence}/10
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${result.confidence * 10}%` }}
                      transition={{ duration: 0.5, delay: index * 0.05 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: getConfidenceColor(result.confidence) }}
                    />
                  </div>
                </div>

                {/* Analysis Short */}
                <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
                  <p className="text-sm italic" style={{ color: 'var(--color-text-secondary)' }}>"{result.analysis_short}"</p>
                </div>

                {/* Analyze Button */}
                <button
                  onClick={() => handleAnalyzeMatch(result.match_name)}
                  className="w-full py-3 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  style={{ backgroundColor: 'var(--color-accent-primary)', boxShadow: '0 2px 8px rgba(94,92,230,0.3)' }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  <Search className="w-4 h-4" />
                  Analizar en detalle
                  <ChevronRight className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

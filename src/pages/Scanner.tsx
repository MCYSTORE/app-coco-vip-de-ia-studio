import React, { useState, useEffect } from 'react';
import { Radar, Loader2, Filter, TrendingUp, Target, Clock, ChevronRight, RefreshCw, Search, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
      case 'football': return '#34C759';
      case 'basketball': return '#FF9500';
      case 'baseball': return '#007AFF';
      default: return '#5E5CE6';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 8) return '#34C759';
    if (confidence >= 6) return '#FF9500';
    return '#FF3B30';
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
          <Radar className="w-12 h-12 text-[#5E5CE6]" />
        </motion.div>
        <p className="text-[#6E6E73] font-medium mt-4">Iniciando escáner...</p>
        <p className="text-[#AEAEB2] text-sm mt-1">Conectando con API-Sports</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#1D1D1F] flex items-center gap-2">
            <Radar className="w-7 h-7 text-[#5E5CE6]" />
            Escáner de Value Bets
          </h2>
          <p className="text-sm text-[#6E6E73] flex items-center gap-1 mt-1">
            <Target className="w-3 h-3" />
            Radar de oportunidades en tiempo real
          </p>
        </div>
        <button
          onClick={runScan}
          disabled={scanning}
          className="p-2 text-[#5E5CE6] hover:bg-[#EEEEFF] rounded-full transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${scanning ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Last Update Badge */}
      <div className="flex items-center gap-2 text-xs text-[#AEAEB2]">
        <Clock className="w-3 h-3" />
        <span>Último escaneo: {lastUpdate.toLocaleTimeString('es-ES')}</span>
        {scanning && (
          <motion.span
            animate={{ opacity: [1, 0.5] }}
            transition={{ duration: 0.5, repeat: Infinity }}
            className="text-[#5E5CE6] font-medium"
          >
            • Escaneando...
          </motion.span>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white rounded-xl p-3 text-center border border-[#E5E5EA]" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div className="text-xl font-bold text-[#1D1D1F]">{stats.totalMatches}</div>
          <div className="text-[9px] text-[#AEAEB2] uppercase font-bold">Analizados</div>
        </div>
        <div className="bg-[#F0FFF4] rounded-xl p-3 text-center border border-[#34C759]/20">
          <div className="text-xl font-bold text-[#34C759]">{stats.valueBets}</div>
          <div className="text-[9px] text-[#34C759] uppercase font-bold">Value Bets</div>
        </div>
        <div className="bg-[#EEEEFF] rounded-xl p-3 text-center border border-[#5E5CE6]/20">
          <div className="text-xl font-bold text-[#5E5CE6]">+{stats.bestEdge.toFixed(1)}%</div>
          <div className="text-[9px] text-[#5E5CE6] uppercase font-bold">Mejor Edge</div>
        </div>
        <div className="bg-[#FFF8F0] rounded-xl p-3 text-center border border-[#FF9500]/20">
          <div className="text-xl font-bold text-[#FF9500]">{stats.avgConfidence}</div>
          <div className="text-[9px] text-[#FF9500] uppercase font-bold">Conf. Media</div>
        </div>
      </div>

      {/* Scanning Animation */}
      {scanning && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#EEEEFF] rounded-xl p-4 flex items-center justify-center gap-3"
        >
          <Loader2 className="w-5 h-5 text-[#5E5CE6] animate-spin" />
          <span className="text-[#5E5CE6] font-medium">Analizando {stats.totalMatches} partidos...</span>
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
                ? 'bg-[#5E5CE6] text-white' 
                : 'bg-white text-[#6E6E73] border border-[#E5E5EA]'
            }`}
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
            <div className="bg-[#F5F5F7] w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="text-[#AEAEB2] w-10 h-10" />
            </div>
            <p className="text-[#1D1D1F] font-semibold text-lg">No se detectaron value bets</p>
            <p className="text-[#6E6E73] text-sm mt-2">con edge superior a 3% en este momento.</p>
            <p className="text-[#AEAEB2] text-xs mt-1">El escáner se actualiza automáticamente cada 30 minutos.</p>
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
                className="bg-white rounded-2xl p-4 border border-[#E5E5EA]"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getSportEmoji(result.sport)}</span>
                    <div>
                      <h4 className="font-bold text-[#1D1D1F]">{result.match_name}</h4>
                      <p className="text-xs text-[#AEAEB2]">{result.league}</p>
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
                      <p className="text-[10px] text-[#AEAEB2] uppercase font-bold">Selección</p>
                      <p className="font-bold text-[#5E5CE6]">{result.selection}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#AEAEB2] uppercase font-bold">Cuota</p>
                      <p className="font-bold text-[#1D1D1F]">{result.odds.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[#AEAEB2] uppercase font-bold">Casa</p>
                      <p className="text-sm text-[#6E6E73]">{result.bookmaker}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[#34C759]">+{result.estimated_edge.toFixed(1)}%</div>
                    <div className="text-[10px] text-[#34C759] uppercase font-bold">Edge</div>
                  </div>
                </div>

                {/* Confidence Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-[10px] mb-1">
                    <span className="text-[#AEAEB2]">Confianza</span>
                    <span className="font-bold" style={{ color: getConfidenceColor(result.confidence) }}>
                      {result.confidence}/10
                    </span>
                  </div>
                  <div className="h-2 bg-[#F5F5F7] rounded-full overflow-hidden">
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
                <div className="bg-[#F5F5F7] rounded-xl p-3 mb-3">
                  <p className="text-sm text-[#6E6E73] italic">"{result.analysis_short}"</p>
                </div>

                {/* Analyze Button */}
                <button
                  onClick={() => handleAnalyzeMatch(result.match_name)}
                  className="w-full py-3 bg-[#5E5CE6] hover:bg-[#4B49C8] text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                  style={{ boxShadow: '0 2px 8px rgba(94,92,230,0.3)' }}
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

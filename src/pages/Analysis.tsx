import React, { useState } from 'react';
import { Search, Calendar, Sparkles, Loader2, TrendingUp, Verified, Info } from 'lucide-react';
import { Prediction } from '../types';
import { motion, AnimatePresence } from 'motion/react';

const STORAGE_KEY = 'coco_vip_predictions';

const SPORTS = [
  { id: 'football', name: 'Fútbol', emoji: '⚽' },
  { id: 'basketball', name: 'Basketball', emoji: '🏀' },
  { id: 'baseball', name: 'Béisbol', emoji: '⚾' }
];

export default function Analysis() {
  const [formData, setFormData] = useState({
    match_name: '',
    date: '',
    sport: 'football',
    user_context: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Prediction | null>(null);
  const [saved, setSaved] = useState(false);

  const handleAnalyze = async () => {
    if (!formData.match_name) return;
    setLoading(true);
    setResult(null);
    setSaved(false);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      
      const normalizedResult: Prediction = {
        id: Date.now().toString(),
        matchName: data.matchName || data.match_name || formData.match_name,
        sport: data.sport || formData.sport,
        bestMarket: data.bestMarket || data.best_market || 'Análisis completo',
        selection: data.selection || '',
        bookmaker: data.bookmaker || 'General',
        odds: data.odds || 1.85,
        edgePercent: data.edgePercent || data.edge_percent || 8.5,
        confidence: data.confidence || 7,
        analysisText: data.analysisText || data.analysis_text || 'Análisis completado',
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      setResult(normalizedResult);
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveToHistory = async () => {
    if (!result) return;
    
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const existing: Prediction[] = stored ? JSON.parse(stored) : [];
      
      const newPrediction: Prediction = {
        ...result,
        userContext: formData.user_context,
        createdAt: new Date().toISOString()
      };
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify([newPrediction, ...existing]));
      setSaved(true);
    } catch (error) {
      console.error("Error saving to history:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Análisis Manual</h2>
        <p className="text-sm text-slate-500 mt-1">La IA analizará todos los mercados y te dará las mejores opciones</p>
      </div>

      <div className="space-y-5">
        {/* Sport Selector */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700 ml-1">Deporte</label>
          <div className="grid grid-cols-3 gap-2">
            {SPORTS.map((sport) => (
              <button
                key={sport.id}
                onClick={() => setFormData({ ...formData, sport: sport.id })}
                className={`py-3 rounded-xl font-medium text-sm transition-all flex flex-col items-center gap-1 ${
                  formData.sport === sport.id 
                    ? 'bg-[#895af6] text-white shadow-lg shadow-[#895af6]/20' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-[#895af6]'
                }`}
              >
                <span className="text-xl">{sport.emoji}</span>
                <span>{sport.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Match Name */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700 ml-1">Partido o Equipos</label>
          <div className="relative flex items-center">
            <Search className="absolute left-4 text-slate-400 w-5 h-5" />
            <input
              value={formData.match_name}
              onChange={(e) => setFormData({ ...formData, match_name: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#895af6] focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400"
              placeholder="Ej: Real Madrid vs Barcelona"
              type="text"
            />
          </div>
        </div>

        {/* Date */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700 ml-1">Fecha (Opcional)</label>
          <div className="relative flex items-center">
            <Calendar className="absolute left-4 text-slate-400 w-5 h-5" />
            <input
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#895af6] focus:border-transparent outline-none text-slate-900 text-sm"
              type="date"
            />
          </div>
        </div>

        {/* Additional Context */}
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700 ml-1">Contexto Adicional</label>
          <textarea
            value={formData.user_context}
            onChange={(e) => setFormData({ ...formData, user_context: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#895af6] focus:border-transparent outline-none text-slate-900 placeholder:text-slate-400 resize-none text-sm"
            placeholder="Lesiones, clima, motivación del equipo, racha reciente..."
            rows={3}
          ></textarea>
        </div>

        {/* Analyze Button */}
        <button
          onClick={handleAnalyze}
          disabled={loading || !formData.match_name}
          className="w-full py-4 bg-gradient-to-r from-[#895af6] to-[#7c4df2] hover:opacity-90 text-white font-bold rounded-2xl shadow-lg shadow-[#895af6]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Analizando...
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5" />
              Analizar Value Bet
            </>
          )}
        </button>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="mt-10 pb-10"
          >
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 px-1">Resultado del Análisis</h3>
            
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-[10px] font-bold text-[#895af6] uppercase tracking-wider mb-1">Mejor Value Bet</p>
                  <h4 className="text-xl font-bold text-slate-900 leading-tight">{result.selection}</h4>
                  <p className="text-sm text-slate-500">{result.matchName}</p>
                </div>
                <div className="bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-full text-sm font-bold border border-emerald-100">
                  +{result.edgePercent.toFixed(1)}% Edge
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Confianza</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl font-bold text-slate-900">{result.confidence}</span>
                    <span className="text-sm text-slate-400">/ 10</span>
                  </div>
                  <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-[#895af6] to-[#a78bfa] rounded-full"
                      style={{ width: `${result.confidence * 10}%` }}
                    ></div>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Cuota</p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-slate-900">{result.odds.toFixed(2)}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{result.bookmaker}</p>
                </div>
              </div>

              {/* Market Info */}
              <div className="bg-purple-50 p-3 rounded-xl mb-4 flex items-center justify-between">
                <span className="text-sm text-[#895af6]">Mercado: <strong>{result.bestMarket}</strong></span>
                <span className="text-xs text-[#895af6]/70">{result.sport}</span>
              </div>

              {/* Analysis Text */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#895af6]" />
                  Análisis
                </p>
                <p className="text-sm leading-relaxed text-slate-600 bg-slate-50 rounded-xl p-4 italic">
                  "{result.analysisText}"
                </p>
              </div>

              {/* Save Button */}
              {!saved ? (
                <button
                  onClick={saveToHistory}
                  className="mt-6 w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-colors"
                >
                  <TrendingUp className="w-4 h-4" />
                  Guardar en Historial
                </button>
              ) : (
                <div className="mt-6 w-full py-3 bg-emerald-100 text-emerald-700 font-bold rounded-xl flex items-center justify-center gap-2">
                  <Verified className="w-4 h-4" />
                  Guardado en tu historial
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

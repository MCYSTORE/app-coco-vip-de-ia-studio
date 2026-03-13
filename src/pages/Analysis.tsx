import React, { useState } from 'react';
import { Search, Calendar, Target, Sparkles, Loader2, TrendingUp, Verified } from 'lucide-react';
import { db, auth } from '../firebase';
import { collection, addDoc } from 'firebase/firestore';
import { Prediction } from '../types';
import { motion, AnimatePresence } from 'motion/react';

export default function Analysis() {
  const [formData, setFormData] = useState({
    match_name: '',
    date: '',
    market_preference: '1X2 Full Time',
    user_context: ''
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async () => {
    if (!formData.match_name) return;
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await response.json();
      setResult(data);

      // Save to history automatically
      if (auth.currentUser) {
        await addDoc(collection(db, 'predictions'), {
          ...data,
          userId: auth.currentUser.uid,
          createdAt: new Date().toISOString(),
          userContext: formData.user_context,
          matchName: formData.match_name,
          bestMarket: data.best_market,
          edgePercent: data.edge_percent,
          analysisText: data.analysis_text
        });
      }
    } catch (error) {
      console.error("Analysis error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Manual Analysis</h2>
        <p className="text-sm text-slate-500 mt-1">Analiza cualquier partido para encontrar el valor oculto.</p>
      </div>

      <div className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700 ml-1">Match or Team</label>
          <div className="relative flex items-center">
            <Search className="absolute left-4 text-slate-400 w-5 h-5" />
            <input
              value={formData.match_name}
              onChange={(e) => setFormData({ ...formData, match_name: e.target.value })}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#895af6] outline-none text-slate-900 placeholder:text-slate-400"
              placeholder="Ej: Real Madrid vs Man City"
              type="text"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 ml-1">Date (Optional)</label>
            <div className="relative flex items-center">
              <Calendar className="absolute left-3.5 text-slate-400 w-5 h-5" />
              <input
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full pl-11 pr-3 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#895af6] outline-none text-slate-900 text-sm"
                type="date"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 ml-1">Market Type</label>
            <div className="relative flex items-center">
              <select
                value={formData.market_preference}
                onChange={(e) => setFormData({ ...formData, market_preference: e.target.value })}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#895af6] outline-none text-slate-900 text-sm appearance-none"
              >
                <option>1X2 Full Time</option>
                <option>Over/Under 2.5</option>
                <option>Both Teams Score</option>
                <option>Handicap</option>
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700 ml-1">Additional Context</label>
          <textarea
            value={formData.user_context}
            onChange={(e) => setFormData({ ...formData, user_context: e.target.value })}
            className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-[#895af6] outline-none text-slate-900 placeholder:text-slate-400 resize-none text-sm"
            placeholder="Lesiones, clima, motivación del equipo..."
            rows={3}
          ></textarea>
        </div>

        <button
          onClick={handleAnalyze}
          disabled={loading || !formData.match_name}
          className="w-full py-4 bg-gradient-to-r from-[#895af6] to-[#7c4df2] hover:opacity-90 text-white font-bold rounded-2xl shadow-lg shadow-[#895af6]/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Sparkles className="w-5 h-5" />
          )}
          Analizar Value Bet
        </button>
      </div>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-10 pb-10"
          >
            <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-4 px-1">Latest Result</h3>
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="text-[10px] font-bold text-[#895af6] uppercase tracking-wider mb-1">Best Value Bet</p>
                  <h4 className="text-xl font-bold text-slate-900 leading-tight">{result.selection}</h4>
                  <p className="text-sm text-slate-500">{result.match_name}</p>
                </div>
                <div className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold border border-emerald-100">
                  +{result.edge_percent}% Edge
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-3 rounded-2xl">
                  <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Confidence</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold text-slate-900">{result.confidence}</span>
                    <span className="text-xs text-slate-400">/ 10</span>
                  </div>
                </div>
                <div className="bg-slate-50 p-3 rounded-2xl">
                  <p className="text-[10px] text-slate-400 uppercase font-bold mb-1">Odds</p>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold text-slate-900">{result.odds}</span>
                    <span className="text-xs text-slate-400">{result.bookmaker}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">Quick Explanation</p>
                <p className="text-xs leading-relaxed text-slate-500 italic">
                  "{result.analysis_text}"
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

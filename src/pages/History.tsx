import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Prediction } from '../types';
import { History as HistoryIcon, Trophy, TrendingUp, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function History() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'predictions'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prediction));
      setPredictions(data);
      setLoading(false);
    }, (error) => {
      console.error("Firestore error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#895af6]"></div>
      </div>
    );
  }

  if (predictions.length === 0) {
    return (
      <div className="text-center py-20 px-6">
        <div className="bg-slate-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <HistoryIcon className="text-slate-400 w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">No hay historial</h3>
        <p className="text-slate-500 text-sm">Tus análisis aparecerán aquí automáticamente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-slate-900">Historial</h2>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {predictions.length} ANALISIS
        </span>
      </div>

      <div className="space-y-4">
        {predictions.map((bet) => (
          <div
            key={bet.id}
            className={cn(
              "bg-white rounded-2xl p-4 shadow-sm border-l-4",
              bet.status === 'won' ? "border-emerald-500" : 
              bet.status === 'lost' ? "border-red-500" : "border-[#895af6]"
            )}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <Trophy className="text-[#895af6] w-4 h-4" />
                <span className="text-[11px] font-bold text-slate-400 uppercase">{bet.sport || 'Sports'}</span>
              </div>
              <div className={cn(
                "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                bet.status === 'won' ? "bg-emerald-50 text-emerald-600" :
                bet.status === 'lost' ? "bg-red-50 text-red-600" : "bg-slate-50 text-slate-600"
              )}>
                {bet.status}
              </div>
            </div>
            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-bold text-slate-800">{bet.matchName}</h4>
                <p className="text-sm text-slate-500">{bet.selection} @ {bet.odds}</p>
              </div>
              <div className="text-right">
                <div className="text-[#895af6] font-bold text-lg">+{bet.edgePercent}%</div>
                <div className="text-[10px] text-slate-400 font-medium">Value Edge</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-50 flex justify-between text-[11px]">
              <span className="text-slate-400">
                {format(new Date(bet.createdAt), 'MMM d, HH:mm')}
              </span>
              <span className="text-slate-400">Confianza: {bet.confidence}/10</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

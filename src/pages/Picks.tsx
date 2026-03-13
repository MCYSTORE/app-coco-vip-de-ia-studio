import React, { useState, useEffect } from 'react';
import PickCard from '../components/PickCard';
import { Prediction } from '../types';
import { Loader2, RefreshCw } from 'lucide-react';

export default function Picks() {
  const [picks, setPicks] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPicks = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/top-picks');
      const data = await response.json();
      setPicks(data);
    } catch (error) {
      console.error("Error fetching picks:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPicks();
    const interval = setInterval(fetchPicks, 30 * 60 * 1000); // Auto-refresh every 30min
    return () => clearInterval(interval);
  }, []);

  if (loading && picks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-10 h-10 text-[#895af6] animate-spin mb-4" />
        <p className="text-slate-500 font-medium">Analizando mercados en tiempo real...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Top Picks</h2>
          <p className="text-sm text-slate-500">Mejores oportunidades detectadas hoy</p>
        </div>
        <button
          onClick={fetchPicks}
          disabled={loading}
          className="p-2 text-[#895af6] hover:bg-[#895af6]/10 rounded-full transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
        </button>
      </div>

      <div className="space-y-6">
        {picks.map((pick) => (
          <PickCard key={pick.id} pick={pick} />
        ))}
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}

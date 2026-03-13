import React from 'react';
import { Prediction } from '../types';
import { TrendingUp, Verified, Calendar, Target, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';

interface PickCardProps {
  pick: Prediction;
  onDetail?: (pick: Prediction) => void;
}

export default function PickCard({ pick, onDetail }: PickCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm transition-all hover:shadow-md border border-slate-100"
    >
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-200">
        <img
          src={`https://picsum.photos/seed/${pick.matchName}/800/450`}
          alt={pick.matchName}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          referrerPolicy="no-referrer"
        />
        {pick.confidence >= 9 && (
          <div className="absolute top-3 right-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-[#895af6] shadow-sm">
            TOP PICK
          </div>
        )}
      </div>
      <div className="flex flex-col p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 truncate pr-2">{pick.matchName}</h2>
          <div className="flex items-center gap-1 text-emerald-500 shrink-0">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-bold">+{pick.edgePercent}% Edge</span>
          </div>
        </div>
        <div className="mb-4 space-y-1">
          <div className="flex items-center gap-2 text-slate-500">
            <Target className="w-4 h-4" />
            <p className="text-sm">Mercado: {pick.bestMarket}</p>
          </div>
          <div className="flex items-center gap-2 text-slate-500">
            <Verified className="w-4 h-4" />
            <p className="text-sm">Confianza: <span className="text-slate-900 font-medium">{pick.confidence}/10</span></p>
          </div>
        </div>
        <button
          onClick={() => onDetail?.(pick)}
          className="flex w-full items-center justify-center rounded-xl bg-[#895af6] py-3 text-sm font-bold text-white transition-opacity active:opacity-90"
        >
          Ver detalle
        </button>
      </div>
    </motion.div>
  );
}

import React from 'react';
import { Sliders, Radio, Edit3 } from 'lucide-react';

export default function InputModeSelector({ activeMode, onModeChange }) {
  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-xl mb-6">
      {/* Centered Title and Context */}
      <div className="flex flex-col items-center justify-center text-center mb-5">
        <div className="flex items-center justify-center gap-2.5 mb-1.5 flex-wrap">
          <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-indigo-500/10 rounded-xl border border-cyan-500/30 text-cyan-400 shadow-md shadow-cyan-500/10">
            <Sliders className="w-5 h-5" />
          </div>
          <h2 className="text-base sm:text-lg font-black text-white uppercase tracking-wider font-mono">
            DATA INPUT SOURCE
          </h2>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono">
            {activeMode === 'manual' ? 'Mode 1: Manual' : 'Mode 2: Real-Time'}
          </span>
        </div>
        <p className="text-xs text-slate-400 max-w-lg">
          Select how to supply battery telemetry. Both modes feed the same unified AI analysis pipeline.
        </p>
      </div>

      {/* Mode Selector Buttons Kept in Center */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 max-w-xl mx-auto">
        {/* Option 1: Manual Input */}
        <button
          type="button"
          onClick={() => onModeChange('manual')}
          className={`flex items-center gap-3 px-6 py-3.5 rounded-xl text-xs font-bold transition-all border w-full sm:w-64 text-left ${
            activeMode === 'manual'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white border-cyan-400/60 shadow-lg shadow-cyan-500/25 ring-2 ring-cyan-400/30 scale-[1.02]'
              : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850 hover:border-slate-700'
          }`}
        >
          <div className={`p-2 rounded-lg shrink-0 ${activeMode === 'manual' ? 'bg-white/20 text-white' : 'bg-slate-800 text-cyan-400'}`}>
            <Edit3 className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-extrabold tracking-wide uppercase">Manual Input</div>
            <div className={`text-[10px] font-medium ${activeMode === 'manual' ? 'text-cyan-100' : 'text-slate-400'}`}>
              Enter pack parameters
            </div>
          </div>
        </button>

        {/* Option 2: Real-Time Dataset */}
        <button
          type="button"
          onClick={() => onModeChange('realtime')}
          className={`flex items-center gap-3 px-6 py-3.5 rounded-xl text-xs font-bold transition-all border w-full sm:w-64 text-left ${
            activeMode === 'realtime'
              ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-white border-indigo-400/60 shadow-lg shadow-indigo-500/25 ring-2 ring-cyan-400/30 scale-[1.02]'
              : 'bg-slate-950/80 border-slate-800 text-slate-300 hover:text-white hover:bg-slate-850 hover:border-slate-700'
          }`}
        >
          <div className={`p-2 rounded-lg shrink-0 ${activeMode === 'realtime' ? 'bg-white/20 text-white' : 'bg-slate-800 text-indigo-400'}`}>
            <Radio className={`w-4 h-4 ${activeMode === 'realtime' ? 'animate-pulse' : ''}`} />
          </div>
          <div>
            <div className="text-xs font-extrabold tracking-wide uppercase">Real-Time Dataset</div>
            <div className={`text-[10px] font-medium ${activeMode === 'realtime' ? 'text-indigo-100' : 'text-slate-400'}`}>
              Auto-ingest from dataset
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}


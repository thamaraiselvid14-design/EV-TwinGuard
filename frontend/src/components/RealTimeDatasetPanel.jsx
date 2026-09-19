import React from 'react';
import {
  Database,
  Radio,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  CheckCircle2,
  Clock,
  Battery,
  Layers,
} from 'lucide-react';

export default function RealTimeDatasetPanel({
  status,
  isRunning,
  onStart,
  onPause,
  onNext,
  onReset,
  intervalSeconds,
  onIntervalChange,
  latestData,
  lastUpdateTime,
  loadingNext,
  timeLeft = 0,
}) {
  const currentIndex = latestData?.index ?? status?.current_index ?? 1;
  const totalRecords = latestData?.total_records ?? status?.total_records ?? 25;
  const isComplete = latestData?.is_complete || (currentIndex >= totalRecords && !isRunning);

  // Active pack identifier
  const telemetry = latestData?.telemetry || {};
  const batteryId = telemetry.battery_id || 'EV-FLEET-001';

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 shadow-xl backdrop-blur-xl relative overflow-hidden space-y-5">
      {/* Subtle ambient glow */}
      <div className="absolute top-0 right-10 -mt-10 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* ─── 1. Header: Real-Time Dataset & Status ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 via-blue-600/20 to-indigo-600/20 rounded-2xl border border-cyan-500/40 text-cyan-400 shadow-md">
            <Radio className={`w-6 h-6 ${isRunning ? 'animate-pulse text-cyan-300' : 'text-slate-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-lg sm:text-xl font-black text-white tracking-tight uppercase">
                Real-Time Battery Data
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono">
                Source: EV Battery Dataset
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Telemetry automatically enters from dataset and is analyzed via the AI prediction &amp; risk pipeline.
            </p>
          </div>
        </div>

        {/* Live Running / Paused Status */}
        <div className="flex items-center gap-3">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs tracking-wider font-mono shadow-md ${
              isRunning
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-emerald-950/40'
                : 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-amber-950/40'
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isRunning ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
              }`}
            />
            <span>{isRunning ? '● RECEIVING DATA' : '● PAUSED'}</span>
          </div>
        </div>
      </div>

      {/* ─── 2. Stream Metadata Stats ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Source */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
          <span className="text-[10px] uppercase font-mono text-slate-400 block tracking-wider flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-cyan-400" /> Source
          </span>
          <span className="font-bold text-white text-xs mt-1 block truncate">
            EV Battery Dataset
          </span>
        </div>

        {/* Record Position */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
          <span className="text-[10px] uppercase font-mono text-slate-400 block tracking-wider flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" /> Record Position
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-mono font-black text-cyan-300 text-sm sm:text-base">
              {currentIndex}
            </span>
            <span className="font-mono text-xs text-slate-400">
              / {totalRecords}
            </span>
          </div>
        </div>

        {/* Active Pack */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
          <span className="text-[10px] uppercase font-mono text-slate-400 block tracking-wider flex items-center gap-1.5">
            <Battery className="w-3.5 h-3.5 text-emerald-400" /> Active Pack
          </span>
          <span className="font-mono font-bold text-emerald-300 text-xs sm:text-sm mt-1 block truncate">
            {batteryId}
          </span>
        </div>

        {/* Last Update */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3">
          <span className="text-[10px] uppercase font-mono text-slate-400 block tracking-wider flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400" /> Last Update
          </span>
          <span className="font-mono font-semibold text-slate-200 text-xs mt-1 block truncate">
            {lastUpdateTime || 'Awaiting stream...'}
          </span>
        </div>
      </div>

      {/* ─── 3. Controls & Time Interval Display ─── */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Stream Buttons */}
          <div className="flex items-center gap-2.5 w-full lg:w-auto flex-wrap sm:flex-nowrap">
            {isRunning ? (
              <button
                type="button"
                onClick={onPause}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 transition transform active:scale-95"
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStart}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 transition transform active:scale-95"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Start Stream</span>
              </button>
            )}

            <button
              type="button"
              disabled={loadingNext || isRunning}
              onClick={onNext}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-700 transition disabled:opacity-50"
            >
              {loadingNext ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <SkipForward className="w-4 h-4 text-cyan-400" />
              )}
              <span>Next Record</span>
            </button>

            <button
              type="button"
              onClick={onReset}
              title="Restart dataset from record 1"
              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition text-xs font-semibold"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Restart</span>
            </button>
          </div>

          {/* Time Interval & Live Countdown Display */}
          <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end flex-wrap">
            {/* Live Countdown Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 font-mono text-xs">
              <Clock className={`w-3.5 h-3.5 ${isRunning ? 'text-cyan-400 animate-spin' : 'text-slate-500'}`} />
              <span className="text-slate-400">Next Record in:</span>
              <span className={`font-bold ${isRunning ? 'text-cyan-300' : 'text-amber-400'}`}>
                {isRunning ? `${Number(timeLeft).toFixed(1)}s` : 'PAUSED'}
              </span>
            </div>

            {/* Stream Interval Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium font-mono">Interval:</span>
              <div className="inline-flex p-0.5 bg-slate-900 border border-slate-800 rounded-lg">
                {[1, 2, 3, 5, 10].map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => onIntervalChange(sec)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition ${
                      intervalSeconds === sec
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sec}s
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Live interval progress countdown bar */}
        <div className="w-full bg-slate-800/60 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-full transition-all duration-100 ease-linear ${
              isRunning
                ? 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 shadow-sm shadow-cyan-400/50'
                : 'bg-slate-700'
            }`}
            style={{
              width: isRunning
                ? `${Math.min(100, Math.max(0, ((intervalSeconds - (timeLeft ?? intervalSeconds)) / intervalSeconds) * 100))}%`
                : '0%',
            }}
          />
        </div>
      </div>



      {/* ─── 5. Dataset Complete Banner (if applicable) ─── */}
      {isComplete && (
        <div className="bg-gradient-to-r from-cyan-950/60 via-blue-950/60 to-indigo-950/60 border border-cyan-500/40 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-300">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase text-white font-mono tracking-wider">
                  ● DATASET COMPLETE
                </span>
                <span className="text-[11px] text-cyan-300 font-mono">({totalRecords} / {totalRecords} Records Auto-Analyzed)</span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                All fleet records processed through AI prediction &amp; risk engine. Click &quot;Restart Dataset&quot; to restart from record 1.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onReset}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 transition transform active:scale-95"
          >
            Restart Dataset
          </button>
        </div>
      )}
    </div>
  );
}

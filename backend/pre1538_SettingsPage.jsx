import React, { useState } from 'react';
import WhatIfChargingSimulator from './WhatIfChargingSimulator';
import DigitalTwinSimulator from './DigitalTwinSimulator';
import DatasetExplorer from './DatasetExplorer';
import {
  Settings,
  Database,
  Radio,
  Sliders,
  Activity,
  ShieldCheck,
  Bell,
  Cpu,
  Server,
  Play,
  Pause,
  RotateCcw,
  RefreshCw,
  CheckCircle2,
  Clock,
  Gauge,
  Thermometer,
  Zap,
  Info,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

export default function SettingsPage({
  currentBatteryState,
  realtimeStatus,
  realtimeRunning,
  realtimeInterval,
  onStartRealtimeStream,
  onPauseRealtimeStream,
  onResetRealtimeStream,
  onIntervalChange,
  onSelectDatasetRecord,
}) {
  const [showDatasetExplorer, setShowDatasetExplorer] = useState(false);
  const [reloadingDataset, setReloadingDataset] = useState(false);

  const currentIndex = realtimeStatus?.current_index ?? 1;
  const totalRecords = realtimeStatus?.total_records ?? 25;

  const handleReloadDataset = () => {
    setReloadingDataset(true);
    setTimeout(() => {
      setReloadingDataset(false);
      onResetRealtimeStream && onResetRealtimeStream();
    }, 600);
  };

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
        <div className="flex items-center space-x-3.5">
          <div className="p-3 bg-gradient-to-br from-cyan-500/20 via-blue-600/20 to-indigo-600/20 rounded-2xl border border-cyan-500/30 text-cyan-400 shadow-md">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight uppercase">
              System Settings &amp; Advanced Tools
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Comprehensive hardware simulation, stream pacing, risk thresholds, and AI model specifications
            </p>
          </div>
        </div>
      </div>

      {/* ─── 1 & 2: DATASET SETTINGS & REAL-TIME STREAM SETTINGS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* 1. DATASET SETTINGS */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wide">
                    Dataset Settings
                  </h3>
                  <p className="text-xs text-slate-400">Baseline fleet dataset repository</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold uppercase">
                AVAILABLE
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs text-slate-300">
              <div className="flex items-center justify-between bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400">Dataset Source:</span>
                <span className="font-bold text-white">EV Battery Dataset (sample_battery_dataset.csv)</span>
              </div>
              <div className="flex items-center justify-between bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400">Total Records:</span>
                <span className="font-bold text-cyan-300">{totalRecords} Records</span>
              </div>
              <div className="flex items-center justify-between bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400">Validation Status:</span>
                <span className="font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> 100% Validated
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center gap-3">
            <button
              type="button"
              onClick={handleReloadDataset}
              disabled={reloadingDataset}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${reloadingDataset ? 'animate-spin text-cyan-400' : ''}`} />
              <span>{reloadingDataset ? 'Reloading...' : 'Reload Dataset'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowDatasetExplorer(!showDatasetExplorer)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition"
            >
              <span>{showDatasetExplorer ? 'Hide Table' : 'Inspect Records'}</span>
              {showDatasetExplorer ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </section>

        {/* 2. REAL-TIME STREAM SETTINGS */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
                  <Radio className={`w-5 h-5 ${realtimeRunning ? 'animate-pulse text-cyan-300' : ''}`} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white uppercase tracking-wide">
                    Real-Time Stream Settings
                  </h3>
                  <p className="text-xs text-slate-400">Simulation pacing and cycle execution</p>
                </div>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${
                  realtimeRunning
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                }`}
              >
                {realtimeRunning ? '● STREAMING' : '● PAUSED'}
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400">Stream Mode:</span>
                <span className="font-bold text-white">Continuous Simulation</span>
              </div>

              {/* Update Interval Selector */}
              <div className="flex items-center justify-between bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400">Update Interval:</span>
                <div className="inline-flex p-0.5 bg-slate-900 border border-slate-800 rounded-lg">
                  {[1, 2, 3, 5, 10].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => onIntervalChange && onIntervalChange(sec)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition ${
                        realtimeInterval === sec
                          ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Record Position */}
              <div className="flex items-center justify-between bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                <span className="text-slate-400">Current Record:</span>
                <span className="font-bold text-cyan-300">
                  {currentIndex} / {totalRecords}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-4 border-t border-slate-800 flex items-center gap-2.5">
            {realtimeRunning ? (
              <button
                type="button"
                onClick={onPauseRealtimeStream}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-wider transition"
              >
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onStartRealtimeStream}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 text-xs font-bold uppercase tracking-wider transition shadow-md shadow-emerald-950/40"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start</span>
              </button>
            )}

            <button
              type="button"
              onClick={onResetRealtimeStream}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restart</span>
            </button>
          </div>
        </section>
      </div>

      {/* Expandable Dataset Table (if toggled) */}
      {showDatasetExplorer && (
        <section className="animate-in fade-in slide-in-from-top-4 duration-300">
          <DatasetExplorer onSelectRecord={onSelectDatasetRecord} />
        </section>
      )}

      {/* ─── 3. WHAT-IF CHARGING SIMULATOR (12A vs 18A vs 25A) ─── */}
      <section>
        <WhatIfChargingSimulator currentBatteryState={currentBatteryState} />
      </section>

      {/* ─── 4. TIME-SERIES SIMULATION ─── */}
      <section>
        <DigitalTwinSimulator />
      </section>

      {/* ─── 5 & 6: RISK CONFIGURATION & ALERT CONFIGURATION ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* 5. RISK CONFIGURATION */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-800 mb-4">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wide">
                Risk Configuration
              </h3>
              <p className="text-xs text-slate-400">Algorithmic thresholds and weight decomposition</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Thresholds */}
            <div>
              <span className="text-[11px] uppercase font-mono text-slate-400 block tracking-wider mb-2 font-bold">
                Risk Thresholds:
              </span>
              <div className="grid grid-cols-3 gap-2.5 font-mono text-xs">
                <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-2.5 text-center">
                  <span className="text-emerald-400 font-bold block">LOW</span>
                  <span className="text-slate-300 text-[11px]">0 – 39</span>
                </div>
                <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-2.5 text-center">
                  <span className="text-amber-400 font-bold block">MEDIUM</span>
                  <span className="text-slate-300 text-[11px]">40 – 69</span>
                </div>
                <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-2.5 text-center">
                  <span className="text-rose-400 font-bold block">HIGH</span>
                  <span className="text-slate-300 text-[11px]">70 – 100</span>
                </div>
              </div>
            </div>

            {/* Weights */}
            <div>
              <span className="text-[11px] uppercase font-mono text-slate-400 block tracking-wider mb-2 font-bold">
                Multi-Factor Risk Weights:
              </span>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between bg-slate-950/70 px-3 py-2 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Temperature Weight</span>
                  <span className="font-bold text-orange-400">35%</span>
                </div>
                <div className="flex justify-between bg-slate-950/70 px-3 py-2 rounded-lg border border-slate-800">
                  <span className="text-slate-300">State of Charge (SOC) Weight</span>
                  <span className="font-bold text-cyan-400">20%</span>
                </div>
                <div className="flex justify-between bg-slate-950/70 px-3 py-2 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Charging Current Weight</span>
                  <span className="font-bold text-yellow-400">20%</span>
                </div>
                <div className="flex justify-between bg-slate-950/70 px-3 py-2 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Battery Age Weight</span>
                  <span className="font-bold text-purple-400">10%</span>
                </div>
                <div className="flex justify-between bg-slate-950/70 px-3 py-2 rounded-lg border border-slate-800">
                  <span className="text-slate-300">Charging Cycles Weight</span>
                  <span className="font-bold text-emerald-400">15%</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. ALERT CONFIGURATION */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-800 mb-4">
            <div className="p-2 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wide">
                Alert Configuration
              </h3>
              <p className="text-xs text-slate-400">Notification channels &amp; hardware trip relays</p>
            </div>
          </div>

          <div className="space-y-3 text-xs font-mono">
            {/* Email SMTP */}
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-white">Email (SMTP)</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  SMTP CONFIGURED: YES
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-300 mt-2">
                <div className="flex items-center justify-between bg-slate-900/60 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-slate-400">Recipient Configured:</span>
                  <span className="font-bold text-emerald-400">YES</span>
                </div>
                <div className="flex items-center justify-between bg-slate-900/60 px-2.5 py-1.5 rounded border border-slate-800">
                  <span className="text-slate-400">Alert Recipient:</span>
                  <span className="font-bold text-cyan-300 truncate max-w-[150px]" title="thamaraiselvid14@gmail.com">
                    thamaraiselvid14@gmail.com
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-2">
                Automated incident notification reports dispatched on MEDIUM and HIGH severity events. Password safely stored in backend .env.
              </p>
            </div>

            {/* Twilio Phone Call */}
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Twilio Voice Call</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/15 text-rose-300 border border-rose-500/30">
                  SIMULATION ACTIVE
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-1">
                Voice alarm synthesized when HIGH thermal risk score excursion is logged.
              </p>
            </div>

            {/* Contactor Trip Protection */}
            <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">Charging Protection</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  AUTOMATIC TRIP
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans mt-1">
                Commands simulated contactor to OPEN upon detecting thermal runaway conditions.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ─── 7 & 8: AI MODEL INFORMATION & SYSTEM INFORMATION ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* 7. AI MODEL INFORMATION */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-800 mb-4">
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wide">
                AI Model Information
              </h3>
              <p className="text-xs text-slate-400">Scikit-learn regressor architecture &amp; fit metrics</p>
            </div>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex justify-between bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Model Architecture</span>
              <span className="font-bold text-cyan-300">Random Forest Regressor</span>
            </div>
            <div className="flex justify-between bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Prediction Target</span>
              <span className="font-bold text-white">Future Battery Temperature (+15 min)</span>
            </div>
            <div className="flex justify-between bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Mean Absolute Error (MAE)</span>
              <span className="font-bold text-emerald-400">0.5356 °C</span>
            </div>
            <div className="flex justify-between bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Root Mean Squared Error (RMSE)</span>
              <span className="font-bold text-emerald-400">0.7668 °C</span>
            </div>
            <div className="flex justify-between bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Coefficient of Determination (R²)</span>
              <span className="font-bold text-cyan-300">0.9940</span>
            </div>
          </div>
        </section>

        {/* 8. SYSTEM INFORMATION */}
        <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-800 mb-4">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-wide">
                System Information
              </h3>
              <p className="text-xs text-slate-400">Technology stack and runtime environment</p>
            </div>
          </div>

          <div className="space-y-2.5 font-mono text-xs">
            <div className="flex justify-between bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Backend</span>
              <span className="font-bold text-white">FastAPI (Python 3.11)</span>
            </div>
            <div className="flex justify-between bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Frontend</span>
              <span className="font-bold text-white">React (Vite, TailwindCSS)</span>
            </div>
            <div className="flex justify-between bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Database</span>
              <span className="font-bold text-white">SQLite (alerts.db)</span>
            </div>
            <div className="flex justify-between bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">AI Engine</span>
              <span className="font-bold text-white">Scikit-learn Machine Learning</span>
            </div>
            <div className="flex justify-between bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-400">Trained Model</span>
              <span className="font-bold text-cyan-300">Random Forest Regressor</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

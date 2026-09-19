import React, { useState } from 'react';
import {
  Battery,
  Gauge,
  Zap,
  Thermometer,
  CloudSun,
  Clock,
  RotateCw,
  Search,
  Sparkles,
  Layers,
  RotateCcw,
} from 'lucide-react';

const PRESETS = [
  {
    name: 'Nominal City Commute',
    badgeColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    data: {
      battery_id: 'EV-CITY-01',
      soc: 82.0,
      voltage: 405.0,
      charging_current: 18.0,
      current_temperature: 32.0,
      ambient_temperature: 24.0,
      battery_age: 10.0,
      charging_cycles: 220,
    },
  },
  {
    name: 'Highway Fast Charging',
    badgeColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    data: {
      battery_id: 'EV-FAST-02',
      soc: 89.0,
      voltage: 412.0,
      charging_current: 55.0,
      current_temperature: 44.5,
      ambient_temperature: 32.0,
      battery_age: 18.0,
      charging_cycles: 550,
    },
  },
  {
    name: 'Thermal Stress Test',
    badgeColor: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    data: {
      battery_id: 'EV-CRIT-99',
      soc: 94.0,
      voltage: 418.0,
      charging_current: 75.0,
      current_temperature: 51.0,
      ambient_temperature: 38.0,
      battery_age: 36.0,
      charging_cycles: 1250,
    },
  },
];

export default function BatteryInformation({
  batteryData,
  onChange,
  onAnalyze,
  onAnalyzePreset,
  loading,
  mode = 'manual',
}) {
  const [activePreset, setActivePreset] = useState(null);

  const handlePresetSelect = (preset) => {
    setActivePreset(preset.data.battery_id);
    onChange(preset.data);
    if (onAnalyzePreset) {
      onAnalyzePreset(preset.data);
    }
  };

  const handleClearInputs = () => {
    setActivePreset(null);
    onChange({
      battery_id: '',
      soc: '',
      voltage: '',
      charging_current: '',
      current_temperature: '',
      ambient_temperature: '',
      battery_age: '',
      charging_cycles: '',
    });
  };

  const handleFieldChange = (field, val) => {
    setActivePreset(null);
    onChange({
      ...batteryData,
      [field]: val,
    });
  };

  const isRealtime = mode === 'realtime';

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-xl relative overflow-hidden">
      {/* Ambient background glow */}
      <div className="absolute top-0 right-1/4 -mt-12 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header & Preset Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 rounded-xl border border-cyan-500/30 text-cyan-400 shadow-sm">
            <Battery className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
              Battery Information
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-medium border ${
                  isRealtime
                    ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                    : 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                }`}
              >
                {isRealtime ? 'Live Real-Time Stream Ingestion' : 'Manual Telemetry Inputs'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              {isRealtime
                ? `Telemetry parameters automatically ingested for pack ${batteryData.battery_id || 'EV001'}`
                : 'Configure real-time electrochemical and thermal state parameters or choose a preset'}
            </p>
          </div>
        </div>

        {/* Presets, Clear Button, or Stream Indicator */}
        {isRealtime ? (
          <div className="flex items-center gap-2 text-xs font-mono text-cyan-300 bg-cyan-950/40 border border-cyan-800/50 px-3 py-1.5 rounded-xl">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Streaming: <strong>{batteryData.battery_id || 'EV-FLEET-001'}</strong></span>
          </div>
        ) : (
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs text-slate-400 font-medium flex items-center gap-1 mr-1">
              <Layers className="w-3.5 h-3.5 text-cyan-400" /> Presets:
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.data.battery_id}
                type="button"
                onClick={() => handlePresetSelect(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                  activePreset === p.data.battery_id
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm shadow-cyan-500/20'
                    : 'bg-slate-800/60 text-slate-400 border-slate-700/60 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {p.name}
              </button>
            ))}

            <button
              type="button"
              onClick={handleClearInputs}
              title="Clear all parameter inputs to blank"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border border-slate-700/60 bg-slate-800/40 text-slate-400 hover:text-rose-300 hover:border-rose-500/40 hover:bg-rose-950/20 ml-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Clear</span>
            </button>
          </div>
        )}
      </div>

      {/* 8-Field Telemetry Input Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {/* 1. Battery ID */}
        <div className={`border rounded-xl p-4 transition-all ${isRealtime ? 'bg-slate-800/25 border-slate-700/40' : 'bg-slate-800/40 border-slate-700/50 focus-within:border-cyan-500/60 focus-within:ring-1 focus-within:ring-cyan-500/30'}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Battery className="w-4 h-4 text-cyan-400" /> Battery ID
            </span>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">Pack ID</span>
          </div>
          <input
            type="text"
            readOnly={isRealtime}
            value={batteryData.battery_id ?? ''}
            onChange={(e) => handleFieldChange('battery_id', e.target.value)}
            className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none placeholder:text-slate-400 placeholder:font-normal placeholder:opacity-75 ${
              isRealtime
                ? 'bg-slate-900/50 border-slate-800 text-cyan-300 cursor-default'
                : 'bg-slate-900/80 border-slate-700/80 text-white focus:border-cyan-400'
            }`}
            placeholder="e.g. EV001"
          />
        </div>

        {/* 2. State of Charge (SOC) */}
        <div className={`border rounded-xl p-4 transition-all ${isRealtime ? 'bg-slate-800/25 border-slate-700/40' : 'bg-slate-800/40 border-slate-700/50 focus-within:border-cyan-500/60 focus-within:ring-1 focus-within:ring-cyan-500/30'}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-cyan-400" /> State of Charge (SOC)
            </span>
            <span className="text-[10px] text-cyan-400/80 font-bold">%</span>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              readOnly={isRealtime}
              value={batteryData.soc ?? ''}
              onChange={(e) => handleFieldChange('soc', e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none pr-8 placeholder:text-slate-400 placeholder:font-normal placeholder:opacity-75 ${
                isRealtime
                  ? 'bg-slate-900/50 border-slate-800 text-cyan-300 cursor-default'
                  : 'bg-slate-900/80 border-slate-700/80 text-white focus:border-cyan-400'
              }`}
              placeholder="e.g. 80.0"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">%</span>
          </div>
        </div>

        {/* 3. Voltage */}
        <div className={`border rounded-xl p-4 transition-all ${isRealtime ? 'bg-slate-800/25 border-slate-700/40' : 'bg-slate-800/40 border-slate-700/50 focus-within:border-cyan-500/60 focus-within:ring-1 focus-within:ring-cyan-500/30'}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-yellow-400" /> Voltage
            </span>
            <span className="text-[10px] text-yellow-400/80 font-bold">Volts</span>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="100"
              max="1000"
              readOnly={isRealtime}
              value={batteryData.voltage ?? ''}
              onChange={(e) => handleFieldChange('voltage', e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none pr-8 placeholder:text-slate-400 placeholder:font-normal placeholder:opacity-75 ${
                isRealtime
                  ? 'bg-slate-900/50 border-slate-800 text-cyan-300 cursor-default'
                  : 'bg-slate-900/80 border-slate-700/80 text-white focus:border-cyan-400'
              }`}
              placeholder="e.g. 405.0"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">V</span>
          </div>
        </div>

        {/* 4. Charging Current */}
        <div className={`border rounded-xl p-4 transition-all ${isRealtime ? 'bg-slate-800/25 border-slate-700/40' : 'bg-slate-800/40 border-slate-700/50 focus-within:border-cyan-500/60 focus-within:ring-1 focus-within:ring-cyan-500/30'}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-cyan-400" /> Charging Current
            </span>
            <span className="text-[10px] text-cyan-400/80 font-bold">Amps</span>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="0"
              max="200"
              readOnly={isRealtime}
              value={batteryData.charging_current ?? ''}
              onChange={(e) => handleFieldChange('charging_current', e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none pr-8 placeholder:text-slate-400 placeholder:font-normal placeholder:opacity-75 ${
                isRealtime
                  ? 'bg-slate-900/50 border-slate-800 text-cyan-300 cursor-default'
                  : 'bg-slate-900/80 border-slate-700/80 text-white focus:border-cyan-400'
              }`}
              placeholder="e.g. 18.0"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">A</span>
          </div>
        </div>

        {/* 5. Current Temperature */}
        <div className={`border rounded-xl p-4 transition-all ${isRealtime ? 'bg-slate-800/25 border-slate-700/40' : 'bg-slate-800/40 border-slate-700/50 focus-within:border-cyan-500/60 focus-within:ring-1 focus-within:ring-cyan-500/30'}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-orange-400" /> Current Temperature
            </span>
            <span className="text-[10px] text-orange-400/80 font-bold">Measured</span>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="-20"
              max="100"
              readOnly={isRealtime}
              value={batteryData.current_temperature ?? ''}
              onChange={(e) => handleFieldChange('current_temperature', e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none pr-8 placeholder:text-slate-400 placeholder:font-normal placeholder:opacity-75 ${
                isRealtime
                  ? 'bg-slate-900/50 border-slate-800 text-cyan-300 cursor-default'
                  : 'bg-slate-900/80 border-slate-700/80 text-white focus:border-cyan-400'
              }`}
              placeholder="e.g. 35.0"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">°C</span>
          </div>
        </div>

        {/* 6. Ambient Temperature */}
        <div className={`border rounded-xl p-4 transition-all ${isRealtime ? 'bg-slate-800/25 border-slate-700/40' : 'bg-slate-800/40 border-slate-700/50 focus-within:border-cyan-500/60 focus-within:ring-1 focus-within:ring-cyan-500/30'}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <CloudSun className="w-4 h-4 text-sky-400" /> Ambient Temperature
            </span>
            <span className="text-[10px] text-sky-400/80 font-bold">Env</span>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.1"
              min="-30"
              max="60"
              readOnly={isRealtime}
              value={batteryData.ambient_temperature ?? ''}
              onChange={(e) => handleFieldChange('ambient_temperature', e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none pr-8 placeholder:text-slate-400 placeholder:font-normal placeholder:opacity-75 ${
                isRealtime
                  ? 'bg-slate-900/50 border-slate-800 text-cyan-300 cursor-default'
                  : 'bg-slate-900/80 border-slate-700/80 text-white focus:border-cyan-400'
              }`}
              placeholder="e.g. 28.0"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">°C</span>
          </div>
        </div>

        {/* 7. Battery Age */}
        <div className={`border rounded-xl p-4 transition-all ${isRealtime ? 'bg-slate-800/25 border-slate-700/40' : 'bg-slate-800/40 border-slate-700/50 focus-within:border-cyan-500/60 focus-within:ring-1 focus-within:ring-cyan-500/30'}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-400" /> Battery Age
            </span>
            <span className="text-[10px] text-purple-400/80 font-bold">Months</span>
          </div>
          <div className="relative">
            <input
              type="number"
              step="0.5"
              min="0"
              max="120"
              readOnly={isRealtime}
              value={batteryData.battery_age ?? ''}
              onChange={(e) => handleFieldChange('battery_age', e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none pr-12 placeholder:text-slate-400 placeholder:font-normal placeholder:opacity-75 ${
                isRealtime
                  ? 'bg-slate-900/50 border-slate-800 text-cyan-300 cursor-default'
                  : 'bg-slate-900/80 border-slate-700/80 text-white focus:border-cyan-400'
              }`}
              placeholder="e.g. 12.0"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">Mos</span>
          </div>
        </div>

        {/* 8. Charging Cycles */}
        <div className={`border rounded-xl p-4 transition-all ${isRealtime ? 'bg-slate-800/25 border-slate-700/40' : 'bg-slate-800/40 border-slate-700/50 focus-within:border-cyan-500/60 focus-within:ring-1 focus-within:ring-cyan-500/30'}`}>
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <RotateCw className="w-4 h-4 text-emerald-400" /> Charging Cycles
            </span>
            <span className="text-[10px] text-emerald-400/80 font-bold">Cumulative</span>
          </div>
          <div className="relative">
            <input
              type="number"
              step="1"
              min="0"
              max="5000"
              readOnly={isRealtime}
              value={batteryData.charging_cycles ?? ''}
              onChange={(e) => handleFieldChange('charging_cycles', e.target.value)}
              className={`w-full border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none pr-12 placeholder:text-slate-400 placeholder:font-normal placeholder:opacity-75 ${
                isRealtime
                  ? 'bg-slate-900/50 border-slate-800 text-cyan-300 cursor-default'
                  : 'bg-slate-900/80 border-slate-700/80 text-white focus:border-cyan-400'
              }`}
              placeholder="e.g. 300"
            />
            <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">cyc</span>
          </div>
        </div>
      </div>

      {/* Action Footer with Primary Analyze Battery Button */}
      <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span>
            {isRealtime
              ? 'Real-Time Telemetry automatically evaluated by Random Forest AI + Risk Engine'
              : 'Runs Scikit-learn AI Prediction + Multi-Factor Risk Calculation + Automated Dispatch'}
          </span>
        </div>

        {isRealtime ? (
          <div className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-xs uppercase tracking-wider font-mono shadow-md">
            {loading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                <span>Auto-Analyzing Stream Record...</span>
              </>
            ) : (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>✓ Auto-Analyzed via Real-Time Stream</span>
              </>
            )}
          </div>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={onAnalyze}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Analyzing Battery...</span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span className="font-bold tracking-wider uppercase">Analyze Battery</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

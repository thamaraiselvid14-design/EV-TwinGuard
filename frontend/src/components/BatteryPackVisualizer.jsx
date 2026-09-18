import React, { useMemo } from 'react';
import { Cpu, Droplets, Thermometer, Zap } from 'lucide-react';

export default function BatteryPackVisualizer({ telemetry, prediction, riskAssessment }) {
  const avgTemp = prediction?.predicted_temperature ?? telemetry?.battery_temperature ?? 30.0;
  const isCharging = (telemetry?.charging_current ?? 0) > 0;
  const coolingActive = avgTemp > 38.0 || (riskAssessment?.overall_risk_score ?? 0) > 40;

  // Generate 12 cell module temperature variations around the pack
  const cells = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      // Center cells naturally trap more heat (+1.5°C to +3.5°C), edge cells cool faster
      const centerFactor = (i >= 4 && i <= 7) ? 2.2 : (i >= 2 && i <= 9) ? 1.0 : -1.2;
      const cellTemp = Math.round((avgTemp + centerFactor + ((i % 3) * 0.4)) * 10) / 10;
      
      let statusColor = 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
      let heatColor = 'from-emerald-500/20 to-teal-500/10';
      if (cellTemp >= 52.0) {
        statusColor = 'border-rose-500/60 bg-rose-500/20 text-rose-300 animate-pulse';
        heatColor = 'from-rose-500/30 to-amber-500/20';
      } else if (cellTemp >= 42.0) {
        statusColor = 'border-amber-500/50 bg-amber-500/15 text-amber-300';
        heatColor = 'from-amber-500/25 to-yellow-500/10';
      }

      return {
        id: `MOD-${i + 1}`,
        temp: cellTemp,
        statusColor,
        heatColor,
      };
    });
  }, [avgTemp]);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-800 text-cyan-400 border border-slate-700/50">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">Battery Pack Cell Array & Thermal Matrix</h3>
            <p className="text-xs text-slate-400">12-Module High-Voltage Pack Spatial Telemetry</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border ${
            coolingActive 
              ? 'bg-cyan-950/60 border-cyan-500/40 text-cyan-300 animate-pulse'
              : 'bg-slate-800/80 border-slate-700 text-slate-400'
          }`}>
            <Droplets className="w-3.5 h-3.5 text-cyan-400" />
            <span>Coolant Loop: {coolingActive ? 'ACTIVE (PUMP 100%)' : 'STANDBY'}</span>
          </div>

          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-slate-300 font-mono">
            <Thermometer className="w-3.5 h-3.5 text-amber-400" />
            <span>Avg: {avgTemp.toFixed(1)}°C</span>
          </div>
        </div>
      </div>

      {/* Pack Physical Housing Representation */}
      <div className="mt-6 p-4 rounded-xl bg-slate-950/90 border border-slate-800 relative">
        {/* Coolant manifold bar (Top) */}
        <div className="h-2.5 w-full bg-gradient-to-r from-cyan-600/40 via-cyan-400/60 to-cyan-600/40 rounded-t mb-3 flex items-center justify-center">
          <span className="text-[9px] uppercase tracking-widest text-cyan-300 font-mono font-bold">
            &larr; Liquid Coolant Inflow Manifold &rarr;
          </span>
        </div>

        {/* 12-Cell Modules Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {cells.map((cell) => (
            <div
              key={cell.id}
              className={`border rounded-xl p-3 flex flex-col items-center justify-between transition-all duration-500 bg-gradient-to-b ${cell.heatColor} ${cell.statusColor} hover:scale-105 shadow-lg`}
            >
              <div className="flex items-center justify-between w-full text-[10px] text-slate-400 font-mono">
                <span>{cell.id}</span>
                {isCharging && <Zap className="w-3 h-3 text-cyan-400 animate-bounce" />}
              </div>

              <div className="my-2 text-center">
                <span className="text-lg font-bold font-mono text-white tracking-tight">
                  {cell.temp}°C
                </span>
              </div>

              <div className="w-full bg-slate-900/80 rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-current transition-all duration-500"
                  style={{ width: `${Math.min(100, Math.max(10, (cell.temp / 60) * 100))}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Coolant manifold bar (Bottom) */}
        <div className="h-2.5 w-full bg-gradient-to-r from-cyan-600/40 via-cyan-400/60 to-cyan-600/40 rounded-b mt-3 flex items-center justify-center">
          <span className="text-[9px] uppercase tracking-widest text-cyan-300 font-mono font-bold">
            &larr; Return Chiller Loop &rarr;
          </span>
        </div>
      </div>

      {/* Legend & Thermal Zones */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pt-3 border-t border-slate-800/80">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            Optimal (&lt; 42°C)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
            Elevated (42°C - 52°C)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            Critical (&gt; 52°C)
          </span>
        </div>

        <span className="text-[11px] font-mono text-slate-400">
          Pack Nominal Voltage: {telemetry?.voltage ? `${telemetry.voltage}V` : '400.0V'}
        </span>
      </div>
    </div>
  );
}

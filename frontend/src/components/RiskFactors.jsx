import React from 'react';
import {
  AlertTriangle,
  Flame,
  ShieldCheck,
  CheckCircle2,
  Gauge,
  Thermometer,
  Zap,
  Battery,
  Clock,
  RotateCw,
  Info
} from 'lucide-react';

export default function RiskFactors({
  riskAssessment,
  loading,
  error,
}) {
  if (loading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl relative overflow-hidden flex flex-col justify-center items-center min-h-[340px]">
        <div className="w-12 h-12 border-3 border-amber-500/20 border-t-amber-400 rounded-full animate-spin mb-4" />
        <h3 className="text-base font-semibold text-white">Calculating Multi-Factor Risk...</h3>
        <p className="text-xs text-slate-400 mt-1">Analyzing thermal, electrical, and degradation stress drivers</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900/80 border border-rose-900/40 rounded-2xl p-6 shadow-xl backdrop-blur-xl relative min-h-[340px] flex flex-col justify-center items-center text-center">
        <AlertTriangle className="w-10 h-10 text-rose-400 mb-3" />
        <h3 className="text-base font-semibold text-rose-300">Risk Assessment Unavailable</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">{error}</p>
      </div>
    );
  }

  // Extract from backend payload
  const mainFactors =
    riskAssessment?.main_risk_factors ||
    riskAssessment?.factors ||
    ['Nominal operation parameters', 'No critical stress factors detected'];

  const factorScores = riskAssessment?.factor_scores || {};
  const riskLevel = riskAssessment?.risk_level || riskAssessment?.level || 'LOW';
  const recommendations = riskAssessment?.recommendations || [];

  const isHigh = riskLevel === 'HIGH';
  const isMed = riskLevel === 'MEDIUM';

  const riskBadgeStyles = isHigh
    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
    : isMed
    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

  // Configurable backend factor mappings
  const factorDefinitions = [
    { key: 'temperature', label: 'Temperature Stress', icon: Thermometer, color: 'text-orange-400', bar: 'bg-orange-500' },
    { key: 'soc', label: 'State of Charge (SOC)', icon: Battery, color: 'text-cyan-400', bar: 'bg-cyan-500' },
    { key: 'charging_current', label: 'Charging Current', icon: Zap, color: 'text-yellow-400', bar: 'bg-yellow-500' },
    { key: 'battery_age', label: 'Battery Calendar Age', icon: Clock, color: 'text-purple-400', bar: 'bg-purple-500' },
    { key: 'charging_cycles', label: 'Cumulative Cycles', icon: RotateCw, color: 'text-emerald-400', bar: 'bg-emerald-500' },
  ];

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-xl relative overflow-hidden flex flex-col justify-between transition-all">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-500/10 rounded-xl border border-amber-500/30 text-amber-400 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Main Risk Factors</h2>
              <p className="text-xs text-slate-400">Multi-parameter driving factor decomposition</p>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase border ${riskBadgeStyles}`}>
            {riskLevel} Risk
          </span>
        </div>

        {/* Identified Main Risk Factors List */}
        <div className="mt-4 space-y-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Identified Risk Triggers:
          </span>
          <div className="space-y-2">
            {mainFactors.map((factor, idx) => {
              const isWarning =
                factor.toLowerCase().includes('critical') ||
                factor.toLowerCase().includes('high') ||
                factor.toLowerCase().includes('elevated');

              return (
                <div
                  key={idx}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all text-xs font-medium ${
                    isWarning
                      ? isHigh
                        ? 'bg-rose-500/10 border-rose-500/20 text-rose-300'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                      : 'bg-slate-800/50 border-slate-700/60 text-slate-300'
                  }`}
                >
                  {isWarning ? (
                    <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${isHigh ? 'text-rose-400' : 'text-amber-400'}`} />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                  )}
                  <span>{factor}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Factor Score Meters (from backend factor_scores if provided) */}
        {Object.keys(factorScores).length > 0 && (
          <div className="mt-5 space-y-2.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Component Stress Sub-Scores (0–100):
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {factorDefinitions.map((def) => {
                const score = factorScores[def.key] ?? factorScores[def.label];
                if (score == null) return null;
                const IconComponent = def.icon;

                return (
                  <div key={def.key} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2.5">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                        <IconComponent className={`w-3.5 h-3.5 ${def.color}`} />
                        {def.label}
                      </span>
                      <span className="font-mono font-bold text-white text-xs">
                        {typeof score === 'number' ? score.toFixed(0) : score}
                      </span>
                    </div>
                    <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full ${def.bar} transition-all duration-500`}
                        style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Recommendations / BMS Action */}
      {recommendations.length > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-800/80">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400" /> Recommended Mitigation:
          </span>
          <p className="text-xs text-slate-300 bg-slate-800/60 border border-slate-700/70 rounded-lg p-2 font-mono">
            {recommendations[0]}
          </p>
        </div>
      )}
    </div>
  );
}

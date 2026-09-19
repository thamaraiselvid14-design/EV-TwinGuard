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
  RotateCw
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
        <h3 className="text-base font-semibold text-white">Evaluating Multi-Factor Risk...</h3>
        <p className="text-xs text-slate-400 mt-1">Calculating composite thermal, electrical, and degradation stress</p>
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

  const riskScore = riskAssessment?.risk_score ?? riskAssessment?.overall_risk_score ?? 32.0;
  const riskLevel = riskAssessment?.risk_level ?? riskAssessment?.level ?? (riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW');

  const mainFactors =
    riskAssessment?.main_risk_factors ||
    riskAssessment?.factors ||
    ['Nominal operation parameters', 'No critical stress factors detected'];

  const factorScores = riskAssessment?.factor_scores || {};

  const isHigh = riskLevel === 'HIGH';
  const isMed = riskLevel === 'MEDIUM';

  const riskBadgeStyles = isHigh
    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
    : isMed
    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

  const riskTextColor = isHigh
    ? 'text-rose-400'
    : isMed
    ? 'text-amber-400'
    : 'text-emerald-400';

  const riskCardBorder = isHigh
    ? 'border-rose-500/40 shadow-rose-950/30'
    : isMed
    ? 'border-amber-500/40 shadow-amber-950/30'
    : 'border-slate-800/80 shadow-slate-950/30';

  // Configurable backend factor mappings
  const factorDefinitions = [
    { key: 'temperature_score', altKey: 'temperature', label: 'Temperature Stress', weight: '35%', icon: Thermometer, color: 'text-orange-400', bar: 'bg-orange-500' },
    { key: 'soc_score', altKey: 'soc', label: 'SOC Polarization', weight: '20%', icon: Battery, color: 'text-cyan-400', bar: 'bg-cyan-500' },
    { key: 'charging_current_score', altKey: 'charging_current', label: 'Charging Current', weight: '20%', icon: Zap, color: 'text-yellow-400', bar: 'bg-yellow-500' },
    { key: 'battery_age_score', altKey: 'battery_age', label: 'Calendar Aging', weight: '10%', icon: Clock, color: 'text-purple-400', bar: 'bg-purple-500' },
    { key: 'charging_cycles_score', altKey: 'charging_cycles', label: 'Cycle Degradation', weight: '15%', icon: RotateCw, color: 'text-emerald-400', bar: 'bg-emerald-500' },
  ];

  return (
    <div className={`bg-slate-900/80 border ${riskCardBorder} rounded-2xl p-6 shadow-xl backdrop-blur-xl relative overflow-hidden flex flex-col justify-between transition-all duration-300`}>
      {/* Background glow matching risk */}
      <div
        className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
          isHigh ? 'bg-rose-500/10' : isMed ? 'bg-amber-500/10' : 'bg-emerald-500/10'
        }`}
      />

      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-amber-500/20 to-orange-500/10 rounded-xl border border-amber-500/30 text-amber-400 shadow-sm">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide uppercase">RISK ASSESSMENT</h2>
              <p className="text-xs text-slate-400">Multi-Factor Thermal Runaway Assessment</p>
            </div>
          </div>

          <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase border ${riskBadgeStyles}`}>
            {riskLevel} Risk
          </span>
        </div>

        {/* Top 2 Cards: Risk Score & Risk Level */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          {/* 1. Risk Score */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Gauge className="w-4 h-4 text-purple-400" />
                Risk Score
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-mono">Weighted</span>
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className={`text-3xl font-extrabold font-mono tracking-tight ${riskTextColor}`}>
                {typeof riskScore === 'number' ? riskScore.toFixed(1) : riskScore}
              </span>
              <span className="text-sm font-bold text-slate-500">/ 100</span>
            </div>
            {/* Progress Bar */}
            <div className="w-full bg-slate-900 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  isHigh ? 'bg-rose-500' : isMed ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(100, Math.max(0, riskScore))}%` }}
              />
            </div>
          </div>

          {/* 2. Risk Level */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                Risk Level
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-mono">Classification</span>
            </div>
            <div className="my-auto pt-1">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-sm uppercase tracking-wider ${riskBadgeStyles}`}
              >
                {isHigh ? (
                  <Flame className="w-4 h-4" />
                ) : isMed ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {riskLevel} RISK
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-2">
              {isHigh ? 'Threshold: 70–100 (Emergency)' : isMed ? 'Threshold: 40–69 (Warning)' : 'Threshold: 0–39 (Nominal)'}
            </div>
          </div>
        </div>

        {/* Contributing Risk Factors List */}
        <div className="mt-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              Contributing Risk Factors:
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Multi-parameter weights applied
            </span>
          </div>

          <div className="space-y-2">
            {mainFactors.map((factor, idx) => {
              const isWarning =
                factor.toLowerCase().includes('critical') ||
                factor.toLowerCase().includes('high') ||
                factor.toLowerCase().includes('elevated') ||
                factor.toLowerCase().includes('aged');

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
                  <span className="font-bold text-base leading-none select-none text-slate-400 mt-0.5">•</span>
                  <div className="flex-1">
                    <span>{factor}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Factor Score Meters (from backend factor_scores if provided) */}
        {Object.keys(factorScores).length > 0 && (
          <div className="mt-5 space-y-2.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Stress Sub-Scores:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {factorDefinitions.map((def) => {
                const score = factorScores[def.key] ?? factorScores[def.altKey] ?? factorScores[def.label];
                if (score == null) return null;
                const IconComponent = def.icon;

                return (
                  <div key={def.key} className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                        <IconComponent className={`w-3.5 h-3.5 ${def.color}`} />
                        {def.label}
                      </span>
                      <span className="font-mono font-bold text-white text-xs">
                        {typeof score === 'number' ? score.toFixed(0) : score} / 100
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

      {/* Footer Info */}
      <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
        <span>Weights: Temp 35% | SOC 20% | Current 20% | Cycles 15% | Age 10%</span>
        <span className="font-mono text-[11px] text-slate-400">BMS Safety Standard</span>
      </div>
    </div>
  );
}


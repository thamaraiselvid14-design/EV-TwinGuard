import React from 'react';
import { Shield, AlertTriangle, Flame, Zap, BatteryCharging, Gauge } from 'lucide-react';

export default function RiskGauge({ riskAssessment, prediction }) {
  if (!riskAssessment) return null;

  const { overall_risk_score, risk_level, risk_factors, recommendations } = riskAssessment;

  // Determine badge and color themes based on risk tier
  const tierConfig = {
    LOW: {
      badgeBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
      glow: 'shadow-emerald-500/20 text-emerald-400',
      barColor: 'bg-emerald-500',
      strokeColor: '#10b981',
      label: 'LOW RISK (OPTIMAL)',
      desc: 'Pack is operating safely within nominal electro-thermal limits.',
    },
    MEDIUM: {
      badgeBg: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
      glow: 'shadow-amber-500/20 text-amber-400',
      barColor: 'bg-amber-500',
      strokeColor: '#f59e0b',
      label: 'MEDIUM RISK (ELEVATED)',
      desc: 'Elevated thermal or electrical stress detected. Active management recommended.',
    },
    HIGH: {
      badgeBg: 'bg-rose-500/15 border-rose-500/40 text-rose-400 animate-pulse',
      glow: 'shadow-rose-500/30 text-rose-400',
      barColor: 'bg-rose-500',
      strokeColor: '#f43f5e',
      label: 'HIGH RISK (CRITICAL)',
      desc: 'Severe safety threshold excursion. Thermal derating and immediate mitigation required.',
    },
  }[risk_level] || {
    badgeBg: 'bg-slate-500/10 border-slate-500/30 text-slate-400',
    glow: 'text-slate-400',
    barColor: 'bg-slate-500',
    strokeColor: '#64748b',
    label: 'UNKNOWN',
    desc: '',
  };

  // Circular gauge calculations
  const radius = 68;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (overall_risk_score / 100) * circumference * 0.75;

  return (
    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
      {/* Background radial highlight */}
      <div className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${tierConfig.barColor}`} />

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-slate-800/80 text-cyan-400 border border-slate-700/50">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-wide">Multi-Factor Risk Engine</h3>
            <p className="text-xs text-slate-400">Real-Time AI Safety & Thermal Assessment</p>
          </div>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${tierConfig.badgeBg}`}>
          {tierConfig.label}
        </span>
      </div>

      {/* Main Gauge + Core Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center py-5">
        {/* Circular Gauge */}
        <div className="md:col-span-5 flex flex-col items-center justify-center">
          <div className="relative w-40 h-40 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-135" viewBox="0 0 160 160">
              {/* Background Arc */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke="#1e293b"
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * 0.25}
                strokeLinecap="round"
              />
              {/* Foreground Animated Value Arc */}
              <circle
                cx="80"
                cy="80"
                r={radius}
                stroke={tierConfig.strokeColor}
                strokeWidth="12"
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-4xl font-black tracking-tight text-white font-mono">
                {overall_risk_score}
              </span>
              <span className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                Risk Index / 100
              </span>
            </div>
          </div>
          <p className="text-xs text-center text-slate-400 mt-2 max-w-xs">{tierConfig.desc}</p>
        </div>

        {/* Sub-factor Breakdown Progress Bars */}
        <div className="md:col-span-7 space-y-3.5">
          {/* Thermal Risk */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Thermal Stress ({risk_factors.thermal_status})
              </span>
              <span className="font-mono text-slate-200 font-semibold">{risk_factors.thermal_risk_score}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  risk_factors.thermal_risk_score > 65 ? 'bg-rose-500' : risk_factors.thermal_risk_score > 35 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${risk_factors.thermal_risk_score}%` }}
              />
            </div>
          </div>

          {/* C-Rate Stress */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <Zap className="w-3.5 h-3.5 text-cyan-400" />
                C-Rate & Overcurrent ({risk_factors.crate_status})
              </span>
              <span className="font-mono text-slate-200 font-semibold">{risk_factors.crate_stress_score}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  risk_factors.crate_stress_score > 65 ? 'bg-rose-500' : risk_factors.crate_stress_score > 35 ? 'bg-amber-500' : 'bg-cyan-500'
                }`}
                style={{ width: `${risk_factors.crate_stress_score}%` }}
              />
            </div>
          </div>

          {/* Battery State of Health (SOH) */}
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="flex items-center gap-1.5 text-slate-300 font-medium">
                <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" />
                State of Health (SOH)
              </span>
              <span className="font-mono text-emerald-400 font-semibold">{risk_factors.soh_percentage}%</span>
            </div>
            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                style={{ width: `${risk_factors.soh_percentage}%` }}
              />
            </div>
          </div>

          {/* Voltage Stability Tag */}
          <div className="pt-1 flex items-center justify-between text-xs">
            <span className="text-slate-400">Voltage Stability:</span>
            <span className={`px-2 py-0.5 rounded font-mono text-[11px] ${
              risk_factors.voltage_stability === 'STABLE'
                ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40'
                : 'bg-rose-950/60 text-rose-400 border border-rose-800/40'
            }`}>
              {risk_factors.voltage_stability}
            </span>
          </div>
        </div>
      </div>

      {/* Actionable Safety Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-800/80">
          <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            BMS Safety Mitigation Directives
          </h4>
          <ul className="space-y-1.5">
            {recommendations.map((rec, idx) => (
              <li key={idx} className="text-xs text-slate-300 flex items-start gap-2 bg-slate-800/40 border border-slate-800 rounded-lg p-2">
                <span className="text-cyan-400 font-bold mt-0.5">&bull;</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

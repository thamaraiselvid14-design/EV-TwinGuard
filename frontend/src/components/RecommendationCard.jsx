import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';

export default function RecommendationCard({ riskAssessment, loading }) {
  if (loading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl min-h-[220px] flex flex-col justify-center items-center">
        <div className="w-10 h-10 border-3 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-400 font-mono">Generating AI Safety Recommendations...</p>
      </div>
    );
  }

  const riskLevel = riskAssessment?.risk_level || riskAssessment?.level || 'LOW';
  const isHigh = riskLevel === 'HIGH';
  const isMed = riskLevel === 'MEDIUM';
  const isLow = !isHigh && !isMed;

  // Backend recommendations if available
  const backendRecommendations = riskAssessment?.recommendations || [];
  const backendMitigation = riskAssessment?.recommended_mitigation;

  // Standard recommended actions based on specification
  let headline = 'Battery condition is within the normal operating range.';
  let defaultActions = [
    'Continue normal operation and monitoring.',
    'Maintain standard charging profile within nominal C-rate.',
  ];

  if (isHigh) {
    headline = 'Immediate safety action is recommended.';
    defaultActions = [
      'Stop or reduce charging immediately.',
      'Enable cooling / thermal protection circuitry.',
      'Avoid continued high-current charging.',
      'Inspect the battery before further operation.',
    ];
  } else if (isMed) {
    headline = 'Battery requires attention.';
    defaultActions = [
      'Reduce charging current if possible.',
      'Monitor battery temperature closely during charging cycle.',
      'Avoid prolonged high-SOC charging (>80%).',
    ];
  }

  // Combine backend mitigation if present
  const actionItems = backendRecommendations.length > 0
    ? backendRecommendations
    : defaultActions;

  const cardBorder = isHigh
    ? 'border-rose-500/50 bg-rose-950/20 shadow-rose-950/40'
    : isMed
      ? 'border-amber-500/50 bg-amber-950/20 shadow-amber-950/40'
      : 'border-emerald-500/40 bg-emerald-950/15 shadow-emerald-950/30';

  const badgeStyles = isHigh
    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
    : isMed
      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

  return (
    <div className={`border ${cardBorder} rounded-2xl p-6 shadow-xl backdrop-blur-xl relative overflow-hidden transition-all duration-300`}>
      {/* Background glow */}
      <div
        className={`absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl pointer-events-none ${isHigh ? 'bg-rose-500/15' : isMed ? 'bg-amber-500/15' : 'bg-emerald-500/10'
          }`}
      />

      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
        <div className="flex items-center space-x-3">
          <div
            className={`p-2.5 rounded-xl border ${isHigh
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : isMed
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              }`}
          >
            {isHigh ? (
              <Flame className="w-5 h-5 animate-pulse" />
            ) : isMed ? (
              <AlertTriangle className="w-5 h-5" />
            ) : (
              <ShieldCheck className="w-5 h-5" />
            )}
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-wide uppercase">
              Recommendation
            </h3>
            <p className="text-xs text-slate-400">
              Prescriptive guidance based on Scikit-Learn AI thermal &amp; risk evaluation
            </p>
          </div>
        </div>

        <span className={`px-3 py-1 rounded-lg text-xs font-bold font-mono uppercase border ${badgeStyles}`}>
          {riskLevel} RISK ADVISORY
        </span>
      </div>

      {/* Headline Statement */}
      <div className="mb-4">
        <p className="text-sm sm:text-base font-semibold text-white tracking-wide">
          {headline}
        </p>
        {backendMitigation && (
          <p className="text-xs text-slate-300 mt-1 font-mono italic">
            &ldquo;{backendMitigation}&rdquo;
          </p>
        )}
      </div>

      {/* Recommended Action Bullet List */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5 font-mono flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          Recommended Actions:
        </h4>
        <ul className="space-y-2">
          {actionItems.map((action, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 bg-slate-900/60 border border-slate-800/80 rounded-xl px-3.5 py-2.5"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${isHigh ? 'bg-rose-400' : isMed ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
              />
              <span className="leading-relaxed">{action}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

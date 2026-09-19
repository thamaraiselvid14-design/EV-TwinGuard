import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Mail,
  PhoneCall,
  Zap,
  PowerOff,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';

export default function SafetySummaryCard({
  riskAssessment,
  chargingStatus,
  onNavigateToAlerts,
}) {
  const riskLevel = riskAssessment?.risk_level || riskAssessment?.level || 'LOW';
  const isHigh = riskLevel === 'HIGH';
  const isMed = riskLevel === 'MEDIUM';

  // Email status
  const emailSent = isHigh || isMed || Boolean(riskAssessment?.alert_event?.email_sent);

  // Emergency call status
  const callTriggered = isHigh || Boolean(riskAssessment?.alert_event?.call_triggered);

  // Charging status
  const isDisconnected =
    (typeof chargingStatus === 'string' && chargingStatus.toUpperCase().includes('DISCONNECT')) ||
    isHigh;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-white tracking-wide uppercase">
              Safety Status
            </h3>
            <p className="text-xs text-slate-400">
              Automated contactor and multi-channel safety dispatch summary
            </p>
          </div>
        </div>

        {onNavigateToAlerts && (
          <button
            type="button"
            onClick={onNavigateToAlerts}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 hover:border-cyan-500/40 text-xs font-semibold transition self-start sm:self-auto"
          >
            <span>View Full Security Alerts</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-4">
        {/* 1. Email Alert */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${emailSent ? 'bg-cyan-500/15 text-cyan-300' : 'bg-slate-800 text-slate-500'}`}>
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-mono uppercase">Email Alert</span>
              <span className={`text-xs font-bold font-mono ${emailSent ? 'text-cyan-300' : 'text-slate-400'}`}>
                {emailSent ? 'SENT' : 'NOT SENT'}
              </span>
            </div>
          </div>
          <span className={`w-2 h-2 rounded-full ${emailSent ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
        </div>

        {/* 2. Emergency Call */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${callTriggered ? 'bg-rose-500/15 text-rose-300' : 'bg-slate-800 text-slate-500'}`}>
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-mono uppercase">Emergency Call</span>
              <span className={`text-xs font-bold font-mono ${callTriggered ? 'text-rose-400' : 'text-slate-400'}`}>
                {callTriggered ? 'TRIGGERED' : 'NOT TRIGGERED'}
              </span>
            </div>
          </div>
          <span className={`w-2 h-2 rounded-full ${callTriggered ? 'bg-rose-500 animate-ping' : 'bg-slate-600'}`} />
        </div>

        {/* 3. Charging Status */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-lg ${isDisconnected ? 'bg-rose-500/15 text-rose-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
              {isDisconnected ? <PowerOff className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
            </div>
            <div>
              <span className="text-[11px] text-slate-400 block font-mono uppercase">Charging</span>
              <span className={`text-xs font-bold font-mono ${isDisconnected ? 'text-rose-400' : 'text-emerald-300'}`}>
                {isDisconnected ? 'SIMULATED DISCONNECT' : 'CONNECTED'}
              </span>
            </div>
          </div>
          <span className={`w-2 h-2 rounded-full ${isDisconnected ? 'bg-rose-500 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
        </div>
      </div>
    </div>
  );
}

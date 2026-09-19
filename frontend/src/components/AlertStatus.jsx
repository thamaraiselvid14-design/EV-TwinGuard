import React from 'react';
import {
  Bell,
  Mail,
  PhoneCall,
  PowerOff,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Radio,
  ShieldAlert,
  Info,
  ExternalLink
} from 'lucide-react';

export default function AlertStatus({
  riskAssessment,
  loading,
  error,
}) {
  if (loading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl relative overflow-hidden flex flex-col justify-center items-center min-h-[220px]">
        <div className="w-10 h-10 border-3 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-3" />
        <span className="text-xs text-slate-400">Syncing safety alert status...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900/80 border border-rose-900/40 rounded-2xl p-6 shadow-xl backdrop-blur-xl relative min-h-[220px] flex flex-col justify-center items-center text-center">
        <AlertTriangle className="w-8 h-8 text-rose-400 mb-2" />
        <h3 className="text-sm font-semibold text-rose-300">Alert Status Unavailable</h3>
        <p className="text-xs text-slate-400 mt-1">{error}</p>
      </div>
    );
  }

  const alertEvent = riskAssessment?.alert_event;
  const riskLevel = riskAssessment?.risk_level || riskAssessment?.level || 'LOW';
  const isHigh = riskLevel === 'HIGH';
  const isMed = riskLevel === 'MEDIUM';

  // Email status
  const emailSent = alertEvent?.email_dispatched ?? (isMed || isHigh);
  const emailStatusText = emailSent ? 'SENT' : 'NOT SENT';

  // Phone Call status
  const callTriggered = alertEvent?.call_triggered ?? isHigh;
  const callStatusText = callTriggered ? 'TRIGGERED' : 'NOT TRIGGERED';

  // Charging Action
  const rawChargingStatus =
    riskAssessment?.charging_status || alertEvent?.charging_status || (isHigh ? 'SIMULATED DISCONNECT' : 'CONNECTED');
  const chargingStatus = typeof rawChargingStatus === 'string' ? rawChargingStatus : 'CONNECTED';
  const isDisconnected = chargingStatus.toUpperCase().includes('DISCONNECT');

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-xl relative overflow-hidden flex flex-col justify-between">
      {/* Background glow */}
      <div
        className={`absolute top-0 right-0 -mr-10 -mt-10 w-40 h-40 rounded-full blur-3xl pointer-events-none ${
          isDisconnected ? 'bg-rose-500/10' : 'bg-cyan-500/10'
        }`}
      />

      <div>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-cyan-500/10 rounded-xl border border-indigo-500/30 text-indigo-400 shadow-sm">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Alert Status</h2>
              <p className="text-xs text-slate-400">Automated multi-channel emergency dispatch</p>
            </div>
          </div>

          <span
            className={`px-2.5 py-1 rounded-md text-xs font-bold font-mono uppercase border ${
              isDisconnected
                ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                : emailSent
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {isDisconnected ? 'PROTECTION TRIPPED' : emailSent ? 'ELEVATED MONITORING' : 'ALL SYSTEMS NOMINAL'}
          </span>
        </div>

        {/* 3 Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-5">
          {/* 1. Email Alert */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-cyan-400" /> Email Report
              </span>
              <span className="text-[10px] text-slate-500 font-mono">SMTP</span>
            </div>
            <div className="flex items-center gap-2">
              {emailSent ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-slate-500 shrink-0" />
              )}
              <span
                className={`text-sm font-bold font-mono tracking-wide ${
                  emailSent ? 'text-emerald-300' : 'text-slate-400'
                }`}
              >
                {emailStatusText}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-2">
              {emailSent ? 'Full technical analysis dispatched' : 'No notification threshold reached'}
            </span>
          </div>

          {/* 2. Emergency Call */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-3.5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <PhoneCall className="w-4 h-4 text-purple-400" /> Emergency Call
              </span>
              <span className="text-[10px] text-slate-500 font-mono">Twilio / Mock</span>
            </div>
            <div className="flex items-center gap-2">
              {callTriggered ? (
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
              ) : (
                <XCircle className="w-5 h-5 text-slate-500 shrink-0" />
              )}
              <span
                className={`text-sm font-bold font-mono tracking-wide ${
                  callTriggered ? 'text-rose-400' : 'text-slate-400'
                }`}
              >
                {callStatusText}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-2">
              {callTriggered ? 'Voice call alert triggered' : 'Requires HIGH risk (>70/100)'}
            </span>
          </div>

          {/* 3. Charging Action */}
          <div
            className={`border rounded-xl p-3.5 flex flex-col justify-between transition-all ${
              isDisconnected
                ? 'bg-rose-950/20 border-rose-500/40'
                : 'bg-slate-800/50 border-slate-700/60'
            }`}
          >
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <PowerOff className={`w-4 h-4 ${isDisconnected ? 'text-rose-400' : 'text-emerald-400'}`} />
                Charging Action
              </span>
              <span className="text-[10px] text-slate-500 font-mono">BMS Contactor</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`text-sm font-bold font-mono tracking-wide ${
                  isDisconnected ? 'text-rose-400 flex items-center gap-1.5' : 'text-emerald-300'
                }`}
              >
                {isDisconnected ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                    SIMULATED DISCONNECT
                  </>
                ) : (
                  'CONNECTED'
                )}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 mt-2">
              {isDisconnected
                ? 'Hardware safety cutout active'
                : 'Pack energized & actively receiving charge'}
            </span>
          </div>
        </div>
      </div>

      {/* Hardware / Simulation Disclaimer Notice */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-2 text-[11px] text-slate-400 bg-slate-900/60 rounded-lg p-2.5">
        <Info className="w-4 h-4 text-cyan-400 shrink-0" />
        <span>
          <strong className="text-slate-300">Phase 4 Hardware Simulation:</strong> Automated phone calls and charging
          disconnects operate via secure digital twin simulated state flags unless live Twilio/BMS relays are bound.
        </span>
      </div>
    </div>
  );
}

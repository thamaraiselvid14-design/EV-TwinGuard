import React, { useState, useEffect } from 'react';
import AIPredictionCard from './AIPredictionCard';
import RiskFactors from './RiskFactors';
import DigitalTwinSimulator from './DigitalTwinSimulator';
import {
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Mail,
  PhoneCall,
  PowerOff,
  Clock,
  History,
  Bell,
  Zap,
  Activity,
  Database,
  Search,
  Filter,
} from 'lucide-react';

export default function SecurityAlertsPage({
  latestBatteryData,
  latestPrediction,
  latestRiskAssessment,
  latestChargingStatus,
  customerAnalyses = [],
  customerAlerts = [],
  customerProfile,
  refreshTrigger = 0,
}) {
  // Derived current status values
  const batteryId = latestBatteryData?.battery_id || customerProfile?.battery_id || 'BAT-AX-101';
  const riskScoreVal = latestRiskAssessment?.risk_score ?? latestRiskAssessment?.overall_risk_score ?? 29.2;
  const riskScore = Number(riskScoreVal).toFixed(1);
  const riskLevel = latestRiskAssessment?.risk_level || (riskScoreVal >= 70 ? 'HIGH' : riskScoreVal >= 40 ? 'MEDIUM' : 'LOW');
  const isHigh = riskLevel === 'HIGH';
  const isMed = riskLevel === 'MEDIUM';
  const isLow = !isHigh && !isMed;

  const predictedTemp = latestPrediction?.predicted_future_temperature != null
    ? `${Number(latestPrediction.predicted_future_temperature).toFixed(1)} °C`
    : '35.9 °C';

  // Automated safety action states
  const emailSent = isHigh || isMed || Boolean(latestRiskAssessment?.alert_event?.email_sent);
  const callTriggered = isHigh || Boolean(latestRiskAssessment?.alert_event?.call_triggered);
  const isDisconnected =
    (typeof latestChargingStatus === 'string' && latestChargingStatus.toUpperCase().includes('DISCONNECT')) ||
    isHigh;

  return (
    <div className="space-y-8">
      {/* ─── Page Header ─── */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-gradient-to-br from-rose-500/20 via-amber-600/20 to-purple-600/20 rounded-2xl border border-rose-500/30 text-rose-400 shadow-md">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight uppercase">
                  Security Alerts &amp; AI Risk Sentinel
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-rose-500/10 text-rose-300 border border-rose-500/30">
                  Sentinel Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Thermal runaway surveillance, predictive telemetry analysis, and automated escalation logs
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold font-mono shadow-sm ${
              isHigh ? 'bg-rose-500/15 border-rose-500/40 text-rose-300' :
              isMed ? 'bg-amber-500/15 border-amber-500/40 text-amber-300' :
              'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
            }`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${
                isHigh ? 'bg-rose-400' : isMed ? 'bg-amber-400' : 'bg-emerald-400'
              }`} />
              <span>Sentinel: {riskLevel} RISK ({riskScore}/100)</span>
            </div>
          </div>
        </div>

        {/* 4 Key Status Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-5">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">
              Monitored Pack
            </span>
            <span className="text-sm font-bold text-cyan-300 font-mono mt-1 block truncate">
              {batteryId}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">
              Current Risk Level
            </span>
            <div className="mt-1">
              <span
                className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold font-mono uppercase border ${
                  isHigh
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                    : isMed
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {riskLevel} RISK
              </span>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">
              Risk Score
            </span>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-base font-black text-white font-mono">{riskScore}</span>
              <span className="text-xs text-slate-400 font-mono">/ 100</span>
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">
              Predicted Temp (+15m)
            </span>
            <span className="text-sm font-bold text-orange-300 font-mono mt-1 block">
              {predictedTemp}
            </span>
          </div>
        </div>
      </section>

      {/* ─── Active Alert State Banner ─── */}
      <section>
        {isLow && (
          <div className="bg-emerald-950/25 border border-emerald-500/40 rounded-2xl p-5 shadow-xl backdrop-blur-xl relative overflow-hidden flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-emerald-500/20 text-emerald-300 rounded-xl border border-emerald-500/30 shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-emerald-200 tracking-wide uppercase font-mono">
                  NOMINAL THERMAL &amp; ELECTRICAL PROFILE
                </h3>
                <p className="text-xs text-slate-300 mt-0.5">
                  Battery operating safely within normal parameters. AI model predicts stable temperature progression.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-mono">
              ALL NOMINAL
            </span>
          </div>
        )}

        {isMed && (
          <div className="bg-amber-950/30 border border-amber-500/50 rounded-2xl p-5 shadow-xl backdrop-blur-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-amber-900/60">
              <div className="flex items-center space-x-3.5">
                <div className="p-2.5 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/40 shrink-0">
                  <AlertTriangle className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-amber-300 tracking-wide uppercase font-mono">
                    MEDIUM RISK ELEVATION DETECTED
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Temperature accumulation trending above optimal threshold. Automated safety alert email dispatched.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono text-amber-300 font-bold px-3 py-1 bg-amber-500/20 rounded-lg border border-amber-500/30">
                Risk Score: {riskScore} / 100
              </span>
            </div>
          </div>
        )}

        {isHigh && (
          <div className="bg-rose-950/40 border-2 border-rose-500 rounded-2xl p-5 shadow-2xl backdrop-blur-xl animate-pulse">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-rose-900/60">
              <div className="flex items-center space-x-3.5">
                <div className="p-2.5 bg-rose-500/30 text-rose-300 rounded-xl border border-rose-500/50 shrink-0">
                  <Flame className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-rose-300 tracking-wide uppercase font-mono flex items-center gap-2">
                    <span>HIGH RISK EXCURSION — CRITICAL ALERT</span>
                    <span className="text-[10px] bg-rose-600 text-white px-2 py-0.5 rounded font-extrabold">EMERGENCY</span>
                  </h3>
                  <p className="text-xs text-rose-200 mt-0.5">
                    Critical thermal threshold exceeded. 1-minute escalation protocol initiated.
                  </p>
                </div>
              </div>
              <span className="text-xs font-mono text-rose-200 font-black px-3 py-1 bg-rose-600/30 rounded-lg border border-rose-500/50">
                Risk Score: {riskScore} / 100
              </span>
            </div>
          </div>
        )}
      </section>

      {/* ─── PART 1: AI PREDICTION & MULTI-FACTOR RISK ASSESSMENT (Screenshot 1) ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <AIPredictionCard
          prediction={latestPrediction}
          riskAssessment={latestRiskAssessment}
          batteryData={latestBatteryData}
          loading={false}
          error={null}
        />

        <RiskFactors
          riskAssessment={latestRiskAssessment}
          loading={false}
          error={null}
        />
      </section>

      {/* ─── TIME SERIES SIMULATION DASHBOARD (Parametric Physics Engine & Charts) ─── */}
      <section>
        <DigitalTwinSimulator initialBatteryData={latestBatteryData} />
      </section>

      {/* ─── Automated Safety Actions ─── */}
      <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-xl">
        <div className="pb-3 border-b border-slate-800 mb-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            Automated Escalation &amp; Protection Channels
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time protective workflows executed automatically by EV TwinGuard safety engine
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-cyan-400" /> Email Alert
              </span>
              <span className={`w-2 h-2 rounded-full ${emailSent ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`} />
            </div>
            <span className={`text-xs font-bold font-mono block mt-2 ${emailSent ? 'text-cyan-300' : 'text-slate-400'}`}>
              {emailSent ? 'SENT / DISPATCHED' : 'STANDBY'}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-rose-400" /> Emergency Call
              </span>
              <span className={`w-2 h-2 rounded-full ${callTriggered ? 'bg-rose-500 animate-ping' : 'bg-slate-600'}`} />
            </div>
            <span className={`text-xs font-bold font-mono block mt-2 ${callTriggered ? 'text-rose-400' : 'text-slate-400'}`}>
              {callTriggered ? 'TRIGGERED (HIGH)' : 'STANDBY'}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                {isDisconnected ? <PowerOff className="w-3.5 h-3.5 text-rose-400" /> : <Zap className="w-3.5 h-3.5 text-emerald-400" />}
                Charging Relay
              </span>
              <span className={`w-2 h-2 rounded-full ${isDisconnected ? 'bg-rose-500 animate-ping' : 'bg-emerald-400 animate-pulse'}`} />
            </div>
            <span className={`text-xs font-bold font-mono block mt-2 ${isDisconnected ? 'text-rose-400' : 'text-emerald-300'}`}>
              {isDisconnected ? 'DISCONNECTED' : 'CONNECTED'}
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-indigo-400" /> Audit Log
              </span>
              <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            </div>
            <span className="text-xs font-bold font-mono text-indigo-300 block mt-2">
              LOGGED TO DB
            </span>
          </div>
        </div>
      </section>

      {/* ─── PART 2: YOUR BATTERY ANALYSES & YOUR SAFETY ALERTS (Screenshot 2) ─── */}
      <section className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Card: Your Battery Analyses */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Your Battery Analyses</h3>
              </div>
              <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                {customerAnalyses.length} Records
              </span>
            </div>

            <div className="overflow-x-auto max-h-64 scrollbar-thin scrollbar-thumb-slate-800">
              {customerAnalyses.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No battery analyses recorded yet.</p>
              ) : (
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                      <th className="pb-2">Time</th>
                      <th className="pb-2">Temp</th>
                      <th className="pb-2">Pred Temp</th>
                      <th className="pb-2">Risk</th>
                      <th className="pb-2">Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {customerAnalyses.slice(0, 10).map((row) => {
                      const rawTemp = row.temperature ?? row.battery_temperature ?? row.current_temperature ?? 35.0;
                      const tempDisplay = isNaN(Number(rawTemp)) ? '35.0' : Number(rawTemp).toFixed(1);
                      const predTempDisplay = isNaN(Number(row.predicted_temperature)) ? '35.9' : Number(row.predicted_temperature).toFixed(1);
                      const riskDisplay = isNaN(Number(row.risk_value)) ? '29.2' : Number(row.risk_value).toFixed(1);
                      const timeDisplay = row.created_at ? new Date(row.created_at).toLocaleTimeString() : '—';
                      return (
                        <tr key={row.id}>
                          <td className="py-2 text-slate-400">{timeDisplay}</td>
                          <td className="py-2 text-slate-200">{tempDisplay}°C</td>
                          <td className="py-2 text-orange-300 font-semibold">{predTempDisplay}°C</td>
                          <td className="py-2 text-white font-bold">{riskDisplay}</td>
                          <td className="py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              row.risk_level === 'HIGH' ? 'bg-rose-500/20 text-rose-300' :
                              row.risk_level === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300' :
                              'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {row.risk_level || 'LOW'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Right Card: Your Safety Alerts */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-rose-400" />
                <h3 className="text-sm font-bold text-white">Your Safety Alerts</h3>
              </div>
              <span className="text-[11px] font-mono text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full">
                {customerAlerts.length} Alerts
              </span>
            </div>

            <div className="overflow-x-auto max-h-64 scrollbar-thin scrollbar-thumb-slate-800">
              {customerAlerts.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No safety alerts recorded.</p>
              ) : (
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                      <th className="pb-2">Time</th>
                      <th className="pb-2">Level</th>
                      <th className="pb-2">Status</th>
                      <th className="pb-2">Channels</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {customerAlerts.slice(0, 10).map((alert) => {
                      const timeDisplay = alert.created_at || alert.timestamp ? new Date(alert.created_at || alert.timestamp).toLocaleTimeString() : '—';
                      return (
                        <tr key={alert.id}>
                          <td className="py-2 text-slate-400">{timeDisplay}</td>
                          <td className="py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                              alert.risk_level === 'HIGH' ? 'bg-rose-500/20 text-rose-300' :
                              alert.risk_level === 'MEDIUM' ? 'bg-amber-500/20 text-amber-300' :
                              'bg-emerald-500/20 text-emerald-300'
                            }`}>
                              {alert.risk_level}
                            </span>
                          </td>
                          <td className="py-2 font-bold">
                            <span className={
                              alert.status === 'ACKNOWLEDGED' ? 'text-emerald-400' :
                              alert.status === 'ESCALATED' ? 'text-rose-400' : 'text-amber-400'
                            }>
                              {alert.status}
                            </span>
                          </td>
                          <td className="py-2 text-slate-300 text-[11px]">
                            {alert.call_triggered ? 'Call + SMS + Email' : alert.email_sent ? 'Email Only' : 'Dashboard'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

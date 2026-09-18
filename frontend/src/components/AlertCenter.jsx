import React, { useState, useEffect } from 'react';
import { getAlerts, acknowledgeAlert, simulateAlert } from '../services/api';
import { 
  Bell, 
  AlertTriangle, 
  ShieldAlert, 
  Info, 
  CheckCircle2, 
  Send, 
  RefreshCw, 
  Mail, 
  MessageSquare,
  Shield
} from 'lucide-react';

export default function AlertCenter() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchResult, setDispatchResult] = useState(null);

  const [simForm, setSimForm] = useState({
    battery_id: 'EV-PACK-99',
    severity: 'CRITICAL',
    title: 'Rapid Cell Thermal Excursion (>58°C)',
    message: 'High C-rate charging triggered sudden temperature spike on Module 4. Chiller loop at max capacity.',
  });

  const fetchAlertsList = async () => {
    setLoading(true);
    try {
      const data = await getAlerts(50);
      setAlerts(data);
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcknowledge = async (id) => {
    try {
      await acknowledgeAlert(id);
      setAlerts((prev) =>
        prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a))
      );
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  const handleTriggerSimAlert = async (e) => {
    e.preventDefault();
    try {
      const res = await simulateAlert({
        battery_id: simForm.battery_id,
        severity: simForm.severity,
        title: simForm.title,
        message: simForm.message,
        metrics_summary: { battery_temperature: 58.4, soc: 86.0, charging_current: 72.0 },
      });
      setDispatchResult(res);
      fetchAlertsList();
    } catch (err) {
      console.error('Failed to simulate alert dispatch:', err);
    }
  };

  useEffect(() => {
    fetchAlertsList();
  }, []);

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'ALL') return true;
    return a.severity === filter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-950/50 border border-rose-800/50 text-rose-400 text-xs font-semibold mb-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              Phase 4: Safety Alerts & Automated Dispatch
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Safety Alerts & Incident Center
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Live monitoring stream for thermal excursions, overcurrent triggers, and automated notification dispatches.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                setDispatchResult(null);
                setDispatchModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-500/20 transition-all duration-200"
            >
              <Send className="w-3.5 h-3.5" />
              Simulate Alert Dispatch
            </button>
            <button
              onClick={fetchAlertsList}
              disabled={loading}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
              title="Refresh alerts"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex items-center gap-2 mt-6 pt-5 border-t border-slate-800">
          <span className="text-xs text-slate-400 mr-2 font-medium">Filter Severity:</span>
          {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map((sev) => (
            <button
              key={sev}
              onClick={() => setFilter(sev)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                filter === sev
                  ? 'bg-slate-700 text-white border border-slate-600'
                  : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Alerts Feed */}
      <div className="space-y-3">
        {filteredAlerts.length === 0 ? (
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-10 text-center text-slate-400">
            <Shield className="w-8 h-8 mx-auto text-emerald-400 mb-2 opacity-80" />
            <p className="text-sm font-medium">No alerts matching filter &bull; All monitored packs nominal.</p>
          </div>
        ) : (
          filteredAlerts.map((alert) => {
            const isCrit = alert.severity === 'CRITICAL';
            const isWarn = alert.severity === 'WARNING';
            const borderCls = isCrit
              ? 'border-rose-500/40 bg-rose-950/20'
              : isWarn
              ? 'border-amber-500/30 bg-amber-950/15'
              : 'border-cyan-500/30 bg-cyan-950/15';

            return (
              <div
                key={alert.id}
                className={`border rounded-2xl p-5 backdrop-blur-xl transition-all ${borderCls} ${
                  alert.acknowledged ? 'opacity-60' : 'shadow-xl'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                        isCrit
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                          : isWarn
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      }`}>
                        {alert.severity}
                      </span>
                      <span className="font-mono text-xs text-white font-bold">{alert.battery_id}</span>
                      <span className="text-[11px] text-slate-400">&bull; {new Date(alert.timestamp).toLocaleTimeString()}</span>
                      {alert.acknowledged && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                          <CheckCircle2 className="w-3 h-3" /> Acknowledged
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-white tracking-wide">{alert.title}</h4>
                    <p className="text-xs text-slate-300">{alert.message}</p>

                    {/* Dispatched Channels */}
                    {alert.dispatched_channels && alert.dispatched_channels.length > 0 && (
                      <div className="pt-2 flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-slate-400 uppercase font-semibold">Broadcast:</span>
                        {alert.dispatched_channels.map((chan, idx) => (
                          <span key={idx} className="text-[11px] px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60">
                            {chan}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {!alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="self-start sm:self-center px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Simulation Modal */}
      {dispatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
              <Send className="w-4 h-4 text-rose-400" />
              Simulate Emergency Alert Dispatch
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Test automated notification dispatches across email and SMS broadcast channels.
            </p>

            <form onSubmit={handleTriggerSimAlert} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Target Battery Pack ID</label>
                <input
                  type="text"
                  value={simForm.battery_id}
                  onChange={(e) => setSimForm({ ...simForm, battery_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Severity Tier</label>
                <select
                  value={simForm.severity}
                  onChange={(e) => setSimForm({ ...simForm, severity: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="CRITICAL">CRITICAL (Emergency Chiller + SMS + Email)</option>
                  <option value="WARNING">WARNING (Elevated Derating + Email)</option>
                  <option value="INFO">INFO (Maintenance / SOH Balance)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Alert Title</label>
                <input
                  type="text"
                  value={simForm.title}
                  onChange={(e) => setSimForm({ ...simForm, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-300 mb-1">Diagnostic Message</label>
                <textarea
                  rows={2}
                  value={simForm.message}
                  onChange={(e) => setSimForm({ ...simForm, message: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              {dispatchResult && (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <CheckCircle2 className="w-4 h-4" /> Dispatched Successfully
                  </div>
                  <div className="text-slate-300">
                    <span className="text-slate-400 font-semibold">Email: </span>
                    {dispatchResult.dispatch_preview?.email_subject}
                  </div>
                  <div className="text-slate-300">
                    <span className="text-slate-400 font-semibold">SMS Body: </span>
                    {dispatchResult.dispatch_preview?.sms_body}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDispatchModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white text-xs font-bold shadow-lg"
                >
                  Dispatch Test Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

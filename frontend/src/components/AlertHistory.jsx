import React, { useState, useEffect } from 'react';
import { getAlertHistory } from '../services/api';
import {
  History,
  RotateCw,
  AlertTriangle,
  Flame,
  CheckCircle2,
  Mail,
  PhoneCall,
  PowerOff,
  Clock,
  ShieldCheck,
  Search,
  ChevronRight
} from 'lucide-react';

export default function AlertHistory({ refreshTrigger }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [filterQuery, setFilterQuery] = useState('');

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAlertHistory(50);
      setHistory(Array.isArray(data) ? data : []);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Failed to load alert history:', err);
      setError(err.message || 'Unable to connect to EV TwinGuard backend to fetch alert history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [refreshTrigger]);

  const filteredHistory = history.filter((item) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      item.battery_id?.toLowerCase().includes(q) ||
      item.risk_level?.toLowerCase().includes(q) ||
      item.alert_type?.toLowerCase().includes(q) ||
      item.charging_status?.toLowerCase().includes(q)
    );
  });

  const formatTimestamp = (ts) => {
    if (!ts) return '—';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return ts;
    }
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-xl relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-0 right-10 -mt-10 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-indigo-500/10 rounded-xl border border-purple-500/30 text-purple-400 shadow-sm">
            <History className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white tracking-wide">Alert History</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 font-mono">
                SQLite Log: alert_events
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Auditable security and thermal threshold excursion logs
            </p>
          </div>
        </div>

        {/* Controls: Search, Refresh Button, Timestamp */}
        <div className="flex items-center flex-wrap gap-3">
          {/* Quick Filter */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Filter events..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="bg-slate-800/80 border border-slate-700 text-xs text-white rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-cyan-400 w-36 sm:w-44"
            />
          </div>

          {lastUpdated && (
            <span className="text-xs text-slate-400 font-mono hidden md:inline">
              Last updated: <span className="text-slate-200">{lastUpdated}</span>
            </span>
          )}

          <button
            type="button"
            onClick={fetchHistory}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="mt-4">
        {loading && history.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-3" />
            <p className="text-xs text-slate-400">Loading alert history from SQLite...</p>
          </div>
        ) : error ? (
          <div className="py-8 px-4 bg-rose-950/20 border border-rose-900/40 rounded-xl text-center">
            <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto mb-2" />
            <p className="text-xs text-rose-300 font-medium">{error}</p>
            <button
              onClick={fetchHistory}
              className="mt-3 px-3 py-1 bg-rose-900/40 hover:bg-rose-900/60 text-rose-200 text-xs rounded-lg border border-rose-800 transition-all"
            >
              Retry Connection
            </button>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="py-10 text-center text-slate-500">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-xs font-medium">No alert events recorded matching criteria.</p>
            <p className="text-[11px] text-slate-600 mt-0.5">High or Medium risk battery evaluations will appear here.</p>
          </div>
        ) : (
          /* Responsive Table with Horizontal Scrolling */
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-800/70 text-slate-400 font-semibold border-b border-slate-700/80">
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Battery ID</th>
                  <th className="py-3 px-4">Predicted Temp</th>
                  <th className="py-3 px-4">Risk Score</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Alert Type</th>
                  <th className="py-3 px-4">Charging Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300 font-mono">
                {filteredHistory.map((item, idx) => {
                  const isHigh = item.risk_level === 'HIGH';
                  const isMed = item.risk_level === 'MEDIUM';
                  const isDisconnect = item.charging_status?.toUpperCase().includes('DISCONNECT');

                  const riskBadgeStyles = isHigh
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                    : isMed
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';

                  const chargingBadgeStyles = isDisconnect
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 font-bold'
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

                  return (
                    <tr
                      key={item.id || idx}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      {/* Time */}
                      <td className="py-3 px-4 text-slate-400 font-sans whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{formatTimestamp(item.timestamp)}</span>
                        </div>
                      </td>

                      {/* Battery ID */}
                      <td className="py-3 px-4 font-bold text-white whitespace-nowrap">
                        {item.battery_id}
                      </td>

                      {/* Predicted Temp */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="font-semibold text-slate-200">
                          {typeof item.predicted_temperature === 'number'
                            ? item.predicted_temperature.toFixed(1)
                            : item.predicted_temperature}
                          °C
                        </span>
                      </td>

                      {/* Risk Score */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`font-bold ${
                            isHigh ? 'text-rose-400' : isMed ? 'text-amber-400' : 'text-emerald-400'
                          }`}
                        >
                          {typeof item.risk_score === 'number'
                            ? item.risk_score.toFixed(1)
                            : item.risk_score}
                          <span className="text-[10px] text-slate-500 font-normal"> / 100</span>
                        </span>
                      </td>

                      {/* Risk Level Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md border text-[11px] font-bold ${riskBadgeStyles}`}
                        >
                          {isHigh ? (
                            <Flame className="w-3 h-3 text-rose-400" />
                          ) : isMed ? (
                            <AlertTriangle className="w-3 h-3 text-amber-400" />
                          ) : (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          )}
                          {item.risk_level}
                        </span>
                      </td>

                      {/* Alert Type */}
                      <td className="py-3 px-4 font-sans text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {item.alert_type === 'EMERGENCY_DISPATCH_AND_CALL' ? (
                            <span className="inline-flex items-center gap-1 text-rose-300 font-semibold">
                              <PhoneCall className="w-3 h-3 text-rose-400" />
                              EMAIL + CALL
                            </span>
                          ) : item.alert_type === 'EMAIL_REPORT' ? (
                            <span className="inline-flex items-center gap-1 text-amber-300 font-medium">
                              <Mail className="w-3 h-3 text-amber-400" />
                              EMAIL REPORT
                            </span>
                          ) : (
                            <span className="text-slate-500">STANDARD LOG</span>
                          )}
                        </div>
                      </td>

                      {/* Charging Status */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] ${chargingBadgeStyles}`}
                        >
                          {isDisconnect ? (
                            <>
                              <PowerOff className="w-3 h-3 text-rose-400 shrink-0" />
                              <span>SIMULATED DISCONNECT</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                              <span>CONNECTED</span>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-slate-500 gap-2">
        <span>Showing up to 50 latest SQLite alert records</span>
        <span className="font-mono text-[11px] text-slate-400">Database: backend/data/alerts.db</span>
      </div>
    </div>
  );
}

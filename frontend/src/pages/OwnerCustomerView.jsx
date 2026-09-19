import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, ArrowLeft, User, Car, Battery, AlertTriangle,
  History, Bell, CheckCircle2, AlertCircle, Thermometer, Zap
} from 'lucide-react';
import { getOwnerCustomerView } from '../services/api';

export default function OwnerCustomerView({ customerId, navigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const ownerToken = localStorage.getItem('owner_token');
  const ownerUser = JSON.parse(localStorage.getItem('owner_user') || '{}');

  useEffect(() => {
    if (!ownerToken) {
      navigate('/owner/login');
      return;
    }
    loadCustomerData();
  }, [customerId]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getOwnerCustomerView(customerId, ownerToken);
      setData(res);
    } catch (err) {
      console.error('Failed to load customer view:', err);
      setError(err.message || 'Failed to load customer details');
    } finally {
      setLoading(false);
    }
  };

  const renderRiskBadge = (level) => {
    if (!level) return <span className="text-slate-500 text-xs">—</span>;
    const l = level.toUpperCase();
    if (l === 'HIGH') {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
          HIGH RISK
        </span>
      );
    }
    if (l === 'MEDIUM') {
      return (
        <span className="px-2 py-0.5 rounded text-xs font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
          MEDIUM RISK
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
        LOW RISK
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Header with OWNER VIEW banner */}
      <div className="bg-amber-500 text-slate-950 px-6 py-2 flex items-center justify-between font-bold text-xs tracking-wider uppercase shadow-md z-50">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" />
          <span>OWNER VIEW — READ ONLY INSPECTION CONSOLE</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-semibold">
          <span>Logged in as: {ownerUser.name || 'Owner'} (OWNER)</span>
          <span className="px-2 py-0.5 bg-slate-950 text-amber-400 rounded">
            Target Customer: {data?.customer?.name || customerId}
          </span>
        </div>
      </div>

      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-3.5 flex items-center justify-between">
        <button
          onClick={() => navigate('/owner/dashboard')}
          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-2 transition-all border border-slate-700"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Owner Dashboard
        </button>

        <div className="text-right">
          <span className="text-xs text-slate-400">Viewing Customer ID: </span>
          <span className="text-xs font-mono text-amber-400 font-semibold">{customerId}</span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin mx-auto" />
            <p className="text-xs text-slate-400">Loading customer telemetry and history...</p>
          </div>
        ) : error ? (
          <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        ) : !data ? null : (
          <>
            {/* Customer Personal & Vehicle Details Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Details */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2 border-b border-slate-800/80 pb-3">
                  <User className="w-4 h-4 text-amber-400" /> Customer Personal Details
                </h2>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-0.5">Full Name</span>
                    <span className="font-semibold text-white text-sm">{data.customer.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Registered Email</span>
                    <span className="font-medium text-slate-200">{data.customer.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Mobile Number</span>
                    <span className="font-medium text-slate-200">{data.customer.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Account Role</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-semibold text-[10px]">
                      {data.customer.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Vehicle / Battery Details */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl">
                <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2 border-b border-slate-800/80 pb-3">
                  <Car className="w-4 h-4 text-blue-400" /> Vehicle & Battery Telemetry Specs
                </h2>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-0.5">Vehicle Model</span>
                    <span className="font-semibold text-white text-sm">{data.customer.vehicle_model}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Assigned Battery ID</span>
                    <span className="font-mono text-emerald-400 text-sm font-bold">{data.customer.battery_id}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Registration Date</span>
                    <span className="text-slate-400">
                      {data.customer.created_at ? data.customer.created_at.slice(0, 10) : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-0.5">Total Analyses Recorded</span>
                    <span className="font-bold text-cyan-400 text-sm">{data.analyses.length}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Latest AI Prediction Summary */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2 border-b border-slate-800/80 pb-3">
                <Thermometer className="w-4 h-4 text-rose-400" /> Latest AI Battery Health & Risk Evaluation
              </h2>

              {data.latest_analysis ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 block mb-1">Predicted Temperature</span>
                    <span className="text-xl font-bold text-white">
                      {Number(data.latest_analysis.predicted_temperature).toFixed(1)} °C
                    </span>
                  </div>
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 block mb-1">Risk Value (0–100)</span>
                    <span className="text-xl font-bold text-amber-400">
                      {Number(data.latest_analysis.risk_value).toFixed(1)}
                    </span>
                  </div>
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 block mb-1">Risk Classification</span>
                    <div className="mt-1">{renderRiskBadge(data.latest_analysis.risk_level)}</div>
                  </div>
                  <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800/80">
                    <span className="text-slate-400 block mb-1">Analysis Date</span>
                    <span className="text-xs text-slate-300 font-mono">
                      {data.latest_analysis.created_at ? data.latest_analysis.created_at.replace('T', ' ').slice(0, 19) : '—'}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 py-4 text-center">
                  No battery analyses recorded yet for this customer pack.
                </p>
              )}
            </div>

            {/* Analysis History Table */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-cyan-400" />
                  Customer Analysis History ({data.analyses.length})
                </h3>
              </div>
              {data.analyses.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">No analysis records available.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3 text-center">Temp (°C)</th>
                        <th className="px-4 py-3 text-center">Current (A)</th>
                        <th className="px-4 py-3 text-center">Voltage (V)</th>
                        <th className="px-4 py-3 text-center">SOC (%)</th>
                        <th className="px-4 py-3 text-center">Age (mo)</th>
                        <th className="px-4 py-3 text-center">Cycles</th>
                        <th className="px-4 py-3 text-center">Pred Temp</th>
                        <th className="px-4 py-3 text-center">Risk Score</th>
                        <th className="px-4 py-3 text-center">Risk Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                      {data.analyses.map((anl) => (
                        <tr key={anl.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 text-slate-400 font-sans">
                            {anl.created_at ? anl.created_at.replace('T', ' ').slice(0, 19) : '—'}
                          </td>
                          <td className="px-4 py-3 text-center text-white">{anl.temperature}</td>
                          <td className="px-4 py-3 text-center text-slate-300">{anl.current}</td>
                          <td className="px-4 py-3 text-center text-slate-300">{anl.voltage}</td>
                          <td className="px-4 py-3 text-center text-cyan-400 font-semibold">{anl.soc}%</td>
                          <td className="px-4 py-3 text-center text-slate-400">{anl.battery_age}</td>
                          <td className="px-4 py-3 text-center text-slate-400">{anl.cycles}</td>
                          <td className="px-4 py-3 text-center text-white font-bold">{Number(anl.predicted_temperature).toFixed(1)}°C</td>
                          <td className="px-4 py-3 text-center text-amber-400 font-bold">{Number(anl.risk_value).toFixed(1)}</td>
                          <td className="px-4 py-3 text-center font-sans">{renderRiskBadge(anl.risk_level)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Alert History Table */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Bell className="w-4 h-4 text-purple-400" />
                  Customer Safety Alerts & Escalations Log ({data.alerts.length})
                </h3>
              </div>
              {data.alerts.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">No alerts logged for this customer.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Timestamp</th>
                        <th className="px-4 py-3">Alert ID</th>
                        <th className="px-4 py-3 text-center">Risk Level</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-center">Email</th>
                        <th className="px-4 py-3 text-center">SMS</th>
                        <th className="px-4 py-3 text-center">Call</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {data.alerts.map((alt) => (
                        <tr key={alt.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                            {alt.timestamp ? alt.timestamp.replace('T', ' ').slice(0, 19) : '—'}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-300">{alt.id}</td>
                          <td className="px-4 py-3 text-center">{renderRiskBadge(alt.risk_level)}</td>
                          <td className="px-4 py-3 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                              {alt.status || (alt.acknowledged ? 'ACKNOWLEDGED' : 'PENDING')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center text-emerald-400 font-semibold">
                            {alt.email_sent ? 'SENT' : 'NO'}
                          </td>
                          <td className="px-4 py-3 text-center text-rose-400 font-semibold">
                            {alt.sms_sent ? 'SENT' : 'NO'}
                          </td>
                          <td className="px-4 py-3 text-center text-rose-400 font-semibold">
                            {alt.call_triggered ? 'TRIGGERED' : 'NO'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

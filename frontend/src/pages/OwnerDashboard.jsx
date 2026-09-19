import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, Users, Activity, Bell, Search, Eye, RefreshCw, LogOut,
  Car, Battery, CheckCircle2, AlertTriangle, AlertCircle, ArrowUpRight
} from 'lucide-react';
import { getOwnerDashboard, getOwnerCustomers, getOwnerAlerts } from '../services/api';

export default function OwnerDashboard({ navigate }) {
  const [activeTab, setActiveTab] = useState('customers'); // 'customers' | 'analytics' | 'alerts'
  const [metrics, setMetrics] = useState({
    total_customers: 0,
    total_analyses: 0,
    low_risk_count: 0,
    medium_risk_count: 0,
    high_risk_count: 0,
    total_alerts: 0,
  });
  const [customers, setCustomers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const ownerToken = localStorage.getItem('owner_token');
  const ownerUser = JSON.parse(localStorage.getItem('owner_user') || '{}');

  useEffect(() => {
    if (!ownerToken) {
      navigate('/owner/login');
      return;
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [metricsData, customersData, alertsData] = await Promise.all([
        getOwnerDashboard(ownerToken),
        getOwnerCustomers(ownerToken, searchQuery),
        getOwnerAlerts(ownerToken, 100),
      ]);
      setMetrics(metricsData);
      setCustomers(customersData);
      setAlerts(alertsData);
    } catch (err) {
      console.error('Failed to load owner data:', err);
      if (err.message && (err.message.includes('401') || err.message.includes('Forbidden'))) {
        localStorage.removeItem('owner_token');
        navigate('/owner/login');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    try {
      const filtered = await getOwnerCustomers(ownerToken, searchQuery);
      setCustomers(filtered);
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('owner_token');
    localStorage.removeItem('owner_user');
    navigate('/owner/login');
  };

  const renderRiskBadge = (level) => {
    if (!level) return <span className="text-slate-500 text-xs">—</span>;
    const l = level.toUpperCase();
    if (l === 'HIGH') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          HIGH
        </span>
      );
    }
    if (l === 'MEDIUM') {
      return (
        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          MEDIUM
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        LOW
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur-md sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white tracking-tight">EV TwinGuard</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold">
                OWNER DASHBOARD
              </span>
            </div>
            <p className="text-xs text-slate-400">Fleet Monitoring & Safety Management Console</p>
          </div>
        </div>

        {/* Tab Controls & User info */}
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setActiveTab('customers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                activeTab === 'customers'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Customers
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                activeTab === 'analytics'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" /> Analytics
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                activeTab === 'alerts'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bell className="w-3.5 h-3.5" /> Alerts ({metrics.total_alerts})
            </button>
          </nav>

          <div className="h-5 w-px bg-slate-800" />

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-xs font-medium text-white">{ownerUser.name || 'Fleet Owner'}</div>
              <div className="text-[10px] text-amber-400">Authenticated: OWNER</div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-700 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-6">
        {/* Real Metrics Banner */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] text-slate-400 mb-1">Total Customers</div>
            <div className="text-2xl font-bold text-white">{metrics.total_customers}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] text-slate-400 mb-1">Total Analyses</div>
            <div className="text-2xl font-bold text-cyan-400">{metrics.total_analyses}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] text-slate-400 mb-1">LOW Risk</div>
            <div className="text-2xl font-bold text-emerald-400">{metrics.low_risk_count}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] text-slate-400 mb-1">MEDIUM Risk</div>
            <div className="text-2xl font-bold text-amber-400">{metrics.medium_risk_count}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] text-slate-400 mb-1">HIGH Risk</div>
            <div className="text-2xl font-bold text-rose-400">{metrics.high_risk_count}</div>
          </div>
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <div className="text-[11px] text-slate-400 mb-1">Total Alerts</div>
            <div className="text-2xl font-bold text-purple-400">{metrics.total_alerts}</div>
          </div>
        </div>

        {/* TAB 1: CUSTOMERS */}
        {activeTab === 'customers' && (
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
              <form onSubmit={handleSearch} className="flex-1 w-full relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search customer name, email, vehicle, or battery ID..."
                  className="w-full pl-10 pr-24 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 transition-all"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold rounded-lg transition-all"
                >
                  Filter
                </button>
              </form>

              <button
                onClick={() => {
                  setRefreshing(true);
                  loadData();
                }}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium flex items-center gap-1.5 transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Customers Table */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-400" />
                  Registered Customers ({customers.length})
                </h3>
                <span className="text-xs text-slate-400">Click any customer to enter Owner Customer View</span>
              </div>

              {customers.length === 0 ? (
                <div className="p-12 text-center text-slate-500 text-sm">
                  No customers found matching search query.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="px-4 py-3">Customer Name</th>
                        <th className="px-4 py-3">Contact Email</th>
                        <th className="px-4 py-3">Mobile Number</th>
                        <th className="px-4 py-3">Vehicle Model</th>
                        <th className="px-4 py-3">Battery ID</th>
                        <th className="px-4 py-3 text-center">Analyses</th>
                        <th className="px-4 py-3 text-center">Latest Risk</th>
                        <th className="px-4 py-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {customers.map((c) => (
                        <tr key={c.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-4 py-3.5 font-medium text-white">{c.name}</td>
                          <td className="px-4 py-3.5 text-slate-300">{c.email}</td>
                          <td className="px-4 py-3.5 text-slate-400">{c.phone}</td>
                          <td className="px-4 py-3.5 text-slate-300 flex items-center gap-1.5">
                            <Car className="w-3.5 h-3.5 text-blue-400" /> {c.vehicle_model}
                          </td>
                          <td className="px-4 py-3.5 text-slate-300 font-mono">{c.battery_id}</td>
                          <td className="px-4 py-3.5 text-center font-bold text-cyan-400">
                            {c.analysis_count || 0}
                          </td>
                          <td className="px-4 py-3.5 text-center">{renderRiskBadge(c.latest_risk_level)}</td>
                          <td className="px-4 py-3.5 text-right">
                            <button
                              onClick={() => navigate(`/owner/customers/${c.id}`)}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-medium inline-flex items-center gap-1 transition-all"
                            >
                              <Eye className="w-3 h-3" /> View Page
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-400" /> Risk Distribution Statistics
              </h3>
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-emerald-400 font-medium">LOW Risk</span>
                    <span className="text-slate-400">{metrics.low_risk_count} of {metrics.total_analyses} analyses</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full"
                      style={{ width: `${metrics.total_analyses ? (metrics.low_risk_count / metrics.total_analyses) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-amber-400 font-medium">MEDIUM Risk</span>
                    <span className="text-slate-400">{metrics.medium_risk_count} of {metrics.total_analyses} analyses</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full"
                      style={{ width: `${metrics.total_analyses ? (metrics.medium_risk_count / metrics.total_analyses) * 100 : 0}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-rose-400 font-medium">HIGH Risk</span>
                    <span className="text-slate-400">{metrics.high_risk_count} of {metrics.total_analyses} analyses</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden">
                    <div
                      className="h-full bg-rose-500 rounded-full"
                      style={{ width: `${metrics.total_analyses ? (metrics.high_risk_count / metrics.total_analyses) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 space-y-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-purple-400" /> Automated Safety & Notification Architecture
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                The EV TwinGuard platform runs multi-factor safety evaluation on every analysis:
              </p>
              <ul className="text-xs text-slate-300 space-y-2 pt-1">
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5" />
                  <span><strong>LOW:</strong> Dashboard monitoring only; zero notification dispatch.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5" />
                  <span><strong>MEDIUM:</strong> Dashboard alert + Acknowledge button. <strong>Email ALWAYS sent</strong> to customer's registered email immediately.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5" />
                  <span><strong>HIGH:</strong> 60-second persistent window. If acknowledged in 1 min, email dispatched and escalation cancelled. If unacknowledged, background worker triggers Email + SMS + Twilio Call.</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        {/* TAB 3: ALERTS */}
        {activeTab === 'alerts' && (
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" />
                Fleet Safety Alerts Log ({alerts.length})
              </h3>
              <button
                onClick={loadData}
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium"
              >
                <RefreshCw className="w-3 h-3" /> Refresh Alerts
              </button>
            </div>

            {alerts.length === 0 ? (
              <div className="p-12 text-center text-slate-500 text-sm">
                No alerts recorded yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Battery ID</th>
                      <th className="px-4 py-3 text-center">Risk Level</th>
                      <th className="px-4 py-3 text-center">Score</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Email</th>
                      <th className="px-4 py-3 text-center">SMS</th>
                      <th className="px-4 py-3 text-center">Twilio Call</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {alerts.map((a) => (
                      <tr key={a.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                          {a.timestamp ? a.timestamp.replace('T', ' ').slice(0, 19) : '—'}
                        </td>
                        <td className="px-4 py-3 font-medium text-white">
                          {a.customer_name || 'Customer'}
                        </td>
                        <td className="px-4 py-3 text-slate-300 font-mono">{a.battery_id}</td>
                        <td className="px-4 py-3 text-center">{renderRiskBadge(a.risk_level)}</td>
                        <td className="px-4 py-3 text-center font-bold text-slate-200">
                          {Number(a.risk_score).toFixed(0)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                            a.status === 'ESCALATED'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : a.acknowledged
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            {a.status || (a.acknowledged ? 'ACKNOWLEDGED' : 'PENDING')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {a.email_sent ? (
                            <span className="text-emerald-400 font-semibold">SENT</span>
                          ) : (
                            <span className="text-slate-600">NO</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {a.sms_sent ? (
                            <span className="text-rose-400 font-semibold">SENT</span>
                          ) : (
                            <span className="text-slate-600">NO</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {a.call_triggered ? (
                            <span className="text-rose-400 font-semibold">TRIGGERED</span>
                          ) : (
                            <span className="text-slate-600">NO</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

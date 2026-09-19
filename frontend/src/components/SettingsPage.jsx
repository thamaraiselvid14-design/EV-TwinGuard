import React, { useState } from 'react';
import {
  User,
  Car,
  Zap,
  History,
  Bell,
  Lock,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  Flame,
  ArrowRight,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { changeCustomerPassword } from '../services/api';

export default function SettingsPage({
  customerProfile,
  customerAnalyses = [],
  customerAlerts = [],
  customerToken,
  onLogout,
  onRefreshProfile,
  currentBatteryState,
  activeTab = 'profile',
  onTabChange,
}) {
  const [currentTab, setCurrentTab] = useState(activeTab);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState({ text: '', type: '' }); // 'success' | 'error'
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Notifications preference state (stored locally)
  const [emailAlertsEnabled, setEmailAlertsEnabled] = useState(true);
  const [emergencyEscalationEnabled, setEmergencyEscalationEnabled] = useState(true);

  const handleTabClick = (tab) => {
    setCurrentTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordMsg({ text: '', type: '' });

    if (!currentPassword) {
      setPasswordMsg({ text: 'Please enter your current password.', type: 'error' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ text: 'New password must be at least 6 characters long.', type: 'error' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ text: 'New passwords do not match.', type: 'error' });
      return;
    }

    try {
      setChangingPassword(true);
      const res = await changeCustomerPassword(currentPassword, newPassword, customerToken);
      setPasswordMsg({ text: res.message || 'Password updated successfully!', type: 'success' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMsg({ text: err.message || 'Failed to update password.', type: 'error' });
    } finally {
      setChangingPassword(false);
    }
  };

  const renderRiskBadge = (level) => {
    const l = (level || '').toUpperCase();
    if (l === 'HIGH') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1 w-fit">
          <Flame className="w-3 h-3 text-rose-400" /> HIGH
        </span>
      );
    }
    if (l === 'MEDIUM') {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1 w-fit">
          <AlertTriangle className="w-3 h-3 text-amber-400" /> MEDIUM
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 w-fit">
        <ShieldCheck className="w-3 h-3 text-emerald-400" /> LOW
      </span>
    );
  };

  const navTabs = [
    { id: 'profile', label: 'Profile', icon: User, desc: 'Personal details' },
    { id: 'vehicle', label: 'Vehicle & Battery', icon: Car, desc: 'EV model & battery pack' },
    { id: 'analysis', label: 'Analysis History', icon: History, desc: `Complete history (${customerAnalyses.length})` },
    { id: 'alerts', label: 'Alert History', icon: Bell, desc: `Safety alerts (${customerAlerts.length})` },
    { id: 'notifications', label: 'Notifications', icon: Mail, desc: 'Alert preferences' },
    { id: 'account', label: 'Account', icon: Lock, desc: 'Password & session' },
  ];

  return (
    <div className="space-y-6">
      {/* Settings Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="p-3 bg-gradient-to-br from-indigo-500/20 via-cyan-600/20 to-blue-600/20 rounded-2xl border border-indigo-500/30 text-indigo-400 shadow-md">
              <User className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Customer Settings &amp; Telemetry Center
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold uppercase">
                  {customerProfile?.role || 'CUSTOMER'}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Manage personal profile, vehicle specifications, complete telemetry logs, and security credentials
              </p>
            </div>
          </div>

          <div className="text-right text-xs">
            <span className="text-slate-400 block">Logged in as:</span>
            <span className="font-semibold text-white font-mono">{customerProfile?.email}</span>
          </div>
        </div>
      </div>

      {/* Settings Layout: Left Tab Nav + Right Content Card */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Navigation Sidebar */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3 shadow-xl backdrop-blur-xl space-y-1.5">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl text-left transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/10 border border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      isActive ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold block">{tab.label}</span>
                    <span className="text-[10px] text-slate-500 block">{tab.desc}</span>
                  </div>
                </div>
                <ArrowRight className={`w-3.5 h-3.5 transition-transform ${isActive ? 'text-cyan-300 translate-x-0.5' : 'text-slate-600'}`} />
              </button>
            );
          })}

          <div className="pt-3 border-t border-slate-800/80 mt-2">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 p-3 rounded-xl text-left text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-all text-xs font-semibold"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>Sign Out of EV TwinGuard</span>
            </button>
          </div>
        </div>

        {/* Content Pane */}
        <div className="lg:col-span-3 bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl min-h-[480px]">
          {/* TAB 1: PROFILE */}
          {currentTab === 'profile' && (
            <div className="space-y-6">
              {/* User Profile Card - Exact Screenshot 1 Layout & Details */}
              <section className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-6 shadow-xl backdrop-blur-xl">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-800">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/5">
                      <User className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-white tracking-wide">
                          {customerProfile?.name || 'Registered Customer'}
                        </h2>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                          {customerProfile?.role || 'CUSTOMER'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Registered Vehicle Owner &bull; EV Digital Twin Account
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onRefreshProfile}
                      title="Sync Profile & Telemetry"
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Sync Data</span>
                    </button>
                    <button
                      type="button"
                      onClick={onLogout}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium transition cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                      <Mail className="w-3.5 h-3.5 text-cyan-400" /> Email Address
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-200 block truncate" title={customerProfile?.email}>
                      {customerProfile?.email || '--'}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                      <Phone className="w-3.5 h-3.5 text-emerald-400" /> Mobile Number
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-200 block">
                      {customerProfile?.phone || customerProfile?.mobile_number || '--'}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                      <Car className="w-3.5 h-3.5 text-blue-400" /> Vehicle Model
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-200 block truncate">
                      {customerProfile?.vehicle_model || 'Tata vehicle'}
                    </span>
                  </div>

                  <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1.5 mb-1">
                      <Zap className="w-3.5 h-3.5 text-amber-400" /> Battery Pack ID
                    </span>
                    <span className="text-xs sm:text-sm font-bold text-amber-300 font-mono block truncate">
                      {customerProfile?.battery_id || currentBatteryState?.battery_id || 'BAT-AX-101'}
                    </span>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: VEHICLE & BATTERY{/* TAB 2: VEHICLE & BATTERY */}
          {currentTab === 'vehicle' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Car className="w-4 h-4 text-blue-400" /> EV Vehicle &amp; Battery Details
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Hardware identifiers and battery pack digital twin linkage
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-blue-400" /> Vehicle Model
                  </span>
                  <p className="text-sm font-bold text-white">
                    {customerProfile?.vehicle_model || 'Tata Nexon EV'}
                  </p>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" /> Battery Pack ID
                  </span>
                  <p className="text-sm font-bold text-amber-300 font-mono">
                    {customerProfile?.battery_id || 'BAT-AX-101'}
                  </p>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-teal-400" /> Battery Chemistry
                  </span>
                  <p className="text-sm font-bold text-slate-200">
                    Lithium-Ion (NMC / LFP)
                  </p>
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-1">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Digital Twin Status
                  </span>
                  <p className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Active &amp; Synced
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMPLETE ANALYSIS HISTORY */}
          {currentTab === 'analysis' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-cyan-400" /> Complete Analysis History
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Full chronological log of battery telemetry records and AI temperature predictions
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-1 rounded-full w-fit">
                  {customerAnalyses.length} Total Records
                </span>
              </div>

              {customerAnalyses.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs">
                  No battery analyses recorded yet. Go to the Dashboard and click <strong>ANALYZE BATTERY</strong> to run your first evaluation.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">Date / Time</th>
                        <th className="px-3 py-2.5 font-semibold">Temp (°C)</th>
                        <th className="px-3 py-2.5 font-semibold">Current (A)</th>
                        <th className="px-3 py-2.5 font-semibold">Voltage (V)</th>
                        <th className="px-3 py-2.5 font-semibold">SOC (%)</th>
                        <th className="px-3 py-2.5 font-semibold">Age (Mo)</th>
                        <th className="px-3 py-2.5 font-semibold">Cycles</th>
                        <th className="px-3 py-2.5 font-semibold">Pred Temp</th>
                        <th className="px-3 py-2.5 font-semibold">Risk Score</th>
                        <th className="px-3 py-2.5 font-semibold">Risk Level</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {customerAnalyses.map((item, idx) => (
                        <tr key={item.id || idx} className="hover:bg-slate-850/60 transition">
                          <td className="px-3 py-2 text-slate-400 font-sans whitespace-nowrap">
                            {item.created_at ? new Date(item.created_at).toLocaleString() : '--'}
                          </td>
                          <td className="px-3 py-2 text-white font-bold">
                            {item.temperature != null ? `${Number(item.temperature).toFixed(1)}°C` : '--'}
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            {item.current != null ? `${Number(item.current).toFixed(1)}A` : '--'}
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            {item.voltage != null ? `${Number(item.voltage).toFixed(1)}V` : '--'}
                          </td>
                          <td className="px-3 py-2 text-slate-300">
                            {item.soc != null ? `${Number(item.soc).toFixed(0)}%` : '--'}
                          </td>
                          <td className="px-3 py-2 text-slate-400">
                            {item.battery_age != null ? item.battery_age : '--'}
                          </td>
                          <td className="px-3 py-2 text-slate-400">
                            {item.cycles != null ? item.cycles : '--'}
                          </td>
                          <td className="px-3 py-2 text-cyan-300 font-bold">
                            {item.predicted_temperature != null ? `${Number(item.predicted_temperature).toFixed(1)}°C` : '--'}
                          </td>
                          <td className="px-3 py-2 font-bold text-white">
                            {item.risk_value != null ? Number(item.risk_value).toFixed(1) : '--'}
                          </td>
                          <td className="px-3 py-2">
                            {renderRiskBadge(item.risk_level)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: COMPLETE ALERT HISTORY */}
          {currentTab === 'alerts' && (
            <div className="space-y-4">
              <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-rose-400" /> Complete Alert History
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Safety event log, user acknowledgements, email notifications, SMS, and Twilio voice calls
                  </p>
                </div>
                <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded-full w-fit">
                  {customerAlerts.length} Total Alerts
                </span>
              </div>

              {customerAlerts.length === 0 ? (
                <div className="py-16 text-center text-slate-500 text-xs">
                  No alerts logged. Your battery operates safely within nominal risk parameters.
                </div>
              ) : (
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold">Date / Time</th>
                        <th className="px-3 py-2.5 font-semibold">Battery ID</th>
                        <th className="px-3 py-2.5 font-semibold">Risk Level</th>
                        <th className="px-3 py-2.5 font-semibold">Ack Status</th>
                        <th className="px-3 py-2.5 font-semibold">Email</th>
                        <th className="px-3 py-2.5 font-semibold">SMS</th>
                        <th className="px-3 py-2.5 font-semibold">Phone Call</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 font-mono">
                      {customerAlerts.map((alert, idx) => {
                        const isAck = alert.acknowledged === 1 || alert.status === 'ACKNOWLEDGED';
                        const isEscalated = alert.status === 'ESCALATED' || alert.escalated_at != null;
                        return (
                          <tr key={alert.id || idx} className="hover:bg-slate-850/60 transition">
                            <td className="px-3 py-2 text-slate-400 font-sans whitespace-nowrap">
                              {alert.timestamp || alert.created_at ? new Date(alert.timestamp || alert.created_at).toLocaleString() : '--'}
                            </td>
                            <td className="px-3 py-2 text-white font-bold font-mono">
                              {alert.battery_id || '--'}
                            </td>
                            <td className="px-3 py-2">
                              {renderRiskBadge(alert.risk_level)}
                            </td>
                            <td className="px-3 py-2">
                              {isAck ? (
                                <span className="px-2 py-0.5 rounded text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                                  Acknowledged
                                </span>
                              ) : isEscalated ? (
                                <span className="px-2 py-0.5 rounded text-[11px] bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold">
                                  Escalated (60s Expired)
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[11px] bg-amber-500/15 text-amber-300 border border-amber-500/30">
                                  Pending
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {alert.email_sent ? (
                                <span className="text-emerald-400 flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                                </span>
                              ) : (
                                <span className="text-slate-500">None</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {alert.sms_sent ? (
                                <span className="text-emerald-400 flex items-center gap-1 font-bold">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Sent
                                </span>
                              ) : (
                                <span className="text-slate-500">None</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {alert.call_triggered ? (
                                <span className="text-rose-400 flex items-center gap-1 font-bold">
                                  <Flame className="w-3.5 h-3.5" /> Dispatched
                                </span>
                              ) : (
                                <span className="text-slate-500">None</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: NOTIFICATIONS */}
          {currentTab === 'notifications' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Mail className="w-4 h-4 text-cyan-400" /> Notification Preferences
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure automated email reports and emergency escalation channels
                </p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">Email Safety Reports (Medium &amp; High Risk)</p>
                    <p className="text-xs text-slate-400">
                      Dispatches detailed battery diagnostics to <strong>{customerProfile?.email}</strong> whenever elevated risk is detected.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlertsEnabled}
                    onChange={(e) => setEmailAlertsEnabled(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 cursor-pointer rounded"
                  />
                </div>

                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-white">High-Risk Emergency Escalation (SMS &amp; Call)</p>
                    <p className="text-xs text-slate-400">
                      Triggers automated emergency SMS and Twilio voice call to <strong>{customerProfile?.phone || 'registered phone'}</strong> if a High Risk alert is not acknowledged within 60 seconds.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={emergencyEscalationEnabled}
                    onChange={(e) => setEmergencyEscalationEnabled(e.target.checked)}
                    className="w-4 h-4 accent-cyan-500 cursor-pointer rounded"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" /> Automated Escalation Window
                </p>
                <p className="text-cyan-300/80">
                  When a High Risk alert occurs, you have exactly 60 seconds to acknowledge it on your dashboard. Acknowledging within 1 minute immediately cancels SMS and phone call escalations while sending a full battery diagnostics report via email.
                </p>
              </div>
            </div>
          )}

          {/* TAB 6: ACCOUNT & PASSWORD */}
          {currentTab === 'account' && (
            <div className="space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-400" /> Account Security &amp; Password
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Change your login password and manage session credentials
                </p>
              </div>

              {/* Change Password Form */}
              <form onSubmit={handlePasswordSubmit} className="max-w-md space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Current Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 pr-10 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">New Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Confirm New Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>

                {passwordMsg.text && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      passwordMsg.type === 'success'
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                        : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                    }`}
                  >
                    {passwordMsg.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{passwordMsg.text}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={changingPassword}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs transition shadow-lg shadow-cyan-500/20 disabled:opacity-60 flex items-center gap-2"
                >
                  {changingPassword ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  <span>{changingPassword ? 'Updating Password...' : 'Update Password'}</span>
                </button>
              </form>

              {/* Account Metadata */}
              <div className="pt-6 border-t border-slate-800 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Account Metadata</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">CUSTOMER ID</span>
                    <span className="text-white font-bold">{customerProfile?.id || '--'}</span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">ACCOUNT ROLE</span>
                    <span className="text-cyan-300 font-bold">{customerProfile?.role || 'CUSTOMER'}</span>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">REGISTRATION DATE</span>
                    <span className="text-slate-300 font-sans">
                      {customerProfile?.created_at ? new Date(customerProfile.created_at).toLocaleDateString() : '--'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

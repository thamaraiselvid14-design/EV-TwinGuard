import React, { useState, useEffect } from 'react';
import {
  getHealth,
  predictBattery,
  assessRisk,
  analyzeBattery,
  getAlerts,
  API_BASE_URL,
} from '../services/api';
import BatteryInformation from '../components/BatteryInformation';
import AIPredictionCard from '../components/AIPredictionCard';
import RiskFactors from '../components/RiskFactors';
import WhatIfChargingSimulator from '../components/WhatIfChargingSimulator';
import AlertStatus from '../components/AlertStatus';
import AlertHistory from '../components/AlertHistory';
import DigitalTwinSimulator from '../components/DigitalTwinSimulator';
import DatasetExplorer from '../components/DatasetExplorer';
import AlertCenter from '../components/AlertCenter';

import {
  Cpu,
  Zap,
  Activity,
  ShieldCheck,
  Flame,
  AlertTriangle,
  RotateCw,
  PowerOff,
  CheckCircle2,
  Database,
  Sliders,
  Bell,
  Layers,
  Sparkles,
  Server
} from 'lucide-react';

const INITIAL_BATTERY_DATA = {
  battery_id: 'EV001',
  soc: 80.0,
  voltage: 405.0,
  charging_current: 18.0,
  current_temperature: 35.0,
  ambient_temperature: 28.0,
  battery_age: 12.0,
  charging_cycles: 300,
};

export default function Dashboard() {
  // Navigation tabs for full suite access
  const [activeTab, setActiveTab] = useState('main'); // 'main' | 'simulator-adv' | 'dataset' | 'alerts-mgmt'

  // Form input telemetry state
  const [batteryData, setBatteryData] = useState(INITIAL_BATTERY_DATA);

  // Backend response states
  const [predictionData, setPredictionData] = useState(null);
  const [riskAssessmentData, setRiskAssessmentData] = useState(null);
  const [chargingStatus, setChargingStatus] = useState('ACTIVE'); // 'ACTIVE' | 'SIMULATED DISCONNECT'
  const [alertRefreshTrigger, setAlertRefreshTrigger] = useState(0);

  // Loading & Error states
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'online' | 'offline' | 'connecting'

  // Verify backend connectivity on load
  const checkBackendHealth = async () => {
    try {
      const res = await getHealth();
      if (res && res.status === 'ok') {
        setConnectionStatus('online');
      } else {
        setConnectionStatus('offline');
      }
    } catch {
      setConnectionStatus('offline');
    }
  };

  // Run full battery analysis workflow
  const handleAnalyzeBattery = async () => {
    setAnalyzing(true);
    setAnalysisError('');
    try {
      // 1. Unified analysis or sequential predict + assessRisk
      const predReq = {
        battery_id: batteryData.battery_id,
        soc: parseFloat(batteryData.soc),
        voltage: parseFloat(batteryData.voltage),
        charging_current: parseFloat(batteryData.charging_current),
        current_temperature: parseFloat(batteryData.current_temperature),
        ambient_temperature: parseFloat(batteryData.ambient_temperature),
        battery_age: parseFloat(batteryData.battery_age),
        charging_cycles: parseInt(batteryData.charging_cycles, 10),
      };

      // Call predict endpoint
      const predRes = await predictBattery(predReq);
      setPredictionData(predRes);

      // Call risk assessment endpoint with predicted temperature
      const riskReq = {
        battery_id: batteryData.battery_id,
        predicted_future_temperature: predRes.predicted_future_temperature,
        current_temperature: parseFloat(batteryData.current_temperature),
        soc: parseFloat(batteryData.soc),
        voltage: parseFloat(batteryData.voltage),
        charging_current: parseFloat(batteryData.charging_current),
        ambient_temperature: parseFloat(batteryData.ambient_temperature),
        battery_age: parseFloat(batteryData.battery_age),
        charging_cycles: parseInt(batteryData.charging_cycles, 10),
      };

      const riskRes = await assessRisk(riskReq);
      setRiskAssessmentData(riskRes);

      // Set charging status according to backend response
      const packStatus =
        riskRes.charging_status ||
        riskRes.alert_event?.charging_status ||
        (riskRes.risk_level === 'HIGH' ? 'SIMULATED DISCONNECT' : 'ACTIVE');
      setChargingStatus(packStatus.toUpperCase().includes('DISCONNECT') ? 'SIMULATED DISCONNECT' : 'ACTIVE');

      // Trigger SQLite alert history refresh
      setAlertRefreshTrigger((prev) => prev + 1);
      setConnectionStatus('online');
    } catch (err) {
      console.error('Analysis workflow error:', err);
      setAnalysisError(err.message || 'Unable to connect to EV TwinGuard backend. Please ensure FastAPI is running.');
    } finally {
      setAnalyzing(false);
    }
  };

  // Run initial analysis on mount
  useEffect(() => {
    checkBackendHealth();
    handleAnalyzeBattery();
  }, []);

  const isDisconnected = chargingStatus.toUpperCase().includes('DISCONNECT');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-slate-950 font-sans">
      {/* ─── Top Global Navigation & Header ─── */}
      <header className="border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md sticky top-0 z-50 shadow-md shadow-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Main Title */}
          <div className="flex items-center space-x-3.5">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-indigo-600 p-0.5 shadow-lg shadow-cyan-500/25">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-cyan-400">
                <Cpu className="w-6 h-6 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
                  EV TwinGuard
                </h1>
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 font-mono tracking-wider">
                  Digital Twin v1.0
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium tracking-wide">
                AI-Powered EV Battery Digital Twin &amp; Safety Monitoring System
              </p>
            </div>
          </div>

          {/* Header Right: Charging Status Badge & Health */}
          <div className="flex items-center space-x-3">
            {/* Highly visible Charging Status Badge */}
            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-bold text-xs tracking-wider transition-all shadow-md ${
                isDisconnected
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-rose-950/40'
                  : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-emerald-950/40'
              }`}
            >
              {isDisconnected ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
                  <PowerOff className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span>● SIMULATED DISCONNECT</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <Zap className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>● ACTIVE</span>
                </>
              )}
            </div>

            {/* Backend connection pill */}
            <button
              onClick={checkBackendHealth}
              title="Click to check FastAPI health"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-850 hover:text-white transition text-xs font-mono"
            >
              {connectionStatus === 'online' ? (
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-rose-400" />
              )}
              <span>{connectionStatus === 'online' ? 'API 8000' : 'Backend Disconnected'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Bar Tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-slate-800/60 py-2 flex items-center justify-between">
          <nav className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab('main')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'main'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
              Main Dashboard
            </button>

            <button
              onClick={() => setActiveTab('simulator-adv')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'simulator-adv'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              Time-Series Simulation
            </button>

            <button
              onClick={() => setActiveTab('dataset')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'dataset'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5 text-cyan-400" />
              Dataset Explorer
            </button>

            <button
              onClick={() => setActiveTab('alerts-mgmt')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'alerts-mgmt'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bell className="w-3.5 h-3.5 text-cyan-400" />
              Incident Center
            </button>
          </nav>

          <div className="hidden lg:flex items-center gap-3 text-xs text-slate-500 font-mono">
            <span>Model: Random Forest Regressor</span>
            <span>&bull;</span>
            <span>Safety Tier: LOW / MED / HIGH</span>
          </div>
        </div>
      </header>

      {/* ─── Global Error Banner if API Fails ─── */}
      {analysisError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 w-full">
          <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 flex items-center justify-between text-rose-200 text-xs">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <div>
                <p className="font-semibold text-rose-300">Unable to connect to EV TwinGuard backend.</p>
                <p className="text-slate-400 mt-0.5">{analysisError}</p>
              </div>
            </div>
            <button
              onClick={handleAnalyzeBattery}
              className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-900 rounded-lg text-rose-100 font-semibold transition"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ─── Main Content Views ─── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'main' && (
          <div className="space-y-8">
            {/* 1. BATTERY INFORMATION SECTION */}
            <section>
              <BatteryInformation
                batteryData={batteryData}
                onChange={(updated) => setBatteryData(updated)}
                onAnalyze={handleAnalyzeBattery}
                loading={analyzing}
              />
            </section>

            {/* 2. TWO-COLUMN: AI PREDICTION & RISK FACTORS */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <AIPredictionCard
                prediction={predictionData}
                riskAssessment={riskAssessmentData}
                loading={analyzing}
                error={analysisError && !predictionData ? analysisError : null}
              />

              <RiskFactors
                riskAssessment={riskAssessmentData}
                loading={analyzing}
                error={analysisError && !riskAssessmentData ? analysisError : null}
              />
            </section>

            {/* 3. WHAT-IF CHARGING SIMULATOR (12A vs 18A vs 25A) */}
            <section>
              <WhatIfChargingSimulator currentBatteryState={batteryData} />
            </section>

            {/* 4. TWO-COLUMN: ALERT STATUS & CHARGING STATUS SUMMARY */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <AlertStatus
                riskAssessment={riskAssessmentData}
                loading={analyzing}
                error={analysisError && !riskAssessmentData ? analysisError : null}
              />

              {/* Charging Status & Protection Detail Card */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl backdrop-blur-xl relative overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                    <div className="flex items-center space-x-3">
                      <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-emerald-500/10 rounded-xl border border-cyan-500/30 text-cyan-400 shadow-sm">
                        <Zap className="w-5 h-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-white tracking-wide">Charging Status</h2>
                        <p className="text-xs text-slate-400">Real-time contactor state &amp; pack energization</p>
                      </div>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-lg text-xs font-bold font-mono uppercase border ${
                        isDisconnected
                          ? 'bg-rose-500/10 text-rose-400 border-rose-500/30'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {chargingStatus}
                    </span>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4">
                      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                        <span className="font-semibold text-slate-300">Operational Mode</span>
                        <span className="font-mono text-slate-400">
                          {isDisconnected ? 'Safety Trip Active' : 'Active Charging Mode'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-2">
                        {isDisconnected
                          ? 'High risk thermal anomaly (>70/100) triggered automated contactor opening to safeguard cells against runaway.'
                          : 'Battery operating within safe thermal envelope. Current flow permitted at configured charging rate.'}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                        <span className="text-slate-400 block text-[11px]">Charging Contactor</span>
                        <span
                          className={`font-mono font-bold mt-1 inline-block ${
                            isDisconnected ? 'text-rose-400' : 'text-emerald-400'
                          }`}
                        >
                          {isDisconnected ? 'TRIPPED (OPEN)' : 'CLOSED (ENERGIZED)'}
                        </span>
                      </div>
                      <div className="bg-slate-800/40 border border-slate-700/50 rounded-lg p-3">
                        <span className="text-slate-400 block text-[11px]">Chiller Circuit</span>
                        <span className="font-mono font-bold text-cyan-400 mt-1 inline-block">
                          {isDisconnected ? 'MAX REFRIGERATION' : 'ADAPTIVE COOLING'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>Connected to EV TwinGuard Digital Twin Engine</span>
                </div>
              </div>
            </section>

            {/* 5. ALERT HISTORY SECTION (SQLite Logs) */}
            <section>
              <AlertHistory refreshTrigger={alertRefreshTrigger} />
            </section>
          </div>
        )}

        {/* Other Full-Feature Views */}
        {activeTab === 'simulator-adv' && (
          <div className="space-y-6">
            <DigitalTwinSimulator />
          </div>
        )}

        {activeTab === 'dataset' && (
          <div className="space-y-6">
            <DatasetExplorer
              onSelectRecord={(rec) => {
                setBatteryData({
                  battery_id: rec.battery_id || 'EV001',
                  soc: parseFloat(rec.soc ?? 80.0),
                  voltage: parseFloat(rec.voltage ?? 405.0),
                  charging_current: parseFloat(rec.charging_current ?? 18.0),
                  current_temperature: parseFloat(rec.battery_temperature ?? rec.current_temperature ?? 35.0),
                  ambient_temperature: parseFloat(rec.ambient_temperature ?? 28.0),
                  battery_age: parseFloat(rec.battery_age ?? 12.0),
                  charging_cycles: parseInt(rec.charging_cycles ?? 300, 10),
                });
                setActiveTab('main');
              }}
            />
          </div>
        )}

        {activeTab === 'alerts-mgmt' && (
          <div className="space-y-6">
            <AlertCenter />
          </div>
        )}
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>&copy; 2026 EV TwinGuard &bull; AI-Powered EV Battery Digital Twin &amp; Safety Platform</span>
          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
            <span>FastAPI Backend</span>
            <span>&bull;</span>
            <span>Scikit-Learn Regression</span>
            <span>&bull;</span>
            <span>Recharts Visualization</span>
            <span>&bull;</span>
            <span>SQLite Alert Logs</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

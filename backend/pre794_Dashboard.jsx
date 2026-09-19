import React, { useState, useEffect, useRef } from 'react';
import {
  getHealth,
  predictBattery,
  assessRisk,
  getRealtimeStatus,
  startRealtimeStream,
  pauseRealtimeStream,
  resetRealtimeStream,
  getRealtimeNext,
} from '../services/api';
import BatteryInformation from '../components/BatteryInformation';
import InputModeSelector from '../components/InputModeSelector';
import RealTimeDatasetPanel from '../components/RealTimeDatasetPanel';
import AIPredictionCard from '../components/AIPredictionCard';
import RiskFactors from '../components/RiskFactors';
import RecommendationCard from '../components/RecommendationCard';
import SafetySummaryCard from '../components/SafetySummaryCard';
import SecurityAlertsPage from '../components/SecurityAlertsPage';
import SettingsPage from '../components/SettingsPage';

import {
  Cpu,
  Zap,
  Activity,
  AlertTriangle,
  PowerOff,
  Info,
  X,
  CheckCircle2,
  Database,
  Sliders,
  Bell,
  Layers,
  Sparkles,
  Clock,
  Radio,
  History,
  ShieldCheck,
  Flame,
  Mail,
  PhoneCall,
  Play,
  Pause,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';

const EMPTY_BATTERY_DATA = {
  battery_id: '',
  soc: '',
  voltage: '',
  charging_current: '',
  current_temperature: '',
  ambient_temperature: '',
  battery_age: '',
  charging_cycles: '',
};

const NOMINAL_BASELINE_DATA = {
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
  // Exactly 3 main navigation pages ('dashboard' | 'alerts' | 'settings')
  const [activePage, setActivePage] = useState('dashboard');

  // Input Mode state ('manual' | 'realtime')
  const [inputMode, setInputMode] = useState('manual');

  // Real-time stream state
  const [realtimeRunning, setRealtimeRunning] = useState(false);
  const [realtimeInterval, setRealtimeInterval] = useState(3);
  const [realtimeStatus, setRealtimeStatus] = useState(null);
  const [latestRealtimeData, setLatestRealtimeData] = useState(null);
  const [streamHistory, setStreamHistory] = useState([]);
  const [lastUpdateTime, setLastUpdateTime] = useState('');
  const [loadingNext, setLoadingNext] = useState(false);
  const [timeLeft, setTimeLeft] = useState(3);
  const [selectedStreamRecordId, setSelectedStreamRecordId] = useState(null);
  const [isInspectingStreamRecord, setIsInspectingStreamRecord] = useState(false);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState('info'); // 'info' | 'warning' | 'error'

  // Form input telemetry state: starts empty with light placeholder hints for user
  const [batteryData, setBatteryData] = useState(EMPTY_BATTERY_DATA);

  // Backend response states
  const [predictionData, setPredictionData] = useState(null);
  const [riskAssessmentData, setRiskAssessmentData] = useState(null);
  const [chargingStatus, setChargingStatus] = useState('ACTIVE'); // 'ACTIVE' | 'SIMULATED DISCONNECT'
  const [alertRefreshTrigger, setAlertRefreshTrigger] = useState(0);

  // Loading & Error states
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'online' | 'offline' | 'connecting'

  const timerRef = useRef(null);

  const showToast = (message, type = 'info') => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage('');
    }, 4000);
  };

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

  // Fetch real-time status
  const fetchRealtimeStatus = async () => {
    try {
      const statusRes = await getRealtimeStatus();
      setRealtimeStatus(statusRes);
    } catch {
      // Non-blocking status fetch
    }
  };

  // Run full battery analysis workflow (Manual Mode)
  const handleAnalyzeBattery = async (overrideData = null, isInitial = false) => {
    setAnalyzing(true);
    setAnalysisError('');
    const rawData = overrideData || batteryData;
    if (overrideData && !isInitial) {
      setBatteryData(overrideData);
    }
    try {
      const parseVal = (v, def) => (v !== '' && v != null && !isNaN(Number(v)) ? parseFloat(v) : def);
      const parseIntVal = (v, def) => (v !== '' && v != null && !isNaN(Number(v)) ? parseInt(v, 10) : def);

      const targetData = {
        battery_id: (rawData.battery_id && String(rawData.battery_id).trim()) || 'EV-MANUAL-01',
        soc: parseVal(rawData.soc, 80.0),
        voltage: parseVal(rawData.voltage, 405.0),
        charging_current: parseVal(rawData.charging_current, 18.0),
        current_temperature: parseVal(rawData.current_temperature ?? rawData.battery_temperature, 35.0),
        ambient_temperature: parseVal(rawData.ambient_temperature, 28.0),
        battery_age: parseVal(rawData.battery_age, 12.0),
        charging_cycles: parseIntVal(rawData.charging_cycles, 300),
      };

      const predReq = {
        battery_id: targetData.battery_id,
        soc: targetData.soc,
        voltage: targetData.voltage,
        charging_current: targetData.charging_current,
        current_temperature: targetData.current_temperature,
        ambient_temperature: targetData.ambient_temperature,
        battery_age: targetData.battery_age,
        charging_cycles: targetData.charging_cycles,
      };

      // Call predict endpoint
      const predRes = await predictBattery(predReq);
      setPredictionData(predRes);

      // Call risk assessment endpoint with predicted temperature
      const riskReq = {
        battery_id: targetData.battery_id,
        predicted_future_temperature: predRes.predicted_future_temperature,
        current_temperature: parseFloat(targetData.current_temperature ?? targetData.battery_temperature ?? 30.0),
        soc: parseFloat(targetData.soc),
        voltage: parseFloat(targetData.voltage),
        charging_current: parseFloat(targetData.charging_current),
        ambient_temperature: parseFloat(targetData.ambient_temperature ?? 25.0),
        battery_age: parseFloat(targetData.battery_age ?? 12.0),
        charging_cycles: parseInt(targetData.charging_cycles ?? 300, 10),
      };

      const riskRes = await assessRisk(riskReq);
      setRiskAssessmentData(riskRes);

      // Set charging status according to backend response
      const packStatus =
        riskRes.charging_status ||
        riskRes.alert_event?.charging_status ||
        (riskRes.risk_level === 'HIGH' ? 'SIMULATED DISCONNECT' : 'ACTIVE');
      setChargingStatus(
        typeof packStatus === 'string' && packStatus.toUpperCase().includes('DISCONNECT')
          ? 'SIMULATED DISCONNECT'
          : 'ACTIVE'
      );

      // Trigger SQLite alert history refresh
      setAlertRefreshTrigger((prev) => prev + 1);
      setConnectionStatus('online');

      if (!isInitial) {
        const scoreVal = riskRes.risk_score ?? riskRes.overall_risk_score ?? 0;
        showToast(
          `Analysis complete for ${targetData.battery_id}: ${riskRes.risk_level} RISK (${Number(scoreVal).toFixed(1)}/100)`,
          riskRes.risk_level === 'HIGH' ? 'error' : riskRes.risk_level === 'MEDIUM' ? 'warning' : 'info'
        );
      }
    } catch (err) {
      console.error('Analysis workflow error:', err);
      setAnalysisError(err.message || 'Unable to connect to EV TwinGuard backend. Please ensure FastAPI is running.');
      if (!isInitial) {
        showToast('Analysis failed. Please check backend connection.', 'error');
      }
    } finally {
      setAnalyzing(false);
    }
  };

  // Real-Time Next Record Fetcher
  const handleFetchNextRealtimeRecord = async () => {
    setLoadingNext(true);
    try {
      const nextRes = await getRealtimeNext();
      setLatestRealtimeData(nextRes);

      // Update telemetry state with the incoming record
      const telemetry = nextRes.telemetry;
      const updatedBattery = {
        battery_id: telemetry.battery_id,
        soc: parseFloat(telemetry.soc),
        voltage: parseFloat(telemetry.voltage),
        charging_current: parseFloat(telemetry.charging_current),
        current_temperature: parseFloat(telemetry.current_temperature ?? telemetry.battery_temperature ?? 30.0),
        ambient_temperature: parseFloat(telemetry.ambient_temperature ?? 25.0),
        battery_age: parseFloat(telemetry.battery_age ?? 12.0),
        charging_cycles: parseInt(telemetry.charging_cycles ?? 300, 10),
      };
      setBatteryData(updatedBattery);

      // Update AI prediction & risk assessment
      setPredictionData(nextRes.prediction);
      setRiskAssessmentData(nextRes.risk_assessment);

      // Set charging status
      const packStatus =
        nextRes.alert_status?.charging_status ||
        nextRes.risk_assessment?.charging_status ||
        (nextRes.risk_assessment?.risk_level === 'HIGH' ? 'SIMULATED DISCONNECT' : 'ACTIVE');
      setChargingStatus(packStatus.toUpperCase().includes('DISCONNECT') ? 'SIMULATED DISCONNECT' : 'ACTIVE');

      // Trigger SQLite alert history refresh if alert occurred
      if (nextRes.risk_assessment?.alert_triggered || nextRes.alert_status?.email_sent || nextRes.alert_status?.call_triggered) {
        setAlertRefreshTrigger((prev) => prev + 1);
      }

      // Update timestamp and stream activity log
      const now = new Date().toLocaleTimeString();
      setLastUpdateTime(now);

      const rScore = nextRes.risk_assessment?.risk_score ?? nextRes.risk_assessment?.overall_risk_score;
      const historyId = `stream-${nextRes.index}-${Date.now()}`;
      const newHistoryItem = {
        id: historyId,
        time: now,
        index: nextRes.index,
        battery_id: telemetry.battery_id,
        temp: (telemetry.current_temperature ?? telemetry.battery_temperature ?? 30.0).toFixed(1),
        pred_temp: nextRes.prediction?.predicted_future_temperature != null ? nextRes.prediction.predicted_future_temperature.toFixed(1) : '--',
        risk_score: rScore != null ? Number(rScore).toFixed(1) : '--',
        risk_level: nextRes.risk_assessment?.risk_level ?? 'LOW',
        charging_status: packStatus,
        email_sent: Boolean(nextRes.alert_status?.email_sent),
        call_triggered: Boolean(nextRes.alert_status?.call_triggered),
        // Raw data preserved for interactive click-to-analyze inspection
        rawTelemetry: updatedBattery,
        rawPrediction: nextRes.prediction,
        rawRisk: nextRes.risk_assessment,
        rawAlertStatus: nextRes.alert_status,
        rawResponse: nextRes,
      };

      setStreamHistory((prev) => [newHistoryItem, ...prev.slice(0, 19)]);

      if (!isInspectingStreamRecord) {
        setSelectedStreamRecordId(historyId);
      }

      // Update status record position
      setRealtimeStatus((prev) => ({
        ...prev,
        current_index: nextRes.index,
        total_records: nextRes.total_records,
        is_complete: nextRes.is_complete,
      }));

      // Check if dataset complete or skipped
      if (nextRes.is_complete) {
        setRealtimeRunning(false);
        showToast('DATASET COMPLETE — All records auto-analyzed. Stream paused.', 'info');
      } else if (nextRes.skipped_invalid) {
        showToast('Invalid dataset record skipped.', 'warning');
      } else if (nextRes.risk_assessment) {
        const level = nextRes.risk_assessment.risk_level;
        if (level === 'HIGH') {
          showToast('High-risk battery detected. Safety actions triggered.', 'error');
        } else if (level === 'MEDIUM') {
          showToast('Medium-risk battery detected. Alert report dispatched.', 'warning');
        } else if (!realtimeRunning) {
          showToast(`Battery ${telemetry.battery_id} analyzed successfully.`, 'info');
        }
      }

      setConnectionStatus('online');
    } catch (err) {
      console.error('Error in handleFetchNextRealtimeRecord:', err);
      showToast('AI prediction failed for this record. Continuing stream.', 'warning');
    } finally {
      setLoadingNext(false);
    }
  };

  // Click-to-Analyze a Historical Record from the Stream Table
  const handleSelectStreamRecord = async (item) => {
    if (!item) return;
    setSelectedStreamRecordId(item.id);
    setIsInspectingStreamRecord(true);

    // Pause stream so incoming records don't immediately overwrite user inspection
    if (realtimeRunning) {
      try {
        await pauseRealtimeStream();
        setRealtimeRunning(false);
      } catch {
        setRealtimeRunning(false);
      }
    }

    // Load selected record's telemetry into batteryData
    if (item.rawTelemetry) {
      setBatteryData(item.rawTelemetry);
    }
    if (item.rawResponse) {
      setLatestRealtimeData(item.rawResponse);
    }

    // Load pre-calculated AI prediction & risk assessment
    if (item.rawPrediction && item.rawRisk) {
      setPredictionData(item.rawPrediction);
      setRiskAssessmentData(item.rawRisk);
      const packStatus =
        item.rawRisk.charging_status ||
        item.rawRisk.alert_event?.charging_status ||
        (item.rawRisk.risk_level === 'HIGH' ? 'SIMULATED DISCONNECT' : 'ACTIVE');
      setChargingStatus(
        typeof packStatus === 'string' && packStatus.toUpperCase().includes('DISCONNECT')
          ? 'SIMULATED DISCONNECT'
          : 'ACTIVE'
      );
    } else if (item.rawTelemetry) {
      // Re-trigger live AI model endpoint if needed
      await handleAnalyzeBattery(item.rawTelemetry, false);
    }

    const rScore = item.risk_score !== '--' ? item.risk_score : (item.rawRisk?.risk_score ?? 0);
    showToast(
      `Loaded ${item.battery_id} (Record #${item.index}): ${item.risk_level} RISK (${rScore}/100). Auto-stream paused.`,
      item.risk_level === 'HIGH' ? 'error' : item.risk_level === 'MEDIUM' ? 'warning' : 'info'
    );
  };

  // Resume Live Auto-Streaming
  const handleResumeStream = async () => {
    setIsInspectingStreamRecord(false);
    setSelectedStreamRecordId(null);
    await handleStartRealtimeStream();
    showToast('Live stream resumed. Auto-analyzing incoming dataset records.', 'info');
  };

  // Real-time Controls
  const handleStartRealtimeStream = async () => {
    try {
      setIsInspectingStreamRecord(false);
      await startRealtimeStream(realtimeInterval);
      setRealtimeRunning(true);
      await handleFetchNextRealtimeRecord();
    } catch {
      showToast('Failed to start real-time stream.', 'error');
    }
  };

  const handlePauseRealtimeStream = async () => {
    try {
      await pauseRealtimeStream();
      setRealtimeRunning(false);
    } catch {
      showToast('Failed to pause real-time stream.', 'error');
    }
  };

  const handleResetRealtimeStream = async () => {
    try {
      await resetRealtimeStream();
      setStreamHistory([]);
      setSelectedStreamRecordId(null);
      setIsInspectingStreamRecord(false);
      setTimeLeft(realtimeInterval);
      await fetchRealtimeStatus();
      showToast('Stream reset to record 1.', 'info');
    } catch {
      showToast('Failed to reset stream.', 'error');
    }
  };

  const handleIntervalChange = async (sec) => {
    setRealtimeInterval(sec);
    setTimeLeft(sec);
    if (realtimeRunning) {
      try {
        await startRealtimeStream(sec);
      } catch {
        // Non-blocking
      }
    }
  };

  const handleModeChange = (mode) => {
    if (mode === 'manual') {
      if (realtimeRunning) {
        handlePauseRealtimeStream();
      }
      setIsInspectingStreamRecord(false);
      setSelectedStreamRecordId(null);
      setInputMode('manual');
      setBatteryData(EMPTY_BATTERY_DATA);
      showToast('Manual Input mode selected. Parameter inputs cleared for custom data entry.', 'info');
    } else if (mode === 'realtime') {
      setInputMode('realtime');
      fetchRealtimeStatus();
      if (!latestRealtimeData) {
        handleFetchNextRealtimeRecord();
      }
      showToast('Real-Time Dataset mode active. Telemetry auto-analyzing.', 'info');
    }
  };

  // Drift-Free Live Countdown & Polling Effect for Real-Time Stream
  useEffect(() => {
    if (inputMode !== 'realtime' || !realtimeRunning) {
      setTimeLeft(realtimeInterval);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    let isFetching = false;
    let nextTrigger = Date.now() + realtimeInterval * 1000;
    setTimeLeft(realtimeInterval);

    timerRef.current = setInterval(async () => {
      const remainingMs = Math.max(0, nextTrigger - Date.now());
      const remainingSec = +(remainingMs / 1000).toFixed(1);
      setTimeLeft(remainingSec);

      if (remainingMs <= 100 && !isFetching) {
        isFetching = true;
        try {
          await handleFetchNextRealtimeRecord();
        } finally {
          isFetching = false;
          nextTrigger = Date.now() + realtimeInterval * 1000;
        }
      }
    }, 100);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [inputMode, realtimeRunning, realtimeInterval]);

  // Run initial analysis on mount
  useEffect(() => {
    checkBackendHealth();
    // Run baseline analysis for dashboard cards while leaving user inputs empty with light placeholder hints
    handleAnalyzeBattery(NOMINAL_BASELINE_DATA, true);
    setBatteryData(EMPTY_BATTERY_DATA);
  }, []);

  const isDisconnected = typeof chargingStatus === 'string' && chargingStatus.toUpperCase().includes('DISCONNECT');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-cyan-500 selection:text-slate-950 font-sans">
      {/* ─── Top Global Navigation & Header ─── */}
      <header className="border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-md sticky top-0 z-50 shadow-md shadow-slate-950/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-20 flex items-center justify-between">
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

          {/* ─── Exactly Three Main Navigation Pages ─── */}
          <div className="flex items-center space-x-2.5 border-t border-slate-800/80 pt-2.5 pb-2 overflow-x-auto scrollbar-none">
            {/* 1. DASHBOARD */}
            <button
              type="button"
              onClick={() => setActivePage('dashboard')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activePage === 'dashboard'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            {/* 2. SECURITY ALERTS */}
            <button
              type="button"
              onClick={() => setActivePage('alerts')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activePage === 'alerts'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm shadow-rose-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Security Alerts</span>
            </button>

            {/* 3. SETTINGS */}
            <button
              type="button"
              onClick={() => setActivePage('settings')}
              className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                activePage === 'settings'
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm shadow-indigo-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Settings</span>
            </button>
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
              onClick={() => handleAnalyzeBattery()}
              className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-900 rounded-lg text-rose-100 font-semibold transition"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ─── Toast Notification Banner ─── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-xl border shadow-2xl flex items-center gap-3 text-xs font-semibold backdrop-blur-xl ${
              toastType === 'warning'
                ? 'bg-amber-950/90 border-amber-600/60 text-amber-200 shadow-amber-950/50'
                : toastType === 'error'
                ? 'bg-rose-950/90 border-rose-600/60 text-rose-200 shadow-rose-950/50'
                : 'bg-cyan-950/90 border-cyan-600/60 text-cyan-200 shadow-cyan-950/50'
            }`}
          >
            <Info className="w-4 h-4 shrink-0" />
            <span>{toastMessage}</span>
            <button
              type="button"
              onClick={() => setToastMessage('')}
              className="ml-2 hover:opacity-75"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Main Content Views ─── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activePage === 'dashboard' && (
          <div className="space-y-8">
            {/* 1. DATA INPUT MODE SELECTOR & ACTIVE INPUT OPTION */}
            <section className="space-y-6">
              <InputModeSelector
                activeMode={inputMode}
                onModeChange={handleModeChange}
              />

              {inputMode === 'manual' ? (
                <BatteryInformation
                  batteryData={batteryData}
                  onChange={(updated) => setBatteryData(updated)}
                  onAnalyze={() => handleAnalyzeBattery(null, false)}
                  onAnalyzePreset={(presetData) => handleAnalyzeBattery(presetData, false)}
                  loading={analyzing}
                  mode="manual"
                />
              ) : (
                <div className="space-y-6">
                  <RealTimeDatasetPanel
                    status={realtimeStatus}
                    isRunning={realtimeRunning}
                    onStart={handleStartRealtimeStream}
                    onPause={handlePauseRealtimeStream}
                    onNext={handleFetchNextRealtimeRecord}
                    onReset={handleResetRealtimeStream}
                    intervalSeconds={realtimeInterval}
                    onIntervalChange={handleIntervalChange}
                    latestData={latestRealtimeData}
                    lastUpdateTime={lastUpdateTime}
                    loadingNext={loadingNext}
                    timeLeft={timeLeft}
                  />

                  {/* LIVE STREAM ACTIVITY HISTORY TABLE */}
                  {streamHistory.length > 0 && (
                    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-xl">
                      {/* History Table Header with Stream Interval Controls & Countdown */}
                      <div className="pb-4 border-b border-slate-800 mb-4">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
                              <Radio className={`w-4 h-4 ${realtimeRunning ? 'animate-pulse text-cyan-300' : 'text-slate-500'}`} />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-base font-bold text-white tracking-wide">
                                  Live Stream Telemetry History
                                </h3>
                                <span className="text-[11px] font-mono text-cyan-300 font-bold bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
                                  {streamHistory.length} Events
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Real-time chronological trace of incoming fleet records, AI evaluations, and protective actions
                              </p>
                            </div>
                          </div>

                          {/* Header Right: Interval Selector & Live Countdown Badge */}
                          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-between lg:justify-end">
                            {/* Live Countdown Badge */}
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 font-mono text-xs">
                              <Clock className={`w-3.5 h-3.5 ${realtimeRunning ? 'text-cyan-400 animate-spin' : 'text-slate-500'}`} />
                              <span className="text-slate-400">Next:</span>
                              <span className={`font-bold ${realtimeRunning ? 'text-cyan-300' : 'text-amber-400'}`}>
                                {realtimeRunning ? `${Number(timeLeft).toFixed(1)}s` : 'PAUSED'}
                              </span>
                            </div>

                            {/* Interval Buttons */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">Pace:</span>
                              <div className="inline-flex p-0.5 bg-slate-950 border border-slate-800 rounded-lg">
                                {[1, 2, 3, 5, 10].map((sec) => (
                                  <button
                                    key={sec}
                                    type="button"
                                    onClick={() => handleIntervalChange(sec)}
                                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition ${
                                      realtimeInterval === sec
                                        ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                                        : 'text-slate-400 hover:text-slate-200'
                                    }`}
                                  >
                                    {sec}s
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Stream Quick Toggle Button */}
                            {realtimeRunning ? (
                              <button
                                type="button"
                                onClick={handlePauseRealtimeStream}
                                className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1.5"
                              >
                                <Pause className="w-3.5 h-3.5 fill-current" />
                                <span>Pause</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={handleResumeStream}
                                className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition flex items-center gap-1.5"
                              >
                                <Play className="w-3.5 h-3.5 fill-current" />
                                <span>Resume</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Animated Header Interval Progress Bar */}
                        <div className="w-full bg-slate-800/60 rounded-full h-1 overflow-hidden mt-3">
                          <div
                            className={`h-full transition-all duration-100 ease-linear ${
                              realtimeRunning
                                ? 'bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 shadow-sm shadow-cyan-400/50'
                                : 'bg-slate-700'
                            }`}
                            style={{
                              width: realtimeRunning
                                ? `${Math.min(100, Math.max(0, ((realtimeInterval - (timeLeft ?? realtimeInterval)) / realtimeInterval) * 100))}%`
                                : '0%',
                            }}
                          />
                        </div>
                      </div>

                      {/* Active Inspection Banner when a Historical Record is Clicked */}
                      {isInspectingStreamRecord && (
                        <div className="bg-gradient-to-r from-cyan-950/80 via-blue-950/70 to-slate-900 border border-cyan-500/50 rounded-xl p-3.5 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-lg shadow-cyan-950/40">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-cyan-500/20 text-cyan-300 rounded-lg shrink-0">
                              <Sparkles className="w-4 h-4 animate-pulse" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white uppercase text-[11px] tracking-wider">
                                  Inspecting Fleet Record:
                                </span>
                                <span className="font-mono font-bold text-cyan-300 px-2 py-0.5 bg-cyan-900/60 rounded border border-cyan-500/40">
                                  {batteryData.battery_id || 'Selected Pack'}
                                </span>
                              </div>
                              <p className="text-slate-300 text-xs mt-0.5">
                                AI prediction, risk triggers, and what-if simulation active below. Auto-stream is paused for inspection.
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                            <button
                              type="button"
                              onClick={() => handleAnalyzeBattery(batteryData, false)}
                              disabled={analyzing}
                              className="px-3 py-1.5 bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 rounded-lg font-bold transition text-xs flex items-center gap-1.5"
                            >
                              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
                              <span>{analyzing ? 'Analyzing...' : 'Re-Run AI Model'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={handleResumeStream}
                              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-lg transition text-xs flex items-center gap-1.5 shadow-md shadow-emerald-950/40 transform active:scale-95"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Resume Live Stream</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Informational Guidance Hint */}
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2.5 font-mono">
                        <span className="flex items-center gap-1.5 text-cyan-400 font-semibold">
                          <Info className="w-3.5 h-3.5 shrink-0" />
                          Click any record below to automatically analyze it with AI and update Digital Twin predictions.
                        </span>
                        <span className="text-slate-500 hidden sm:inline">
                          Auto-stream interval: {realtimeInterval}s
                        </span>
                      </div>

                      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
                        <table className="w-full text-left text-xs font-mono">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider">
                              <th className="pb-3 pr-4 font-semibold">Time</th>
                              <th className="pb-3 pr-4 font-semibold">Pack ID</th>
                              <th className="pb-3 pr-4 font-semibold">Temp</th>
                              <th className="pb-3 pr-4 font-semibold">AI Pred Temp</th>
                              <th className="pb-3 pr-4 font-semibold">Risk Score</th>
                              <th className="pb-3 pr-4 font-semibold">Risk Level</th>
                              <th className="pb-3 pr-4 font-semibold">Contactor</th>
                              <th className="pb-3 pr-4 font-semibold">Automated Action</th>
                              <th className="pb-3 font-semibold text-right">AI Twin Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60">
                            {streamHistory.map((item) => {
                              const isHighRisk = item.risk_level === 'HIGH';
                              const isMedRisk = item.risk_level === 'MEDIUM';
                              const isDisconn = item.charging_status?.toUpperCase().includes('DISCONNECT');
                              const isSelected = selectedStreamRecordId === item.id;
                              return (
                                <tr
                                  key={item.id}
                                  onClick={() => handleSelectStreamRecord(item)}
                                  title={`Click to analyze ${item.battery_id} in AI Digital Twin`}
                                  className={`cursor-pointer transition-all ${
                                    isSelected
                                      ? 'bg-cyan-950/70 border-l-4 border-cyan-400 ring-1 ring-cyan-500/40 text-white shadow-md'
                                      : 'hover:bg-slate-800/50 border-l-4 border-transparent'
                                  }`}
                                >
                                  <td className="py-3 pr-4 text-slate-300 whitespace-nowrap pl-2">{item.time}</td>
                                  <td className="py-3 pr-4 font-bold text-cyan-300 whitespace-nowrap">{item.battery_id}</td>
                                  <td className="py-3 pr-4 text-slate-200">{item.temp}°C</td>
                                  <td className="py-3 pr-4 font-semibold text-orange-300">{item.pred_temp}°C</td>
                                  <td className="py-3 pr-4 font-bold text-white">{item.risk_score}/100</td>
                                  <td className="py-3 pr-4">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                        isHighRisk
                                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                          : isMedRisk
                                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                          : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                      }`}
                                    >
                                      {item.risk_level}
                                    </span>
                                  </td>
                                  <td className="py-3 pr-4">
                                    <span
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                        isDisconn
                                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                          : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                      }`}
                                    >
                                      {isDisconn ? 'TRIPPED' : 'CONNECTED'}
                                    </span>
                                  </td>
                                  <td className="py-3 pr-4 text-slate-300">
                                    <div className="flex items-center gap-2">
                                      {isHighRisk && (
                                        <span className="flex items-center gap-1 text-[10px] text-rose-300 font-semibold bg-rose-950/60 px-2 py-0.5 rounded border border-rose-800/60">
                                          <PhoneCall className="w-3 h-3" /> Call + Email Dispatched
                                        </span>
                                      )}
                                      {isMedRisk && (
                                        <span className="flex items-center gap-1 text-[10px] text-amber-300 font-semibold bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/60">
                                          <Mail className="w-3 h-3" /> Report Emailed
                                        </span>
                                      )}
                                      {!isHighRisk && !isMedRisk && (
                                        <span className="text-[10px] text-emerald-400">Nominal Monitoring</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 pr-2 text-right whitespace-nowrap">
                                    {isSelected ? (
                                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-black bg-cyan-500/25 text-cyan-200 border border-cyan-400 shadow-sm shadow-cyan-950/50">
                                        <Sparkles className="w-3 h-3 text-cyan-400 animate-spin" />
                                        <span>Active in Twin</span>
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSelectStreamRecord(item);
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-800/80 hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 border border-slate-700/70 hover:border-cyan-500/40 transition shadow-sm"
                                      >
                                        <span>Analyze</span>
                                        <ArrowRight className="w-3 h-3 text-cyan-400" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 2. SHARED AI ANALYSIS OUTCOMES: PREDICTION & RISK FACTORS */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <AIPredictionCard
                prediction={predictionData}
                riskAssessment={riskAssessmentData}
                loading={analyzing || loadingNext}
                error={analysisError && !predictionData ? analysisError : null}
              />

              <RiskFactors
                riskAssessment={riskAssessmentData}
                loading={analyzing || loadingNext}
                error={analysisError && !riskAssessmentData ? analysisError : null}
              />
            </section>

            {/* 3. RECOMMENDATION */}
            <section>
              <RecommendationCard
                riskAssessment={riskAssessmentData}
                loading={analyzing || loadingNext}
              />
            </section>

            {/* 4. SAFETY STATUS (SMALL SUMMARY) */}
            <section>
              <SafetySummaryCard
                riskAssessment={riskAssessmentData}
                chargingStatus={chargingStatus}
                onNavigateToAlerts={() => setActivePage('alerts')}
              />
            </section>
          </div>
        )}

        {/* PAGE 2 — SECURITY ALERTS */}
        {activePage === 'alerts' && (
          <SecurityAlertsPage
            latestBatteryData={batteryData}
            latestPrediction={predictionData}
            latestRiskAssessment={riskAssessmentData}
            latestChargingStatus={chargingStatus}
            refreshTrigger={alertRefreshTrigger}
          />
        )}

        {/* PAGE 3 — SETTINGS */}
        {activePage === 'settings' && (
          <SettingsPage
            currentBatteryState={batteryData}
            realtimeStatus={realtimeStatus}
            realtimeRunning={realtimeRunning}
            realtimeInterval={realtimeInterval}
            onStartRealtimeStream={handleStartRealtimeStream}
            onPauseRealtimeStream={handlePauseRealtimeStream}
            onResetRealtimeStream={handleResetRealtimeStream}
            onIntervalChange={handleIntervalChange}
            onSelectDatasetRecord={(rec) => {
              const updated = {
                battery_id: rec.battery_id || 'EV001',
                soc: parseFloat(rec.soc ?? 80.0),
                voltage: parseFloat(rec.voltage ?? 405.0),
                charging_current: parseFloat(rec.charging_current ?? 18.0),
                current_temperature: parseFloat(rec.battery_temperature ?? rec.current_temperature ?? 35.0),
                ambient_temperature: parseFloat(rec.ambient_temperature ?? 28.0),
                battery_age: parseFloat(rec.battery_age ?? 12.0),
                charging_cycles: parseInt(rec.charging_cycles ?? 300, 10),
              };
              setBatteryData(updated);
              setInputMode('manual');
              setActivePage('dashboard');
              handleAnalyzeBattery(updated, false);
              showToast(`Loaded ${rec.battery_id || 'record'} into Twin Dashboard and executed AI analysis.`, 'info');
            }}
          />
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

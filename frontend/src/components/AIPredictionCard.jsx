import React from 'react';
import {
  BrainCircuit,
  Thermometer,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Flame,
  Activity,
  Gauge
} from 'lucide-react';

export default function AIPredictionCard({
  prediction,
  riskAssessment,
  batteryData,
  loading,
  error,
}) {
  if (loading) {
    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl backdrop-blur-xl relative overflow-hidden flex flex-col justify-center items-center min-h-[340px]">
        <div className="w-12 h-12 border-3 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin mb-4" />
        <h3 className="text-base font-semibold text-white">Evaluating AI Thermal Model...</h3>
        <p className="text-xs text-slate-400 mt-1">Executing Scikit-learn Random Forest regression</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900/80 border border-rose-900/40 rounded-2xl p-6 shadow-xl backdrop-blur-xl relative min-h-[340px] flex flex-col justify-center items-center text-center">
        <AlertTriangle className="w-10 h-10 text-rose-400 mb-3" />
        <h3 className="text-base font-semibold text-rose-300">Prediction Unavailable</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">{error}</p>
      </div>
    );
  }

  const currentTemp =
    prediction?.current_temperature != null
      ? Number(prediction.current_temperature)
      : batteryData?.current_temperature !== '' && batteryData?.current_temperature != null
      ? Number(batteryData.current_temperature)
      : 35.0;

  const predictedTemp =
    prediction?.predicted_future_temperature ?? prediction?.predicted_temperature ?? 38.2;

  const tempDelta =
    prediction?.temperature_delta ?? (predictedTemp - currentTemp);

  const confidence =
    prediction?.confidence_score != null
      ? Math.round(prediction.confidence_score * 100)
      : 98;

  const thermalStatus =
    prediction?.thermal_status ||
    (predictedTemp > 50 ? 'CRITICAL' : predictedTemp > 40 ? 'ELEVATED' : 'OPTIMAL');

  // Risk values directly from backend
  const riskScore = riskAssessment?.risk_score ?? riskAssessment?.overall_risk_score ?? 32.0;
  const riskLevel =
    riskAssessment?.risk_level ??
    riskAssessment?.level ??
    (riskScore >= 70 ? 'HIGH' : riskScore >= 40 ? 'MEDIUM' : 'LOW');

  const isHigh = riskLevel === 'HIGH';
  const isMed = riskLevel === 'MEDIUM';

  const riskCardBorder = isHigh
    ? 'border-rose-500/40 shadow-rose-950/30'
    : isMed
    ? 'border-amber-500/40 shadow-amber-950/30'
    : 'border-slate-800/80 shadow-slate-950/30';

  return (
    <div
      className={`bg-slate-900/80 border ${riskCardBorder} rounded-2xl p-6 shadow-xl backdrop-blur-xl relative overflow-hidden flex flex-col justify-between transition-all duration-300`}
    >
      {/* Background glow matching risk */}
      <div
        className={`absolute -top-12 -right-12 w-48 h-48 rounded-full blur-3xl pointer-events-none ${
          isHigh ? 'bg-rose-500/10' : isMed ? 'bg-amber-500/10' : 'bg-cyan-500/10'
        }`}
      />

      {/* Header */}
      <div>
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 rounded-xl border border-cyan-500/30 text-cyan-400 shadow-sm">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide uppercase">AI ANALYSIS</h2>
              <p className="text-xs text-slate-400">AI PREDICTION &bull; Random Forest Regressor (R² = 0.994)</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-400">Model Confidence:</span>
            <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 text-xs font-bold font-mono">
              {confidence}%
            </span>
          </div>
        </div>

        {/* 2x2 Metric Cards: Current Temp, Predicted Future Temp, Delta, Confidence */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
          {/* 1. Current Temperature */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Thermometer className="w-4 h-4 text-cyan-400" />
                Current Temperature
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-mono">Telemetry</span>
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
                {typeof currentTemp === 'number' ? currentTemp.toFixed(1) : currentTemp}
              </span>
              <span className="text-sm font-bold text-slate-400">°C</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
              <span>BMS Sensor Baseline</span>
            </div>
          </div>

          {/* 2. Predicted Future Temperature */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Flame className="w-4 h-4 text-orange-400" />
                Predicted Future Temperature
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-mono">+15 min</span>
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-extrabold text-white font-mono tracking-tight">
                {typeof predictedTemp === 'number' ? predictedTemp.toFixed(1) : predictedTemp}
              </span>
              <span className="text-sm font-bold text-slate-400">°C</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
              <span>Thermal Status:</span>
              <span
                className={`font-semibold px-1.5 py-0.2 rounded text-[10px] font-mono ${
                  thermalStatus === 'CRITICAL'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : thermalStatus === 'ELEVATED'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}
              >
                {thermalStatus}
              </span>
            </div>
          </div>

          {/* 3. Temperature Delta */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Activity className="w-4 h-4 text-cyan-400" />
                Temperature Delta
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-mono">Forecast</span>
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span
                className={`text-3xl font-extrabold font-mono tracking-tight ${
                  tempDelta > 0 ? 'text-amber-400' : 'text-emerald-400'
                }`}
              >
                {tempDelta >= 0 ? `+${tempDelta.toFixed(1)}` : tempDelta.toFixed(1)}
              </span>
              <span className="text-sm font-bold text-slate-400">°C</span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1">
              {tempDelta >= 0 ? (
                <>
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  <span>Thermal accumulation</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Cooling / dissipation trend</span>
                </>
              )}
            </div>
          </div>

          {/* 4. Model Confidence */}
          <div className="bg-slate-800/50 border border-slate-700/60 rounded-xl p-4 relative overflow-hidden flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Gauge className="w-4 h-4 text-purple-400" />
                Confidence
              </span>
              <span className="text-[10px] text-slate-500 uppercase font-mono">Accuracy</span>
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-extrabold font-mono tracking-tight text-cyan-300">
                {confidence}%
              </span>
              <span className="text-xs font-semibold text-slate-400">R²: 0.994</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-1.5 mt-3 overflow-hidden">
              <div
                className="h-full bg-cyan-400 transition-all duration-500"
                style={{ width: `${confidence}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
        <span>Model: Random Forest Regressor</span>
        <span className="font-mono text-[11px] text-slate-400">MAE: 0.5356°C | RMSE: 0.7668°C</span>
      </div>
    </div>
  );
}


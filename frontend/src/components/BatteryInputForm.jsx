import React, { useState, useEffect } from 'react';
import { submitManualBatteryData, analyzeBattery } from '../services/api';
import { 
  BatteryCharging, 
  CheckCircle2, 
  AlertCircle, 
  Send, 
  RotateCcw, 
  Sparkles,
  Zap,
  Thermometer,
  Gauge,
  Clock,
  Repeat,
  Cpu,
  ShieldCheck,
  Flame,
  ArrowRight
} from 'lucide-react';

const PRESETS = [
  {
    name: '⚡ Fast DC Charging (High Stress)',
    data: {
      battery_id: 'EV-SUPERCHARGE-01',
      soc: '88.0',
      voltage: '412.5',
      charging_current: '75.0',
      battery_temperature: '49.5',
      ambient_temperature: '34.0',
      battery_age: '18.0',
      charging_cycles: '520',
    },
  },
  {
    name: '🚗 Nominal Highway Cruise',
    data: {
      battery_id: 'EV-CRUISE-02',
      soc: '62.0',
      voltage: '394.0',
      charging_current: '18.0',
      battery_temperature: '31.5',
      ambient_temperature: '24.0',
      battery_age: '8.0',
      charging_cycles: '180',
    },
  },
  {
    name: '❄️ Sub-Zero Winter Mode',
    data: {
      battery_id: 'EV-COLD-03',
      soc: '45.0',
      voltage: '378.0',
      charging_current: '12.0',
      battery_temperature: '4.5',
      ambient_temperature: '-8.0',
      battery_age: '12.0',
      charging_cycles: '290',
    },
  },
  {
    name: '⚠️ Degraded Commercial Fleet',
    data: {
      battery_id: 'EV-FLEET-DEGRADED',
      soc: '92.0',
      voltage: '416.0',
      charging_current: '65.0',
      battery_temperature: '54.0',
      ambient_temperature: '38.0',
      battery_age: '48.0',
      charging_cycles: '1650',
    },
  },
];

const INITIAL_FORM = {
  battery_id: 'EV-TWIN-101',
  soc: '72.5',
  voltage: '398.0',
  charging_current: '28.0',
  battery_temperature: '33.5',
  ambient_temperature: '26.0',
  battery_age: '14.0',
  charging_cycles: '320',
};

export default function BatteryInputForm({ onAnalysisComplete, externalFormData }) {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [validatedResult, setValidatedResult] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);

  useEffect(() => {
    if (externalFormData) {
      setFormData({
        battery_id: String(externalFormData.battery_id || ''),
        soc: String(externalFormData.soc ?? ''),
        voltage: String(externalFormData.voltage ?? ''),
        charging_current: String(externalFormData.charging_current ?? ''),
        battery_temperature: String(externalFormData.battery_temperature ?? ''),
        ambient_temperature: String(externalFormData.ambient_temperature ?? ''),
        battery_age: String(externalFormData.battery_age ?? ''),
        charging_cycles: String(externalFormData.charging_cycles ?? ''),
      });
      setValidatedResult(null);
      setAnalysisResult(null);
    }
  }, [externalFormData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const applyPreset = (preset) => {
    setFormData(preset.data);
    setFieldErrors({});
    setSubmitError('');
    setValidatedResult(null);
    setAnalysisResult(null);
  };

  const resetForm = () => {
    setFormData({
      battery_id: '',
      soc: '',
      voltage: '',
      charging_current: '',
      battery_temperature: '',
      ambient_temperature: '',
      battery_age: '',
      charging_cycles: '',
    });
    setFieldErrors({});
    setSubmitError('');
    setValidatedResult(null);
    setAnalysisResult(null);
  };

  const validateClientSide = () => {
    const errors = {};
    if (!formData.battery_id || !formData.battery_id.trim()) {
      errors.battery_id = 'Battery ID is required.';
    }
    const socNum = parseFloat(formData.soc);
    if (formData.soc === '' || isNaN(socNum) || socNum < 0 || socNum > 100) {
      errors.soc = 'SOC must be between 0% and 100%.';
    }
    const voltNum = parseFloat(formData.voltage);
    if (formData.voltage === '' || isNaN(voltNum) || voltNum <= 0) {
      errors.voltage = 'Voltage must be greater than 0V.';
    }
    const currNum = parseFloat(formData.charging_current);
    if (formData.charging_current === '' || isNaN(currNum) || currNum < 0) {
      errors.charging_current = 'Current must be >= 0A.';
    }
    const battTempNum = parseFloat(formData.battery_temperature);
    if (formData.battery_temperature === '' || isNaN(battTempNum) || battTempNum < -50 || battTempNum > 120) {
      errors.battery_temperature = 'Temp must be between -50°C and 120°C.';
    }
    const ambTempNum = parseFloat(formData.ambient_temperature);
    if (formData.ambient_temperature === '' || isNaN(ambTempNum) || ambTempNum < -50 || ambTempNum > 70) {
      errors.ambient_temperature = 'Ambient Temp must be between -50°C and 70°C.';
    }
    const ageNum = parseFloat(formData.battery_age);
    if (formData.battery_age === '' || isNaN(ageNum) || ageNum < 0) {
      errors.battery_age = 'Age must be >= 0 months.';
    }
    const cyclesNum = parseInt(formData.charging_cycles, 10);
    if (formData.charging_cycles === '' || isNaN(cyclesNum) || cyclesNum < 0) {
      errors.charging_cycles = 'Cycles must be an integer >= 0.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFullAnalysis = async (e) => {
    if (e) e.preventDefault();
    setSubmitError('');
    if (!validateClientSide()) return;

    setSubmitting(true);
    try {
      const payload = {
        battery_id: formData.battery_id.trim(),
        soc: parseFloat(formData.soc),
        voltage: parseFloat(formData.voltage),
        charging_current: parseFloat(formData.charging_current),
        battery_temperature: parseFloat(formData.battery_temperature),
        ambient_temperature: parseFloat(formData.ambient_temperature),
        battery_age: parseFloat(formData.battery_age),
        charging_cycles: parseInt(formData.charging_cycles, 10),
      };

      const result = await analyzeBattery(payload);
      setAnalysisResult(result);
      setValidatedResult(result.telemetry);
      if (onAnalysisComplete) {
        onAnalysisComplete(result);
      }
    } catch (err) {
      setSubmitError(err.message || 'Failed to complete battery analysis.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-2xl backdrop-blur-xl relative overflow-hidden">
      {/* Header & Preset Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight">
              Live Telemetry Input & AI Analysis Engine
            </h2>
            <p className="text-xs text-slate-400">
              Direct physical parameters ingestion, Random Forest inference & risk scoring
            </p>
          </div>
        </div>

        {/* Quick Scenario Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-medium mr-1">Presets:</span>
          {PRESETS.map((preset, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyPreset(preset)}
              className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* Main Telemetry Form */}
      <form onSubmit={handleFullAnalysis} className="mt-6 space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Battery ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Battery ID
            </label>
            <input
              type="text"
              name="battery_id"
              value={formData.battery_id}
              onChange={handleInputChange}
              placeholder="e.g. EV001"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
            />
            {fieldErrors.battery_id && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.battery_id}</p>}
          </div>

          {/* SOC (%) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <BatteryCharging className="w-3.5 h-3.5 text-emerald-400" /> State of Charge (SOC %)
            </label>
            <input
              type="number"
              step="0.1"
              name="soc"
              value={formData.soc}
              onChange={handleInputChange}
              placeholder="0.0 - 100.0"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
            />
            {fieldErrors.soc && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.soc}</p>}
          </div>

          {/* Voltage (V) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-400" /> Pack Voltage (V)
            </label>
            <input
              type="number"
              step="0.1"
              name="voltage"
              value={formData.voltage}
              onChange={handleInputChange}
              placeholder="e.g. 400.0"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-yellow-500 transition"
            />
            {fieldErrors.voltage && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.voltage}</p>}
          </div>

          {/* Charging Current (A) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-cyan-400" /> Charging Current (A)
            </label>
            <input
              type="number"
              step="0.1"
              name="charging_current"
              value={formData.charging_current}
              onChange={handleInputChange}
              placeholder=">= 0.0"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
            />
            {fieldErrors.charging_current && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.charging_current}</p>}
          </div>

          {/* Battery Temperature (°C) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-rose-400" /> Battery Temp (°C)
            </label>
            <input
              type="number"
              step="0.1"
              name="battery_temperature"
              value={formData.battery_temperature}
              onChange={handleInputChange}
              placeholder="-50 to 120"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-rose-500 transition"
            />
            {fieldErrors.battery_temperature && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.battery_temperature}</p>}
          </div>

          {/* Ambient Temperature (°C) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Thermometer className="w-3.5 h-3.5 text-blue-400" /> Ambient Temp (°C)
            </label>
            <input
              type="number"
              step="0.1"
              name="ambient_temperature"
              value={formData.ambient_temperature}
              onChange={handleInputChange}
              placeholder="-50 to 70"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-blue-500 transition"
            />
            {fieldErrors.ambient_temperature && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.ambient_temperature}</p>}
          </div>

          {/* Battery Age (months) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-400" /> Age (Months)
            </label>
            <input
              type="number"
              step="0.5"
              name="battery_age"
              value={formData.battery_age}
              onChange={handleInputChange}
              placeholder=">= 0.0"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-teal-500 transition"
            />
            {fieldErrors.battery_age && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.battery_age}</p>}
          </div>

          {/* Charging Cycles */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5 text-purple-400" /> Charge Cycles
            </label>
            <input
              type="number"
              step="1"
              name="charging_cycles"
              value={formData.charging_cycles}
              onChange={handleInputChange}
              placeholder=">= 0"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono placeholder-slate-600 focus:outline-none focus:border-purple-500 transition"
            />
            {fieldErrors.charging_cycles && <p className="text-[11px] text-rose-400 mt-1">{fieldErrors.charging_cycles}</p>}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <button
            type="button"
            onClick={resetForm}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Clear
          </button>

          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 transition-all duration-200 disabled:opacity-50"
          >
            {submitting ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin text-slate-950" />
                Analyzing Battery Health...
              </>
            ) : (
              <>
                <Cpu className="w-4 h-4 text-slate-950 fill-current" />
                Run AI Twin Analysis
              </>
            )}
          </button>
        </div>
      </form>

      {/* Global Error Banner */}
      {submitError && (
        <div className="mt-4 p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{submitError}</span>
        </div>
      )}

      {/* Instant Prediction Summary Ribbon */}
      {analysisResult && (
        <div className="mt-6 p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                AI Prediction: {analysisResult.prediction.predicted_temperature}°C
              </span>
              <span className="text-xs text-slate-400">
                (Delta: {analysisResult.prediction.temperature_delta > 0 ? `+${analysisResult.prediction.temperature_delta}` : analysisResult.prediction.temperature_delta}°C vs measured)
              </span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Model Confidence:</span>
              <span className="font-mono text-cyan-300 font-bold">
                {(analysisResult.prediction.confidence_score * 100).toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Feature Attribution Chips */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] pt-1 border-t border-slate-800">
            <span className="text-slate-400 font-semibold uppercase text-[10px]">Thermal Drivers:</span>
            {Object.entries(analysisResult.prediction.feature_contributions || {}).map(([feat, pct]) => (
              <span key={feat} className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 font-mono">
                {feat.replace('_', ' ')}: <strong className="text-cyan-400">{pct}%</strong>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

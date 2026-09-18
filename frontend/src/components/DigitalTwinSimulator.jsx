import React, { useState, useEffect } from 'react';
import { runSimulation } from '../services/api';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { Play, RotateCcw, AlertTriangle, CheckCircle, Clock, Thermometer, BatteryCharging, ShieldAlert } from 'lucide-react';

export default function DigitalTwinSimulator() {
  const [params, setParams] = useState({
    battery_id: 'EV-TWIN-SIM',
    initial_soc: 20.0,
    pack_voltage: 400.0,
    charging_current: 60.0,
    ambient_temperature: 30.0,
    battery_age: 18.0,
    charging_cycles: 450,
    duration_minutes: 60,
    time_step_minutes: 2,
    cooling_efficiency: 0.75,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [simulationResult, setSimulationResult] = useState(null);

  const handleSliderChange = (field, value) => {
    setParams((prev) => ({ ...prev, [field]: parseFloat(value) }));
  };

  const executeSimulation = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await runSimulation(params);
      setSimulationResult(data);
    } catch (err) {
      setError(err.message || 'Simulation failed to execute.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeSimulation();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/50 border border-cyan-800/50 text-cyan-400 text-xs font-semibold mb-2">
              <BatteryCharging className="w-3.5 h-3.5" />
              Phase 5: Digital Twin Parametric Physics Engine
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              What-If Thermal & Charging Simulator
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Simulate electro-thermal trajectories, CC-CV charging curves, and degradation dynamics over time.
            </p>
          </div>

          <button
            onClick={executeSimulation}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all duration-200 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RotateCcw className="w-4 h-4 animate-spin" />
                Computing Physics Simulation...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Run Simulation
              </>
            )}
          </button>
        </div>

        {/* Parametric Sliders Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-6 pt-6 border-t border-slate-800">
          {/* Charging Current */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center text-xs text-slate-300 font-medium mb-2">
              <span>Charging Current</span>
              <span className="font-mono text-cyan-400 font-bold">{params.charging_current} A</span>
            </div>
            <input
              type="range"
              min="5"
              max="150"
              step="5"
              value={params.charging_current}
              onChange={(e) => handleSliderChange('charging_current', e.target.value)}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Standard (15A)</span>
              <span>Fast DC (60A)</span>
              <span>Ultra (150A)</span>
            </div>
          </div>

          {/* Ambient Temperature */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center text-xs text-slate-300 font-medium mb-2">
              <span>Ambient Environmental Temp</span>
              <span className="font-mono text-amber-400 font-bold">{params.ambient_temperature}°C</span>
            </div>
            <input
              type="range"
              min="-15"
              max="50"
              step="1"
              value={params.ambient_temperature}
              onChange={(e) => handleSliderChange('ambient_temperature', e.target.value)}
              className="w-full accent-amber-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Freezing (-15°C)</span>
              <span>Moderate (25°C)</span>
              <span>Desert (50°C)</span>
            </div>
          </div>

          {/* Initial SOC */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center text-xs text-slate-300 font-medium mb-2">
              <span>Initial State of Charge (SOC)</span>
              <span className="font-mono text-emerald-400 font-bold">{params.initial_soc}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="90"
              step="5"
              value={params.initial_soc}
              onChange={(e) => handleSliderChange('initial_soc', e.target.value)}
              className="w-full accent-emerald-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Depleted (5%)</span>
              <span>Low (20%)</span>
              <span>Near Full (90%)</span>
            </div>
          </div>

          {/* Cooling Efficiency */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center text-xs text-slate-300 font-medium mb-2">
              <span>Thermal Cooling Efficiency</span>
              <span className="font-mono text-teal-400 font-bold">{(params.cooling_efficiency * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={params.cooling_efficiency}
              onChange={(e) => handleSliderChange('cooling_efficiency', e.target.value)}
              className="w-full accent-teal-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Passive Air (0%)</span>
              <span>Standard (50%)</span>
              <span>Full Chiller (100%)</span>
            </div>
          </div>

          {/* Battery Age & Cycles */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center text-xs text-slate-300 font-medium mb-2">
              <span>Battery Age / Cycles</span>
              <span className="font-mono text-indigo-400 font-bold">{params.battery_age} mo &bull; {params.charging_cycles} cyc</span>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="3"
              value={params.battery_age}
              onChange={(e) => {
                const age = parseFloat(e.target.value);
                setParams((prev) => ({
                  ...prev,
                  battery_age: age,
                  charging_cycles: Math.round(age * 25),
                }));
              }}
              className="w-full accent-indigo-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>New Pack (0 mo)</span>
              <span>Mid-Life (24 mo)</span>
              <span>Aged Pack (60 mo)</span>
            </div>
          </div>

          {/* Duration */}
          <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center text-xs text-slate-300 font-medium mb-2">
              <span>Simulation Duration</span>
              <span className="font-mono text-blue-400 font-bold">{params.duration_minutes} Mins</span>
            </div>
            <input
              type="range"
              min="15"
              max="120"
              step="5"
              value={params.duration_minutes}
              onChange={(e) => handleSliderChange('duration_minutes', e.target.value)}
              className="w-full accent-blue-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Quick (15 min)</span>
              <span>Standard (60 min)</span>
              <span>Extended (120 min)</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-sm flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          {error}
        </div>
      )}

      {/* Simulation Result Key Metric Cards */}
      {simulationResult && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Thermometer className="w-4 h-4 text-amber-400" />
              Peak Temperature
            </span>
            <span className="text-2xl font-black font-mono text-white mt-2">
              {simulationResult.max_temperature}°C
            </span>
            <span className="text-[11px] text-slate-400 mt-1">
              Start: {simulationResult.initial_temperature}°C &rarr; End: {simulationResult.final_temperature}°C
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <BatteryCharging className="w-4 h-4 text-emerald-400" />
              Final SOC Reached
            </span>
            <span className="text-2xl font-black font-mono text-emerald-400 mt-2">
              {simulationResult.final_soc}%
            </span>
            <span className="text-[11px] text-slate-400 mt-1">
              Start: {simulationResult.initial_soc}% (+{(simulationResult.final_soc - simulationResult.initial_soc).toFixed(1)}%)
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" />
              Time to 80% Fast Charge
            </span>
            <span className="text-2xl font-black font-mono text-cyan-400 mt-2">
              {simulationResult.time_to_80_soc_min ? `${simulationResult.time_to_80_soc_min} min` : 'N/A (> duration)'}
            </span>
            <span className="text-[11px] text-slate-400 mt-1">
              Taper initiates at 80%
            </span>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Max Risk Tier
            </span>
            <span className={`text-xl font-black font-mono mt-2 ${
              simulationResult.max_risk_level === 'HIGH'
                ? 'text-rose-400'
                : simulationResult.max_risk_level === 'MEDIUM'
                ? 'text-amber-400'
                : 'text-emerald-400'
            }`}>
              {simulationResult.max_risk_level}
            </span>
            <span className="text-[11px] text-slate-400 mt-1">
              {simulationResult.time_to_thermal_warning_min 
                ? `Warn threshold hit @ ${simulationResult.time_to_thermal_warning_min}m` 
                : 'Thermal threshold stable'}
            </span>
          </div>
        </div>
      )}

      {/* Recharts Visualizations */}
      {simulationResult && simulationResult.timeline && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Temperature & Thermal Threshold Chart */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-amber-400" />
              Thermal Trajectory vs Safety Thresholds
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Pack temperature (°C) progression against 45°C Warning and 52°C Critical limits
            </p>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simulationResult.timeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time_min" stroke="#64748b" tickFormatter={(v) => `${v}m`} fontSize={11} />
                  <YAxis stroke="#64748b" domain={['dataMin - 5', 'dataMax + 8']} fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    formatter={(val, name) => [`${val}°C`, name === 'battery_temperature' ? 'Battery Temp' : 'Ambient Temp']}
                    labelFormatter={(label) => `Time: ${label} minutes`}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                  <ReferenceLine y={45} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Warn: 45°C', fill: '#f59e0b', fontSize: 10 }} />
                  <ReferenceLine y={52} stroke="#f43f5e" strokeDasharray="4 4" label={{ value: 'Critical: 52°C', fill: '#f43f5e', fontSize: 10 }} />
                  <Line type="monotone" dataKey="battery_temperature" name="Battery Temp" stroke="#38bdf8" strokeWidth={3} dot={false} />
                  <Line type="monotone" dataKey="ambient_temperature" name="Ambient Temp" stroke="#64748b" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* SOC Progression & Risk Score Chart */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <BatteryCharging className="w-4 h-4 text-emerald-400" />
              State of Charge (SOC) & Dynamic Risk Index
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              State of Charge % curve (left axis) and dynamic AI risk score % (right axis)
            </p>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={simulationResult.timeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time_min" stroke="#64748b" tickFormatter={(v) => `${v}m`} fontSize={11} />
                  <YAxis yAxisId="left" stroke="#10b981" domain={[0, 100]} fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" domain={[0, 100]} fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    labelFormatter={(label) => `Time: ${label} minutes`}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                  <Line yAxisId="left" type="monotone" dataKey="soc" name="SOC (%)" stroke="#10b981" strokeWidth={3} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="risk_score" name="Risk Score (0-100)" stroke="#f43f5e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

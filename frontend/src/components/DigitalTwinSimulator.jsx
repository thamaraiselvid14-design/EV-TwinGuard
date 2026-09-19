import React, { useState, useEffect, useMemo } from 'react';
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
import {
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Thermometer,
  BatteryCharging,
  ShieldAlert,
  Zap,
  Sliders,
  TrendingUp,
  Activity,
  Layers,
} from 'lucide-react';

export default function DigitalTwinSimulator({ initialBatteryData }) {
  // Baseline input conditions common across all three scenarios (12A / 18A / 22A)
  const [params, setParams] = useState({
    battery_id: initialBatteryData?.battery_id || 'BAT-AX-101',
    initial_soc: initialBatteryData?.soc != null ? parseFloat(initialBatteryData.soc) : 20.0,
    pack_voltage: initialBatteryData?.voltage != null ? parseFloat(initialBatteryData.voltage) : 400.0,
    ambient_temperature: initialBatteryData?.ambient_temperature != null ? parseFloat(initialBatteryData.ambient_temperature) : 30.0,
    battery_age: initialBatteryData?.battery_age != null ? parseFloat(initialBatteryData.battery_age) : 18.0,
    charging_cycles: initialBatteryData?.charging_cycles != null ? parseInt(initialBatteryData.charging_cycles, 10) : 450,
    duration_minutes: 60,
    time_step_minutes: 2,
    cooling_efficiency: 0.75,
  });

  // Selected scenario view: 'ALL' (compare all three), '12A', '18A', or '22A'
  const [selectedScenario, setSelectedScenario] = useState('ALL');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [simResults, setSimResults] = useState({
    sim12: null,
    sim18: null,
    sim22: null,
  });

  // Update battery id if parent passes new pack data
  useEffect(() => {
    if (initialBatteryData?.battery_id) {
      setParams((prev) => ({
        ...prev,
        battery_id: initialBatteryData.battery_id,
        initial_soc: initialBatteryData.soc != null ? parseFloat(initialBatteryData.soc) : prev.initial_soc,
      }));
    }
  }, [initialBatteryData]);

  const handleSliderChange = (field, value) => {
    setParams((prev) => ({ ...prev, [field]: parseFloat(value) }));
  };

  // Executes time-series simulation concurrently for 12A, 18A, and 22A
  const executeSimulation = async () => {
    setLoading(true);
    setError('');
    try {
      const [res12, res18, res22] = await Promise.all([
        runSimulation({ ...params, charging_current: 12.0 }),
        runSimulation({ ...params, charging_current: 18.0 }),
        runSimulation({ ...params, charging_current: 22.0 }),
      ]);
      setSimResults({
        sim12: res12,
        sim18: res18,
        sim22: res22,
      });
    } catch (err) {
      setError(err.message || 'Time Series Simulation failed to execute.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    executeSimulation();
  }, []);

  // Merge the timelines of 12A, 18A, and 22A by timestamp for comparison chart
  const mergedTimeline = useMemo(() => {
    const { sim12, sim18, sim22 } = simResults;
    if (!sim12?.timeline || !sim18?.timeline || !sim22?.timeline) return [];

    const minLen = Math.min(sim12.timeline.length, sim18.timeline.length, sim22.timeline.length);
    const merged = [];

    for (let i = 0; i < minLen; i++) {
      const p12 = sim12.timeline[i];
      const p18 = sim18.timeline[i];
      const p22 = sim22.timeline[i];

      const rise12 = +(p12.battery_temperature - sim12.initial_temperature).toFixed(2);
      const rise18 = +(p18.battery_temperature - sim18.initial_temperature).toFixed(2);
      const rise22 = +(p22.battery_temperature - sim22.initial_temperature).toFixed(2);

      merged.push({
        time_min: p12.time_min,
        // Temperatures (°C)
        temp_12A: p12.battery_temperature,
        temp_18A: p18.battery_temperature,
        temp_22A: p22.battery_temperature,
        // Temperature rises (°C)
        rise_12A: rise12 > 0 ? rise12 : 0,
        rise_18A: rise18 > 0 ? rise18 : 0,
        rise_22A: rise22 > 0 ? rise22 : 0,
        // Risk scores (0 - 100)
        risk_12A: p12.risk_score,
        risk_18A: p18.risk_score,
        risk_22A: p22.risk_score,
        risk_level_12A: p12.risk_level,
        risk_level_18A: p18.risk_level,
        risk_level_22A: p22.risk_level,
        // Battery condition / SOC (%)
        soc_12A: p12.soc,
        soc_18A: p18.soc,
        soc_22A: p22.soc,
        ambient_temp: p12.ambient_temperature,
      });
    }

    return merged;
  }, [simResults]);

  const { sim12, sim18, sim22 } = simResults;
  const isLoaded = Boolean(sim12 && sim18 && sim22);

  // Helper for risk badge styling
  const getRiskBadge = (level) => {
    if (level === 'HIGH') return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    if (level === 'MEDIUM') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  };

  return (
    <div className="space-y-6">
      {/* ─── 1. Time Series Simulation Header & Common Controls ─── */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Ambient Glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/50 border border-cyan-800/50 text-cyan-400 text-xs font-semibold mb-2">
              <Activity className="w-3.5 h-3.5" />
              Time Series Simulation &bull; Scenario Comparison Engine
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white uppercase">
              Time Series Simulation (12A vs 18A vs 22A)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Compare battery electro-thermal behavior, temperature rise over time, risk values, and SOC across identical baseline conditions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Scenario Selection Buttons: 12A / 18A / 22A / Compare All */}
            <div className="flex items-center gap-1 bg-slate-950/90 p-1 rounded-xl border border-slate-800">
              <span className="text-[10px] uppercase font-bold text-slate-400 px-2">Scenario:</span>
              <button
                onClick={() => setSelectedScenario('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition font-mono ${
                  selectedScenario === 'ALL'
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-black'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Compare All
              </button>
              <button
                onClick={() => setSelectedScenario('12A')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition font-mono ${
                  selectedScenario === '12A'
                    ? 'bg-cyan-400 text-slate-950 shadow-md shadow-cyan-400/20 font-black'
                    : 'text-cyan-400 hover:text-cyan-200'
                }`}
              >
                12A
              </button>
              <button
                onClick={() => setSelectedScenario('18A')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition font-mono ${
                  selectedScenario === '18A'
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 font-black'
                    : 'text-amber-400 hover:text-amber-200'
                }`}
              >
                18A
              </button>
              <button
                onClick={() => setSelectedScenario('22A')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition font-mono ${
                  selectedScenario === '22A'
                    ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20 font-black'
                    : 'text-rose-400 hover:text-rose-200'
                }`}
              >
                22A
              </button>
            </div>

            {/* Run Simulation Button */}
            <button
              onClick={executeSimulation}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  Simulating Scenarios...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Run 12A / 18A / 22A Simulation
                </>
              )}
            </button>
          </div>
        </div>

        {/* Common Input Parametric Conditions (Shared by 12A, 18A, and 22A) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mt-5 pt-5 border-t border-slate-800 text-xs">
          {/* Ambient Environmental Temp */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center text-[11px] text-slate-300 font-medium mb-1.5">
              <span>Ambient Temp</span>
              <span className="font-mono text-amber-400 font-bold">{params.ambient_temperature}°C</span>
            </div>
            <input
              type="range"
              min="10"
              max="50"
              step="1"
              value={params.ambient_temperature}
              onChange={(e) => handleSliderChange('ambient_temperature', e.target.value)}
              className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>10°C</span>
              <span>30°C</span>
              <span>50°C</span>
            </div>
          </div>

          {/* Initial SOC */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center text-[11px] text-slate-300 font-medium mb-1.5">
              <span>Initial Battery SOC</span>
              <span className="font-mono text-emerald-400 font-bold">{params.initial_soc}%</span>
            </div>
            <input
              type="range"
              min="5"
              max="85"
              step="5"
              value={params.initial_soc}
              onChange={(e) => handleSliderChange('initial_soc', e.target.value)}
              className="w-full accent-emerald-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>5% (Low)</span>
              <span>45%</span>
              <span>85% (High)</span>
            </div>
          </div>

          {/* Cooling Efficiency */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center text-[11px] text-slate-300 font-medium mb-1.5">
              <span>Cooling Efficiency</span>
              <span className="font-mono text-cyan-400 font-bold">{(params.cooling_efficiency * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={params.cooling_efficiency}
              onChange={(e) => handleSliderChange('cooling_efficiency', e.target.value)}
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>10% (Weak)</span>
              <span>75% (Std)</span>
              <span>100% (Max)</span>
            </div>
          </div>

          {/* Battery Age & Cycles */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center text-[11px] text-slate-300 font-medium mb-1.5">
              <span>Battery Age / Cycles</span>
              <span className="font-mono text-indigo-400 font-bold">{params.battery_age}m &bull; {params.charging_cycles}c</span>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="6"
              value={params.battery_age}
              onChange={(e) => {
                const age = parseFloat(e.target.value);
                setParams((prev) => ({
                  ...prev,
                  battery_age: age,
                  charging_cycles: Math.round(age * 25),
                }));
              }}
              className="w-full accent-indigo-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>New (0m)</span>
              <span>24m</span>
              <span>60m (Aged)</span>
            </div>
          </div>

          {/* Simulation Duration */}
          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div className="flex justify-between items-center text-[11px] text-slate-300 font-medium mb-1.5">
              <span>Duration</span>
              <span className="font-mono text-blue-400 font-bold">{params.duration_minutes} Mins</span>
            </div>
            <input
              type="range"
              min="15"
              max="120"
              step="15"
              value={params.duration_minutes}
              onChange={(e) => handleSliderChange('duration_minutes', e.target.value)}
              className="w-full accent-blue-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>15m</span>
              <span>60m</span>
              <span>120m</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ─── 2. The Three Scenario Simulation Cards: 12A, 18A, 22A ─── */}
      {isLoaded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* ── 12A Simulation Card ── */}
          {(() => {
            const isSelected = selectedScenario === '12A' || selectedScenario === 'ALL';
            const isFocused = selectedScenario === '12A';
            const tempRise = +(sim12.max_temperature - sim12.initial_temperature).toFixed(1);
            const peakRisk = Math.max(...sim12.timeline.map((p) => p.risk_score));
            const peakRiskLevel = sim12.max_risk_level;

            return (
              <div
                onClick={() => setSelectedScenario(isFocused ? 'ALL' : '12A')}
                className={`border rounded-2xl p-5 cursor-pointer transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
                  isFocused
                    ? 'border-cyan-400 ring-2 ring-cyan-500/40 bg-slate-900 shadow-xl shadow-cyan-500/10'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                }`}
              >
                {isFocused && (
                  <div className="absolute top-0 right-0 bg-cyan-400 text-slate-950 text-[10px] uppercase font-black px-3 py-0.5 rounded-bl-xl tracking-wider">
                    Focused View
                  </div>
                )}

                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-white font-mono">12A</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                          Standard Current
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">12A Time Series Simulation</p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getRiskBadge(peakRiskLevel)}`}>
                    {peakRiskLevel} RISK
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 my-4">
                  {/* Battery Temperature & Rise */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
                      <Thermometer className="w-3.5 h-3.5 text-cyan-400" />
                      Peak Temp
                    </span>
                    <span className="text-lg font-black font-mono text-cyan-300 block">
                      {sim12.max_temperature.toFixed(1)}°C
                    </span>
                    <span className="text-[10px] text-cyan-400 font-mono">
                      Rise: +{tempRise > 0 ? tempRise : 0.0}°C
                    </span>
                  </div>

                  {/* Risk Value & Level */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-emerald-400" />
                      Peak Risk
                    </span>
                    <span className="text-lg font-black font-mono text-emerald-400 block">
                      {peakRisk.toFixed(1)} <span className="text-[10px] text-slate-500">/100</span>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono">
                      Level: {peakRiskLevel}
                    </span>
                  </div>

                  {/* Battery Condition / SOC */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                        <BatteryCharging className="w-3.5 h-3.5 text-cyan-400" />
                        Battery Condition / SOC
                      </span>
                      <span className="text-sm font-bold font-mono text-white mt-1 block">
                        Start: {sim12.initial_soc}% &rarr; Final: {sim12.final_soc}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-cyan-400 font-mono font-bold block">
                        +{(sim12.final_soc - sim12.initial_soc).toFixed(1)}% charged
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {sim12.time_to_80_soc_min ? `80% @ ${sim12.time_to_80_soc_min}m` : 'Stable thermal state'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>12A Thermal Status:</span>
                  <span className="font-bold text-cyan-400">Minimal Thermal Stress</span>
                </div>
              </div>
            );
          })()}

          {/* ── 18A Simulation Card ── */}
          {(() => {
            const isSelected = selectedScenario === '18A' || selectedScenario === 'ALL';
            const isFocused = selectedScenario === '18A';
            const tempRise = +(sim18.max_temperature - sim18.initial_temperature).toFixed(1);
            const peakRisk = Math.max(...sim18.timeline.map((p) => p.risk_score));
            const peakRiskLevel = sim18.max_risk_level;

            return (
              <div
                onClick={() => setSelectedScenario(isFocused ? 'ALL' : '18A')}
                className={`border rounded-2xl p-5 cursor-pointer transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
                  isFocused
                    ? 'border-amber-400 ring-2 ring-amber-500/40 bg-slate-900 shadow-xl shadow-amber-500/10'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                }`}
              >
                {isFocused && (
                  <div className="absolute top-0 right-0 bg-amber-400 text-slate-950 text-[10px] uppercase font-black px-3 py-0.5 rounded-bl-xl tracking-wider">
                    Focused View
                  </div>
                )}

                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-white font-mono">18A</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          Accelerated Current
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">18A Time Series Simulation</p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getRiskBadge(peakRiskLevel)}`}>
                    {peakRiskLevel} RISK
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 my-4">
                  {/* Battery Temperature & Rise */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
                      <Thermometer className="w-3.5 h-3.5 text-amber-400" />
                      Peak Temp
                    </span>
                    <span className="text-lg font-black font-mono text-amber-300 block">
                      {sim18.max_temperature.toFixed(1)}°C
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono">
                      Rise: +{tempRise > 0 ? tempRise : 0.0}°C
                    </span>
                  </div>

                  {/* Risk Value & Level */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                      Peak Risk
                    </span>
                    <span className="text-lg font-black font-mono text-amber-300 block">
                      {peakRisk.toFixed(1)} <span className="text-[10px] text-slate-500">/100</span>
                    </span>
                    <span className="text-[10px] text-amber-400 font-mono">
                      Level: {peakRiskLevel}
                    </span>
                  </div>

                  {/* Battery Condition / SOC */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                        <BatteryCharging className="w-3.5 h-3.5 text-amber-400" />
                        Battery Condition / SOC
                      </span>
                      <span className="text-sm font-bold font-mono text-white mt-1 block">
                        Start: {sim18.initial_soc}% &rarr; Final: {sim18.final_soc}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-amber-400 font-mono font-bold block">
                        +{(sim18.final_soc - sim18.initial_soc).toFixed(1)}% charged
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {sim18.time_to_80_soc_min ? `80% @ ${sim18.time_to_80_soc_min}m` : 'Balanced charge rate'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>18A Thermal Status:</span>
                  <span className="font-bold text-amber-400">Moderate Thermal Rise</span>
                </div>
              </div>
            );
          })()}

          {/* ── 22A Simulation Card ── */}
          {(() => {
            const isSelected = selectedScenario === '22A' || selectedScenario === 'ALL';
            const isFocused = selectedScenario === '22A';
            const tempRise = +(sim22.max_temperature - sim22.initial_temperature).toFixed(1);
            const peakRisk = Math.max(...sim22.timeline.map((p) => p.risk_score));
            const peakRiskLevel = sim22.max_risk_level;

            return (
              <div
                onClick={() => setSelectedScenario(isFocused ? 'ALL' : '22A')}
                className={`border rounded-2xl p-5 cursor-pointer transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${
                  isFocused
                    ? 'border-rose-500 ring-2 ring-rose-500/40 bg-slate-900 shadow-xl shadow-rose-500/10'
                    : 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                }`}
              >
                {isFocused && (
                  <div className="absolute top-0 right-0 bg-rose-500 text-white text-[10px] uppercase font-black px-3 py-0.5 rounded-bl-xl tracking-wider">
                    Focused View
                  </div>
                )}

                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-black text-white font-mono">22A</h3>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30">
                          High-Rate Fast Charge
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400">22A Time Series Simulation</p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getRiskBadge(peakRiskLevel)}`}>
                    {peakRiskLevel} RISK
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 my-4">
                  {/* Battery Temperature & Rise */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
                      <Thermometer className="w-3.5 h-3.5 text-rose-400" />
                      Peak Temp
                    </span>
                    <span className="text-lg font-black font-mono text-rose-400 block">
                      {sim22.max_temperature.toFixed(1)}°C
                    </span>
                    <span className="text-[10px] text-rose-400 font-mono">
                      Rise: +{tempRise > 0 ? tempRise : 0.0}°C
                    </span>
                  </div>

                  {/* Risk Value & Level */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1 mb-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      Peak Risk
                    </span>
                    <span className="text-lg font-black font-mono text-rose-400 block">
                      {peakRisk.toFixed(1)} <span className="text-[10px] text-slate-500">/100</span>
                    </span>
                    <span className="text-[10px] text-rose-400 font-mono">
                      Level: {peakRiskLevel}
                    </span>
                  </div>

                  {/* Battery Condition / SOC */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 col-span-2 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 flex items-center gap-1">
                        <BatteryCharging className="w-3.5 h-3.5 text-rose-400" />
                        Battery Condition / SOC
                      </span>
                      <span className="text-sm font-bold font-mono text-white mt-1 block">
                        Start: {sim22.initial_soc}% &rarr; Final: {sim22.final_soc}%
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-rose-400 font-mono font-bold block">
                        +{(sim22.final_soc - sim22.initial_soc).toFixed(1)}% charged
                      </span>
                      <span className="text-[10px] text-slate-500">
                        {sim22.time_to_80_soc_min ? `80% @ ${sim22.time_to_80_soc_min}m` : 'Elevated heat accumulation'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span>22A Thermal Status:</span>
                  <span className="font-bold text-rose-400">High Thermal Dissipation Load</span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ─── 3. Comparison Time-Series Graphs (Displaying 12A, 18A, and 22A Together) ─── */}
      {mergedTimeline.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Chart 1: Thermal Trajectory & Temperature Rise Comparison */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Thermometer className="w-4 h-4 text-amber-400" />
                  Thermal Trajectory Comparison (12A vs 18A vs 22A)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pack temperature (°C) progression over time against 45°C Warning and 52°C Critical limits
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono">
                <span className="flex items-center gap-1 text-cyan-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" /> 12A
                </span>
                <span className="flex items-center gap-1 text-amber-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> 18A
                </span>
                <span className="flex items-center gap-1 text-rose-400 font-bold">
                  <span className="w-2 h-2 rounded-full bg-rose-500" /> 22A
                </span>
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mergedTimeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time_min" stroke="#64748b" tickFormatter={(v) => `${v}m`} fontSize={11} />
                  <YAxis stroke="#64748b" domain={['dataMin - 3', 'dataMax + 6']} fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                    }}
                    labelFormatter={(label) => `Time: ${label} minutes`}
                    formatter={(val, name) => {
                      if (name === '12A Temp') return [`${val}°C (Rise: +${(val - sim12.initial_temperature).toFixed(1)}°C)`, name];
                      if (name === '18A Temp') return [`${val}°C (Rise: +${(val - sim18.initial_temperature).toFixed(1)}°C)`, name];
                      if (name === '22A Temp') return [`${val}°C (Rise: +${(val - sim22.initial_temperature).toFixed(1)}°C)`, name];
                      return [`${val}°C`, name];
                    }}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                  <ReferenceLine y={45} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Warn: 45°C', fill: '#f59e0b', fontSize: 10 }} />
                  <ReferenceLine y={52} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Critical: 52°C', fill: '#ef4444', fontSize: 10 }} />

                  {/* 12A Line */}
                  <Line
                    type="monotone"
                    dataKey="temp_12A"
                    name="12A Temp"
                    stroke="#22d3ee"
                    strokeWidth={selectedScenario === '12A' ? 4 : 2.5}
                    strokeOpacity={selectedScenario === 'ALL' || selectedScenario === '12A' ? 1 : 0.25}
                    dot={false}
                  />
                  {/* 18A Line */}
                  <Line
                    type="monotone"
                    dataKey="temp_18A"
                    name="18A Temp"
                    stroke="#fbbf24"
                    strokeWidth={selectedScenario === '18A' ? 4 : 2.5}
                    strokeOpacity={selectedScenario === 'ALL' || selectedScenario === '18A' ? 1 : 0.25}
                    dot={false}
                  />
                  {/* 22A Line */}
                  <Line
                    type="monotone"
                    dataKey="temp_22A"
                    name="22A Temp"
                    stroke="#f43f5e"
                    strokeWidth={selectedScenario === '22A' ? 4 : 3}
                    strokeOpacity={selectedScenario === 'ALL' || selectedScenario === '22A' ? 1 : 0.25}
                    dot={false}
                  />
                  {/* Ambient Temp Reference */}
                  <Line
                    type="monotone"
                    dataKey="ambient_temp"
                    name="Ambient"
                    stroke="#64748b"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Dynamic Risk Value & Battery Condition (SOC) Comparison */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  Risk Value &amp; Battery SOC Progression
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  State of Charge % curve (left axis) vs dynamic Risk score (0-100, right axis)
                </p>
              </div>
              <div className="text-[10px] font-mono text-slate-400">
                Left: SOC % &bull; Right: Risk Score
              </div>
            </div>

            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mergedTimeline} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time_min" stroke="#64748b" tickFormatter={(v) => `${v}m`} fontSize={11} />
                  <YAxis yAxisId="socAxis" stroke="#10b981" domain={[0, 100]} fontSize={11} tickFormatter={(v) => `${v}%`} />
                  <YAxis yAxisId="riskAxis" orientation="right" stroke="#f43f5e" domain={[0, 100]} fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '0.75rem',
                      fontSize: '12px',
                    }}
                    labelFormatter={(label) => `Time: ${label} minutes`}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />

                  {/* SOC Progression Lines (Left Axis) */}
                  <Line
                    yAxisId="socAxis"
                    type="monotone"
                    dataKey="soc_12A"
                    name="12A SOC (%)"
                    stroke="#10b981"
                    strokeWidth={selectedScenario === '12A' ? 3.5 : 2}
                    strokeDasharray="4 4"
                    strokeOpacity={selectedScenario === 'ALL' || selectedScenario === '12A' ? 1 : 0.25}
                    dot={false}
                  />
                  <Line
                    yAxisId="socAxis"
                    type="monotone"
                    dataKey="soc_18A"
                    name="18A SOC (%)"
                    stroke="#34d399"
                    strokeWidth={selectedScenario === '18A' ? 3.5 : 2}
                    strokeDasharray="4 4"
                    strokeOpacity={selectedScenario === 'ALL' || selectedScenario === '18A' ? 1 : 0.25}
                    dot={false}
                  />
                  <Line
                    yAxisId="socAxis"
                    type="monotone"
                    dataKey="soc_22A"
                    name="22A SOC (%)"
                    stroke="#6ee7b7"
                    strokeWidth={selectedScenario === '22A' ? 3.5 : 2}
                    strokeDasharray="4 4"
                    strokeOpacity={selectedScenario === 'ALL' || selectedScenario === '22A' ? 1 : 0.25}
                    dot={false}
                  />

                  {/* Risk Score Lines (Right Axis) */}
                  <Line
                    yAxisId="riskAxis"
                    type="monotone"
                    dataKey="risk_12A"
                    name="12A Risk (0-100)"
                    stroke="#38bdf8"
                    strokeWidth={selectedScenario === '12A' ? 3.5 : 2}
                    strokeOpacity={selectedScenario === 'ALL' || selectedScenario === '12A' ? 1 : 0.25}
                    dot={false}
                  />
                  <Line
                    yAxisId="riskAxis"
                    type="monotone"
                    dataKey="risk_18A"
                    name="18A Risk (0-100)"
                    stroke="#fbbf24"
                    strokeWidth={selectedScenario === '18A' ? 3.5 : 2}
                    strokeOpacity={selectedScenario === 'ALL' || selectedScenario === '18A' ? 1 : 0.25}
                    dot={false}
                  />
                  <Line
                    yAxisId="riskAxis"
                    type="monotone"
                    dataKey="risk_22A"
                    name="22A Risk (0-100)"
                    stroke="#f43f5e"
                    strokeWidth={selectedScenario === '22A' ? 4 : 2.5}
                    strokeOpacity={selectedScenario === 'ALL' || selectedScenario === '22A' ? 1 : 0.25}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ─── 4. Temperature / Risk Comparison Summary Matrix ─── */}
      {isLoaded && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Temperature &amp; Risk Comparison Matrix (12A vs 18A vs 22A)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-2.5 py-0.5 rounded-full">
              Identical Input Baseline
            </span>
          </div>

          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                  <th className="py-2.5 px-3">Evaluation Parameter</th>
                  <th className="py-2.5 px-3 text-cyan-400">12A Simulation</th>
                  <th className="py-2.5 px-3 text-amber-400">18A Simulation</th>
                  <th className="py-2.5 px-3 text-rose-400">22A Simulation</th>
                  <th className="py-2.5 px-3 text-slate-300">Charging Current Impact / Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {/* Charging Current */}
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 px-3 font-medium text-slate-300">Charging Current</td>
                  <td className="py-2.5 px-3 font-bold text-cyan-300">12.0 A</td>
                  <td className="py-2.5 px-3 font-bold text-amber-300">18.0 A</td>
                  <td className="py-2.5 px-3 font-bold text-rose-300">22.0 A</td>
                  <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                    Baseline vs +50% vs +83.3% higher electrical flow
                  </td>
                </tr>

                {/* Peak Battery Temperature */}
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 px-3 font-medium text-slate-300">Peak Battery Temperature</td>
                  <td className="py-2.5 px-3 font-bold text-white">{sim12.max_temperature.toFixed(1)} °C</td>
                  <td className="py-2.5 px-3 font-bold text-white">{sim18.max_temperature.toFixed(1)} °C</td>
                  <td className="py-2.5 px-3 font-bold text-rose-300">{sim22.max_temperature.toFixed(1)} °C</td>
                  <td className="py-2.5 px-3 text-rose-400 text-[11px]">
                    +{(sim22.max_temperature - sim12.max_temperature).toFixed(1)} °C higher heating at 22A
                  </td>
                </tr>

                {/* Temperature Rise Over Time */}
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 px-3 font-medium text-slate-300">Temperature Rise Over Time (&Delta;T)</td>
                  <td className="py-2.5 px-3 text-cyan-300 font-bold">
                    +{(sim12.max_temperature - sim12.initial_temperature).toFixed(1)} °C
                  </td>
                  <td className="py-2.5 px-3 text-amber-300 font-bold">
                    +{(sim18.max_temperature - sim18.initial_temperature).toFixed(1)} °C
                  </td>
                  <td className="py-2.5 px-3 text-rose-400 font-bold">
                    +{(sim22.max_temperature - sim22.initial_temperature).toFixed(1)} °C
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                    Steeper thermal gradient due to I&sup2;&middot;R Joule heating
                  </td>
                </tr>

                {/* Peak Risk Value */}
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 px-3 font-medium text-slate-300">Peak Risk Value</td>
                  <td className="py-2.5 px-3 font-bold text-emerald-400">
                    {Math.max(...sim12.timeline.map((p) => p.risk_score)).toFixed(1)} / 100
                  </td>
                  <td className="py-2.5 px-3 font-bold text-amber-300">
                    {Math.max(...sim18.timeline.map((p) => p.risk_score)).toFixed(1)} / 100
                  </td>
                  <td className="py-2.5 px-3 font-bold text-rose-400">
                    {Math.max(...sim22.timeline.map((p) => p.risk_score)).toFixed(1)} / 100
                  </td>
                  <td className="py-2.5 px-3 text-amber-400 text-[11px]">
                    +{(Math.max(...sim22.timeline.map((p) => p.risk_score)) - Math.max(...sim12.timeline.map((p) => p.risk_score))).toFixed(1)} point escalation in AI risk index
                  </td>
                </tr>

                {/* Peak Risk Level */}
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 px-3 font-medium text-slate-300">Peak Risk Level</td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadge(sim12.max_risk_level)}`}>
                      {sim12.max_risk_level}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadge(sim18.max_risk_level)}`}>
                      {sim18.max_risk_level}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRiskBadge(sim22.max_risk_level)}`}>
                      {sim22.max_risk_level}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                    {sim22.max_risk_level === sim12.max_risk_level ? 'Same safety bracket' : 'Safety tier escalation'}
                  </td>
                </tr>

                {/* Battery Condition / Final SOC */}
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 px-3 font-medium text-slate-300">Battery Condition / Final SOC</td>
                  <td className="py-2.5 px-3 text-cyan-300 font-bold">{sim12.final_soc}%</td>
                  <td className="py-2.5 px-3 text-amber-300 font-bold">{sim18.final_soc}%</td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">{sim22.final_soc}%</td>
                  <td className="py-2.5 px-3 text-emerald-400 text-[11px]">
                    22A achieves +{(sim22.final_soc - sim12.final_soc).toFixed(1)}% higher SOC within {params.duration_minutes}m
                  </td>
                </tr>

                {/* Time to 80% SOC Fast Charge */}
                <tr className="hover:bg-slate-800/30 transition">
                  <td className="py-2.5 px-3 font-medium text-slate-300">Time to 80% SOC Fast Charge</td>
                  <td className="py-2.5 px-3 text-slate-300">
                    {sim12.time_to_80_soc_min ? `${sim12.time_to_80_soc_min} min` : `> ${params.duration_minutes}m`}
                  </td>
                  <td className="py-2.5 px-3 text-slate-300">
                    {sim18.time_to_80_soc_min ? `${sim18.time_to_80_soc_min} min` : `> ${params.duration_minutes}m`}
                  </td>
                  <td className="py-2.5 px-3 text-emerald-400 font-bold">
                    {sim22.time_to_80_soc_min ? `${sim22.time_to_80_soc_min} min` : `> ${params.duration_minutes}m`}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                    Tradeoff: 22A charges quickest, but incurs higher heat load
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

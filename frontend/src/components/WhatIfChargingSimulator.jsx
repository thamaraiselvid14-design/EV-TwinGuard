import React, { useState, useEffect } from 'react';
import { simulateCharging } from '../services/api';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import { 
  Zap, 
  Play, 
  RotateCcw, 
  Thermometer, 
  Gauge, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldCheck, 
  Flame, 
  Layers,
  ArrowRight,
  Info
} from 'lucide-react';

const DEFAULT_STATE = {
  battery_id: 'EV001',
  soc: 80.0,
  voltage: 405.0,
  charging_current: 18.0,
  current_temperature: 35.0,
  ambient_temperature: 28.0,
  battery_age: 12.0,
  charging_cycles: 300,
};

export default function WhatIfChargingSimulator({ currentBatteryState }) {
  const [batteryState, setBatteryState] = useState(DEFAULT_STATE);
  const [selectedCurrent, setSelectedCurrent] = useState(18.0);
  const [simulationData, setSimulationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Sync state if dashboard provides active twin data
  useEffect(() => {
    if (currentBatteryState) {
      const parseVal = (v, def) => (v !== '' && v != null && !isNaN(Number(v)) ? parseFloat(v) : def);
      const parseIntVal = (v, def) => (v !== '' && v != null && !isNaN(Number(v)) ? parseInt(v, 10) : def);
      setBatteryState({
        battery_id: currentBatteryState.battery_id || 'EV001',
        soc: parseVal(currentBatteryState.soc, 80.0),
        voltage: parseVal(currentBatteryState.voltage, 405.0),
        charging_current: parseVal(currentBatteryState.charging_current, 18.0),
        current_temperature: parseVal(currentBatteryState.current_temperature ?? currentBatteryState.battery_temperature, 35.0),
        ambient_temperature: parseVal(currentBatteryState.ambient_temperature, 28.0),
        battery_age: parseVal(currentBatteryState.battery_age, 12.0),
        charging_cycles: parseIntVal(currentBatteryState.charging_cycles, 300),
      });
    }
  }, [currentBatteryState]);

  const handleRunSimulation = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await simulateCharging(batteryState);
      setSimulationData(res);
    } catch (err) {
      setError(err.message || 'Failed to execute What-If Charging Simulation.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleRunSimulation();
  }, []);

  // Format data for Recharts comparison
  const chartData = simulationData?.scenarios?.map((s) => ({
    name: `${s.charging_current}A`,
    current: s.charging_current,
    predictedTemp: s.predicted_future_temperature,
    riskScore: s.risk_score,
    riskLevel: s.risk_level,
  })) || [];

  const activeScenario = simulationData?.scenarios?.find(
    (s) => Math.abs(s.charging_current - selectedCurrent) < 0.1
  ) || simulationData?.scenarios?.[1] || null;

  return (
    <div className="space-y-6">
      {/* Top Banner & Control Panel */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-56 h-56 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-950/50 border border-cyan-800/50 text-cyan-400 text-xs font-semibold mb-2">
              <Zap className="w-3.5 h-3.5" />
              Phase 5: What-If Charging Simulator
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white uppercase">
              WHAT-IF CHARGING SIMULATOR
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Compare battery thermal and safety behavior at different charging currents.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Quick Charging Current Selector Buttons */}
            <div className="flex items-center gap-1.5 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
              <span className="text-[11px] text-slate-400 px-2 font-medium">Select Current:</span>
              {[12.0, 18.0, 25.0].map((curr) => (
                <button
                  key={curr}
                  onClick={() => setSelectedCurrent(curr)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition ${
                    Math.abs(selectedCurrent - curr) < 0.1
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {curr} A
                </button>
              ))}
            </div>

            {/* Compare All Scenarios Trigger Button */}
            <button
              onClick={handleRunSimulation}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-lg shadow-cyan-500/25 transition disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RotateCcw className="w-4 h-4 animate-spin" />
                  Simulating...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Compare All Scenarios
                </>
              )}
            </button>
          </div>
        </div>

        {/* Current Reference Battery State Strip */}
        <div className="mt-4 pt-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Battery Pack</span>
            <span className="text-white font-mono font-bold">{batteryState.battery_id}</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">State of Charge</span>
            <span className="text-emerald-400 font-mono font-bold">{batteryState.soc}%</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Pack Voltage</span>
            <span className="text-slate-300 font-mono font-bold">{batteryState.voltage} V</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Current Temp</span>
            <span className="text-amber-400 font-mono font-bold">{batteryState.current_temperature}°C</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Ambient Temp</span>
            <span className="text-blue-400 font-mono font-bold">{batteryState.ambient_temperature}°C</span>
          </div>
          <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="text-slate-500 block text-[10px] uppercase font-semibold">Age / Cycles</span>
            <span className="text-purple-400 font-mono font-bold">{batteryState.battery_age}m / {batteryState.charging_cycles}c</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3 Comparison Scenario Cards (12A, 18A, 25A) */}
      {simulationData && simulationData.scenarios && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {simulationData.scenarios.map((scenario) => {
            const isSelected = Math.abs(scenario.charging_current - selectedCurrent) < 0.1;
            const isHigh = scenario.risk_level === 'HIGH';
            const isMed = scenario.risk_level === 'MEDIUM';

            const badgeBg = isHigh
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : isMed
              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
              : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';

            const cardBorder = isSelected
              ? 'border-cyan-400/80 ring-2 ring-cyan-500/30 bg-slate-900'
              : 'border-slate-800 bg-slate-900/80 hover:border-slate-700';

            return (
              <div
                key={scenario.charging_current}
                onClick={() => setSelectedCurrent(scenario.charging_current)}
                className={`border rounded-2xl p-5 cursor-pointer transition-all duration-300 relative overflow-hidden backdrop-blur-xl ${cardBorder}`}
              >
                {isSelected && (
                  <div className="absolute top-0 right-0 bg-cyan-500 text-slate-950 text-[10px] uppercase font-extrabold px-3 py-0.5 rounded-bl-xl tracking-wider">
                    Selected
                  </div>
                )}

                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white font-mono">
                        {scenario.charging_current} A
                      </h3>
                      <p className="text-[11px] text-slate-400">Charging Current</p>
                    </div>
                  </div>

                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badgeBg}`}>
                    {scenario.risk_level}
                  </span>
                </div>

                <div className="my-4 space-y-3">
                  {/* Predicted Future Temp */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      <Thermometer className="w-4 h-4 text-amber-400" />
                      <span>Predicted Temperature</span>
                    </div>
                    <span className="text-lg font-black font-mono text-white">
                      {scenario.predicted_future_temperature.toFixed(1)} °C
                    </span>
                  </div>

                  {/* Risk Score */}
                  <div className="bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-slate-300">
                      <Gauge className="w-4 h-4 text-cyan-400" />
                      <span>Risk Score</span>
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-black font-mono text-white">
                        {scenario.risk_score.toFixed(1)}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono"> / 100</span>
                    </div>
                  </div>
                </div>

                {/* Main Risk Factors */}
                <div className="pt-2 border-t border-slate-800 text-xs">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block mb-1.5">
                    Main Risk Factors:
                  </span>
                  <div className="space-y-1">
                    {scenario.main_risk_factors.slice(0, 2).map((factor, fIdx) => (
                      <div key={fIdx} className="text-[11px] text-slate-300 flex items-center gap-1.5">
                        <span className="text-cyan-400 font-bold">&bull;</span>
                        <span>{factor}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Comparison Chart & Detailed Selected Scenario View */}
      {simulationData && simulationData.scenarios && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Recharts Comparison Chart */}
          <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
            <h3 className="text-sm font-bold text-white mb-1 flex items-center gap-2">
              <Thermometer className="w-4 h-4 text-amber-400" />
              Charging Current vs Predicted Future Temperature
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Side-by-side comparison of thermal rise and safety limits across 12A, 18A, and 25A
            </p>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                  <YAxis yAxisId="left" stroke="#38bdf8" domain={['dataMin - 5', 'dataMax + 8']} fontSize={11} />
                  <YAxis yAxisId="right" orientation="right" stroke="#f43f5e" domain={[0, 100]} fontSize={11} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '0.75rem', fontSize: '12px' }}
                    formatter={(val, name) => [
                      name === 'predictedTemp' ? `${val}°C` : `${val}/100`,
                      name === 'predictedTemp' ? 'Predicted Temp' : 'Risk Score'
                    ]}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '12px' }} />
                  <ReferenceLine yAxisId="left" y={42} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Warn: 42°C', fill: '#f59e0b', fontSize: 10 }} />
                  <ReferenceLine yAxisId="left" y={50} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'Critical: 50°C', fill: '#f43f5e', fontSize: 10 }} />
                  <Bar yAxisId="left" dataKey="predictedTemp" name="Predicted Temp (°C)" fill="#38bdf8" radius={[6, 6, 0, 0]} barSize={38} />
                  <Line yAxisId="right" type="monotone" dataKey="riskScore" name="Risk Score (0-100)" stroke="#f43f5e" strokeWidth={3} dot={{ r: 5 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Selected Scenario Breakdown */}
          {activeScenario && (
            <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl backdrop-blur-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                    <Info className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">
                      Scenario Detail: {activeScenario.charging_current} A
                    </h4>
                    <p className="text-[11px] text-slate-400">In-Depth Diagnostic Breakdown</p>
                  </div>
                </div>

                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                  activeScenario.risk_level === 'HIGH'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : activeScenario.risk_level === 'MEDIUM'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                }`}>
                  {activeScenario.risk_level} RISK
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80">
                  <span className="text-slate-400">Thermal Delta from Current:</span>
                  <span className={`font-mono font-bold ${
                    (activeScenario.predicted_future_temperature - batteryState.current_temperature) > 0
                      ? 'text-amber-400'
                      : 'text-emerald-400'
                  }`}>
                    {(activeScenario.predicted_future_temperature - batteryState.current_temperature) > 0 ? '+' : ''}
                    {(activeScenario.predicted_future_temperature - batteryState.current_temperature).toFixed(1)} °C
                  </span>
                </div>

                <div>
                  <h5 className="text-[11px] uppercase font-semibold text-slate-400 tracking-wider mb-1.5">
                    Identified Risk Factors:
                  </h5>
                  <ul className="space-y-1">
                    {activeScenario.main_risk_factors.map((factor, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5 bg-slate-950/40 p-2 rounded-lg border border-slate-800/60">
                        <span className="text-cyan-400 font-bold mt-0.5">&bull;</span>
                        <span>{factor}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                    BMS Strategy Note:
                  </span>
                  <p className="text-slate-300">
                    {activeScenario.charging_current === 12.0
                      ? 'Lowest thermal stress mode. Maximizes cycle life and maintains thermal equilibrium near ambient.'
                      : activeScenario.charging_current === 18.0
                      ? 'Balanced standard charging. Provides good charging throughput with moderate thermal rise.'
                      : 'Fast charging rate. Higher Joule heating; ensure liquid coolant flow is active.'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

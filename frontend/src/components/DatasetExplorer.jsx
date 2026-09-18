import React, { useState, useEffect } from 'react';
import { getDatasetSample } from '../services/api';
import { Database, Search, Filter, RefreshCw, ArrowUpRight, BarChart2, Layers } from 'lucide-react';

export default function DatasetExplorer({ onSelectRecord }) {
  const [sampleData, setSampleData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [socFilter, setSocFilter] = useState('ALL');

  const fetchSamples = async (count = 15) => {
    setLoading(true);
    try {
      const res = await getDatasetSample(count);
      if (res && res.data) {
        setSampleData(res.data);
      }
    } catch (err) {
      console.error('Failed to load dataset records:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSamples(15);
  }, []);

  const filtered = sampleData.filter((row) => {
    const matchesId = row.battery_id ? row.battery_id.toLowerCase().includes(searchTerm.toLowerCase()) : true;
    if (!matchesId) return false;
    if (socFilter === 'HIGH') return row.soc > 75;
    if (socFilter === 'LOW') return row.soc < 30;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-950/50 border border-indigo-800/50 text-indigo-400 text-xs font-semibold mb-2">
              <Database className="w-3.5 h-3.5" />
              Big Data Layer: 1,000,000+ Record Stream
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white">
              Fleet Telemetry Dataset Explorer
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Inspect raw streamed battery records, preserved telemetry channels, and feed historical profiles into the AI Twin.
            </p>
          </div>

          <button
            onClick={() => fetchSamples(15)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Sample New Batch
          </button>
        </div>

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-800">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search Battery ID (e.g. EV-SYN-0004)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium">SOC Filter:</span>
            {['ALL', 'HIGH (>75%)', 'LOW (<30%)'].map((opt) => {
              const val = opt.startsWith('HIGH') ? 'HIGH' : opt.startsWith('LOW') ? 'LOW' : 'ALL';
              return (
                <button
                  key={val}
                  onClick={() => setSocFilter(val)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                    socFilter === val
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          <div className="text-right flex items-center justify-end text-xs text-slate-400">
            Showing <span className="text-white font-bold font-mono px-1.5">{filtered.length}</span> of {sampleData.length} records
          </div>
        </div>
      </div>

      {/* Tabular Inspector */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-mono text-[11px] border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">Battery ID</th>
                <th className="px-4 py-3.5">SOC (%)</th>
                <th className="px-4 py-3.5">Voltage (V)</th>
                <th className="px-4 py-3.5">Current (A)</th>
                <th className="px-4 py-3.5">Pack Temp (°C)</th>
                <th className="px-4 py-3.5">Ambient (°C)</th>
                <th className="px-4 py-3.5">Age / Cycles</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filtered.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-800/40 transition">
                  <td className="px-4 py-3 font-mono font-bold text-white flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    {row.battery_id}
                  </td>
                  <td className="px-4 py-3 font-mono">
                    <span className={`px-2 py-0.5 rounded font-semibold ${
                      row.soc > 80 ? 'bg-amber-950/60 text-amber-400 border border-amber-800/40' : 'text-slate-200'
                    }`}>
                      {row.soc}%
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono">{row.voltage} V</td>
                  <td className="px-4 py-3 font-mono text-cyan-300 font-semibold">{row.charging_current} A</td>
                  <td className="px-4 py-3 font-mono">
                    <span className={`px-2 py-0.5 rounded font-semibold ${
                      row.battery_temperature > 45 ? 'bg-rose-950/60 text-rose-400 border border-rose-800/40' : 'text-slate-200'
                    }`}>
                      {row.battery_temperature}°C
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-400">{row.ambient_temperature}°C</td>
                  <td className="px-4 py-3 font-mono text-slate-400">
                    {row.battery_age}m / {row.charging_cycles}c
                  </td>
                  <td className="px-4 py-3 text-right">
                    {onSelectRecord && (
                      <button
                        onClick={() => onSelectRecord(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition"
                      >
                        Load Twin <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { 
  ChartNoAxesCombined, Calendar, Download, RefreshCw, CheckCircle2, 
  Clock, Flame, Users, Layers, TrendingUp 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, LineChart, Line, Legend 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { requestAnalytics, agentRunsData, memberPerformanceData } from '../../data/mock';

interface AnalyticsProps {
  isDark: boolean;
}

export default function Analytics({ isDark }: AnalyticsProps) {
  const [dateRange, setDateRange] = useState('7d');
  const [isExporting, setIsExporting] = useState(false);
  const [exportNotification, setExportNotification] = useState<string | null>(null);

  // Handle mock CSV export
  const triggerExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportNotification('Operational CSV analytics report successfully compiled and downloaded to secure workspace folder.');
      setTimeout(() => setExportNotification(null), 5000);
    }, 1200);
  };

  // Custom tooltips
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`p-3 rounded-lg border text-xs shadow-xl font-sans ${
          isDark ? 'bg-[#111113] border-[#27272A] text-white' : 'bg-white border-[#E4E4E7] text-zinc-900'
        }`}>
          <p className="font-semibold">{payload[0].name}</p>
          {payload.map((item: any, i: number) => (
            <p key={i} className="mt-1" style={{ color: item.color || item.stroke }}>
              {item.name}: {item.value.toLocaleString()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold tracking-tight flex items-center gap-2 text-zinc-900 dark:text-white">
            <ChartNoAxesCombined className="h-5 w-5 text-brand-blue" />
            Analytics Engine
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Monitor real-time network throughput, agentic task cycles, and performance percentiles
          </p>
        </div>

        {/* Date Selector and export */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto text-xs">
          <div className="flex items-center gap-1.5 p-1 rounded-md border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B]">
            {['24h', '7d', '30d'].map((range) => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                className={`px-2 py-1 rounded text-[10px] font-semibold uppercase transition-all cursor-pointer ${
                  dateRange === range
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-950'
                    : 'text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200'
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          <button
            onClick={triggerExport}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-200 font-medium hover:border-zinc-350 dark:hover:border-zinc-700 transition-colors cursor-pointer"
          >
            {isExporting ? 'Compiling...' : 'Export'}
            <Download className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Export notification banner */}
      <AnimatePresence>
        {exportNotification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 text-emerald-500 text-xs flex items-center gap-2"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{exportNotification}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overview stats strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-zinc-50/50 dark:bg-zinc-900/30 p-4 rounded-lg border border-zinc-200/50 dark:border-zinc-800/80">
        {[
          { label: 'Avg Latency', val: '54.2 ms', sub: '95th percentile', icon: Clock, color: 'text-brand-blue' },
          { label: 'Sovereign Error Rate', val: '0.42%', sub: 'Healthy limits', icon: Flame, color: 'text-red-500' },
          { label: 'Daily Gas Swaps', val: '4,102 STLR', sub: '+18.4% usage', icon: TrendingUp, color: 'text-emerald-500' },
          { label: 'Total API Calls', val: '1.24 Million', sub: 'Across 6 services', icon: Layers, color: 'text-brand-purple' }
        ].map((stat) => (
          <div key={stat.label} className="space-y-1">
            <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider block font-sans">{stat.label}</span>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-semibold text-zinc-900 dark:text-white font-sans">{stat.val}</span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500 font-sans">{stat.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Requests & Latency Profile */}
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B]">
          <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-4 font-sans">Traffic Load & Latency profile</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={requestAnalytics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorReqVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1F1F23' : '#F1F1F4'} vertical={false} />
                <XAxis dataKey="name" stroke={isDark ? '#4F4F56' : '#A1A1AA'} fontSize={10} tickLine={false} />
                <YAxis stroke={isDark ? '#4F4F56' : '#A1A1AA'} fontSize={10} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="requests" stroke="#3B82F6" name="HTTP Requests" strokeWidth={1.5} fillOpacity={1} fill="url(#colorReqVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Latency percentile profile */}
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B]">
          <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-4 font-sans">Gateway Latency Curve (ms)</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={requestAnalytics} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1F1F23' : '#F1F1F4'} vertical={false} />
                <XAxis dataKey="name" stroke={isDark ? '#4F4F56' : '#A1A1AA'} fontSize={10} tickLine={false} />
                <YAxis stroke={isDark ? '#4F4F56' : '#A1A1AA'} fontSize={10} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="latency" name="Latency (ms)" stroke="#8B5CF6" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Agent runs by type over time */}
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B]">
          <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-4 font-sans">Agent task cycle metrics</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agentRunsData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1F1F23' : '#F1F1F4'} vertical={false} />
                <XAxis dataKey="name" stroke={isDark ? '#4F4F56' : '#A1A1AA'} fontSize={10} tickLine={false} />
                <YAxis stroke={isDark ? '#4F4F56' : '#A1A1AA'} fontSize={10} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, marginTop: 10 }} />
                <Bar dataKey="transform" name="Transformation" fill="#FFFFFF" stackId="a" />
                <Bar dataKey="deploy" name="Deploy Prep" fill="#3B82F6" stackId="a" />
                <Bar dataKey="audit" name="Vulnerability audit" fill="#7C3AED" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 4: Usage by workspace member */}
        <div className="p-4 rounded-lg border border-zinc-200 dark:border-[#27272A] bg-white dark:bg-[#0A0A0B]">
          <h3 className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wide mb-4 font-sans">Workspace member contribution shares</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={memberPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1F1F23' : '#F1F1F4'} vertical={false} />
                <XAxis dataKey="name" stroke={isDark ? '#4F4F56' : '#A1A1AA'} fontSize={10} tickLine={false} />
                <YAxis stroke={isDark ? '#4F4F56' : '#A1A1AA'} fontSize={10} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 10, marginTop: 10 }} />
                <Bar dataKey="runs" name="Completed Agent Runs" fill="#10B981" />
                <Bar dataKey="projects" name="Allocated Nodes" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

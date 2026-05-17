import { useState, useEffect } from 'react';
import AppSidebar from './AppSidebar';
import { Loader2, AlertTriangle, TrendingUp, Users, Target, AlertCircle, CheckCircle2, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  LineChart, Line, Legend, Cell, PieChart, Pie,
} from 'recharts';
import type { UserRole, Page } from '../types';

interface AnalyticsProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  userRole: UserRole;
}

const QUARTER_COLORS: Record<string, string> = {
  q1: '#1D9E75',
  q2: '#7F77DD',
  q3: '#BA7517',
  q4: '#D85A30',
};
const DEFAULT_COLORS = ['#1D9E75', '#7F77DD', '#BA7517', '#D85A30', '#2563eb', '#9333ea', '#0891b2', '#16a34a'];

// ── Helpers ───────────────────────────────────────────────────
function getHeatColor(score: number | null): string {
  if (score === null) return '#E5E7EB';
  if (score >= 80) return '#1D9E75';
  if (score >= 60) return '#9FE1CB';
  if (score >= 40) return '#EF9F27';
  return '#D85A30';
}

function getHeatTextColor(score: number | null): string {
  if (score === null) return '#9CA3AF';
  if (score >= 40) return '#fff';
  return '#fff';
}

function getBarColor(pct: number): string {
  if (pct >= 80) return '#1D9E75';
  if (pct >= 50) return '#EF9F27';
  return '#D85A30';
}

function getSeverityColor(severity: string): string {
  if (severity === 'high') return '#D85A30';
  if (severity === 'medium') return '#EF9F27';
  return '#6B7280';
}

// Custom tooltip for line chart
function QoQTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}>
      <p style={{ fontWeight: 700, marginBottom: 6, color: '#111827' }}>{label?.toUpperCase()}</p>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: p.color }} />
          <span style={{ fontSize: 13, color: '#374151' }}>{p.name}: {p.value !== null ? `${Math.round(p.value)}%` : 'N/A'}</span>
        </div>
      ))}
    </div>
  );
}

export default function Analytics({ onNavigate, onLogout, userRole }: AnalyticsProps) {
  const [heatmapData, setHeatmapData] = useState<any[]>([]);
  const [qoqData, setQoqData] = useState<any[]>([]);
  const [distributionData, setDistributionData] = useState<{ by_thrust_area: any[], by_uom_type: any[] }>({ by_thrust_area: [], by_uom_type: [] });
  const [managerData, setManagerData] = useState<any[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'heatmap' | 'trends' | 'distribution' | 'managers' | 'anomalies'>('heatmap');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const { default: api } = await import('../../lib/api');

        const requests = [
          api.get('/api/analytics/heatmap').catch(() => ({ data: null })),
          api.get('/api/analytics/qoq-trend').catch(() => ({ data: null })),
          api.get('/api/analytics/distribution').catch(() => ({ data: null })),
          api.get('/api/analytics/anomalies').catch(() => ({ data: null })),
        ];

        // Manager effectiveness only for admin
        const extraRequests = userRole === 'admin'
          ? [api.get('/api/analytics/manager-effectiveness').catch(() => ({ data: null }))]
          : [Promise.resolve({ data: null })];

        const [heatRes, qoqRes, distRes, anomRes, mgrRes] = await Promise.all([...requests, ...extraRequests]);

        // Heatmap: response is { heatmap: [...] }
        setHeatmapData(heatRes.data?.heatmap || []);

        // QoQ: response is { trends: [ { employee_id, name, trend: [{quarter, avg_score}] } ] }
        // Transform into format suitable for LineChart: array of { quarter, [empName]: score }
        const trends = qoqRes.data?.trends || [];
        const qoqForChart = ['q1', 'q2', 'q3', 'q4'].map(q => {
          const point: any = { quarter: q.toUpperCase() };
          for (const emp of trends) {
            const t = emp.trend.find((x: any) => x.quarter === q);
            point[emp.name] = t?.avg_score ?? null;
          }
          return point;
        });
        setQoqData({ employees: trends.map((e: any) => e.name), points: qoqForChart } as any);

        // Distribution: { by_thrust_area, by_uom_type }
        setDistributionData({
          by_thrust_area: distRes.data?.by_thrust_area || [],
          by_uom_type: distRes.data?.by_uom_type || [],
        });

        // Anomalies: { anomalies: [...] }
        setAnomalies(anomRes.data?.anomalies || []);

        // Manager effectiveness: { managers: [...] }
        setManagerData(mgrRes.data?.managers || []);

      } catch (err) {
        console.error('[Analytics] Failed to load:', err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [userRole]);

  const tabs = [
    { id: 'heatmap', label: 'Performance Heatmap', icon: '🟩', roles: ['manager', 'admin'] },
    { id: 'trends', label: 'QoQ Trends', icon: '📈', roles: ['employee', 'manager', 'admin'] },
    { id: 'distribution', label: 'Goal Distribution', icon: '🎯', roles: ['manager', 'admin'] },
    { id: 'managers', label: 'Manager Effectiveness', icon: '👥', roles: ['admin'] },
    { id: 'anomalies', label: `Anomalies${anomalies.length > 0 ? ` (${anomalies.length})` : ''}`, icon: '⚠️', roles: ['manager', 'admin'] },
  ].filter(t => t.roles.includes(userRole));

  // QoQ chart uses a nested structure
  const qoqChartData = (qoqData as any)?.points || [];
  const qoqEmployees = (qoqData as any)?.employees || [];

  return (
    <div className="flex h-screen bg-[#F8FAF9]">
      <AppSidebar currentPage="analytics" onNavigate={onNavigate} onLogout={onLogout} userRole={userRole} />

      <div className="flex-1 overflow-auto">
        {/* Page Header */}
        <div className="bg-white border-b border-gray-200 px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">FY 2025-26 · Live data from active cycle</p>
            </div>
            {anomalies.length > 0 && (
              <div
                className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-lg cursor-pointer hover:bg-red-100 transition-colors"
                onClick={() => setActiveTab('anomalies')}
              >
                <AlertCircle size={16} className="text-red-600" />
                <span className="text-sm font-semibold text-red-700">{anomalies.length} Anomaly{anomalies.length !== 1 ? 'ies' : ''} Detected</span>
              </div>
            )}
          </div>

          {/* Tab Bar */}
          <div className="flex gap-1 mt-5 -mb-5 border-b border-gray-200">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-[#1D9E75] text-[#1D9E75]'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>{tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-8">
          {isLoading ? (
            <div className="flex justify-center items-center py-32">
              <div className="text-center">
                <Loader2 className="animate-spin text-[#1D9E75] mx-auto mb-3" size={40} />
                <p className="text-gray-500 text-sm">Loading analytics…</p>
              </div>
            </div>
          ) : (
            <>
              {/* ── Tab: Performance Heatmap ── */}
              {activeTab === 'heatmap' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Employee Performance Heatmap</h3>
                  <p className="text-sm text-gray-500 mb-5">Average checkin score per employee per quarter</p>
                  {heatmapData.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <Target size={40} className="mx-auto mb-3 opacity-30" />
                      <p>No checkin data available yet for this cycle.</p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr>
                              <th className="text-left text-xs font-semibold text-gray-500 uppercase pb-3 pr-6" style={{ minWidth: 160 }}>Employee</th>
                              <th className="text-xs font-semibold text-gray-500 uppercase pb-3 px-2" style={{ minWidth: 90 }}>Department</th>
                              {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                                <th key={q} className="text-center text-xs font-semibold text-gray-500 uppercase pb-3 px-3" style={{ minWidth: 80 }}>{q}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {heatmapData.map((row: any) => (
                              <tr key={row.employee_id || row.name} className="hover:bg-gray-50">
                                <td className="py-2 pr-6 text-sm font-medium text-gray-900">{row.name}</td>
                                <td className="py-2 px-2 text-xs text-gray-500">{row.department}</td>
                                {['q1', 'q2', 'q3', 'q4'].map(q => (
                                  <td key={q} className="py-2 px-3">
                                    <div
                                      title={row[q] !== null ? `${q.toUpperCase()}: ${Math.round(row[q])}%` : `${q.toUpperCase()}: No data`}
                                      className="w-full h-10 rounded-lg flex items-center justify-center text-xs font-bold transition-all cursor-default"
                                      style={{
                                        backgroundColor: getHeatColor(row[q]),
                                        color: getHeatTextColor(row[q]),
                                      }}
                                    >
                                      {row[q] !== null ? `${Math.round(row[q])}%` : '–'}
                                    </div>
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {/* Legend */}
                      <div className="flex items-center gap-6 mt-5 text-xs text-gray-500 flex-wrap">
                        {[
                          { color: '#1D9E75', label: '≥ 80%' },
                          { color: '#9FE1CB', label: '60–79%' },
                          { color: '#EF9F27', label: '40–59%' },
                          { color: '#D85A30', label: '< 40%' },
                          { color: '#E5E7EB', label: 'No data' },
                        ].map(({ color, label }) => (
                          <div key={label} className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded" style={{ backgroundColor: color }} />
                            <span>{label}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Tab: QoQ Trends ── */}
              {activeTab === 'trends' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={20} className="text-[#1D9E75]" />
                    <h3 className="text-lg font-semibold text-gray-900">Quarter-over-Quarter Score Trends</h3>
                  </div>
                  <p className="text-sm text-gray-500 mb-5">Average checkin score per employee across all quarters</p>
                  {qoqEmployees.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <TrendingUp size={40} className="mx-auto mb-3 opacity-30" />
                      <p>No trend data available yet.</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={320}>
                      <LineChart data={qoqChartData} margin={{ left: -10, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                        <XAxis dataKey="quarter" tick={{ fontSize: 13, fontWeight: 600 }} />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                        <Tooltip content={<QoQTooltip />} />
                        <Legend />
                        {qoqEmployees.map((name: string, i: number) => (
                          <Line
                            key={name}
                            type="monotone"
                            dataKey={name}
                            stroke={DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
                            strokeWidth={2.5}
                            dot={{ r: 5, strokeWidth: 2 }}
                            connectNulls={false}
                            strokeDasharray={qoqChartData.some((p: any) => p[name] === null) ? '5 5' : undefined}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {/* ── Tab: Goal Distribution ── */}
              {activeTab === 'distribution' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Pie Chart: by thrust area */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <Target size={20} className="text-[#7F77DD]" />
                      <h3 className="text-lg font-semibold text-gray-900">Goals by Thrust Area</h3>
                    </div>
                    {distributionData.by_thrust_area.length === 0 ? (
                      <div className="text-center py-16 text-gray-400">No goals found.</div>
                    ) : (
                      <>
                        <ResponsiveContainer width="100%" height={240}>
                          <PieChart>
                            <Pie
                              data={distributionData.by_thrust_area}
                              dataKey="count"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              outerRadius={90}
                              label={({ name, percent }) => `${name.split(' ')[0]} ${(percent * 100).toFixed(0)}%`}
                              labelLine={false}
                            >
                              {distributionData.by_thrust_area.map((_: any, i: number) => (
                                <Cell key={i} fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: any, name: any) => [`${v} goals`, name]} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex flex-wrap gap-3 mt-3 justify-center">
                          {distributionData.by_thrust_area.map((d: any, i: number) => (
                            <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DEFAULT_COLORS[i % DEFAULT_COLORS.length] }} />
                              {d.name} ({d.count})
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Bar Chart: by UoM type */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-5">
                      <BarChart3 size={20} className="text-[#BA7517]" />
                      <h3 className="text-lg font-semibold text-gray-900">Goals by Measurement Type</h3>
                    </div>
                    {distributionData.by_uom_type.length === 0 ? (
                      <div className="text-center py-16 text-gray-400">No goals found.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height={240}>
                        <BarChart data={distributionData.by_uom_type} layout="vertical" margin={{ left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 12 }} />
                          <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={70} />
                          <Tooltip formatter={(v: any) => [`${v} goals`]} />
                          <Bar dataKey="count" name="Goals" radius={[0, 4, 4, 0]}>
                            {distributionData.by_uom_type.map((_: any, i: number) => (
                              <Cell key={i} fill={DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              )}

              {/* ── Tab: Manager Effectiveness ── */}
              {activeTab === 'managers' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center gap-2 mb-5">
                    <Users size={20} className="text-[#2563eb]" />
                    <h3 className="text-lg font-semibold text-gray-900">Manager Effectiveness — Checkin Completion</h3>
                  </div>
                  {managerData.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                      <Users size={40} className="mx-auto mb-3 opacity-30" />
                      <p>No manager data available.</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={Math.max(managerData.length * 56 + 60, 200)}>
                      <BarChart
                        data={managerData.map(m => ({
                          name: m.name,
                          pct: m.checkin_completion_pct ?? 0,
                          team_size: m.team_size,
                        }))}
                        layout="vertical"
                        margin={{ left: 16, right: 50 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 13 }} width={120} />
                        <Tooltip
                          formatter={(v: any, name: any, props: any) => [
                            `${v}% completion (team: ${props.payload.team_size})`,
                          ]}
                        />
                        <Bar dataKey="pct" name="Completion %" radius={[0, 4, 4, 0]}
                          label={{ position: 'right', formatter: (v: any) => `${v}%`, fontSize: 12, fill: '#374151' }}>
                          {managerData.map((m: any, i: number) => (
                            <Cell key={i} fill={getBarColor(m.checkin_completion_pct ?? 0)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              )}

              {/* ── Tab: Anomalies ── */}
              {activeTab === 'anomalies' && (
                <div>
                  {anomalies.length === 0 ? (
                    <div className="bg-white rounded-xl shadow-sm border border-green-200 p-10 text-center">
                      <CheckCircle2 size={48} className="text-[#1D9E75] mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">No Anomalies Detected</h3>
                      <p className="text-gray-500 text-sm">All checkin progressions look normal. No suspicious score jumps found.</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 mb-5 px-5 py-4 bg-red-50 border border-red-200 rounded-xl">
                        <AlertTriangle size={20} className="text-red-600 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-red-800">{anomalies.length} Anomaly{anomalies.length !== 1 ? 'ies' : ''} Detected</p>
                          <p className="text-sm text-red-600">Score jumps exceeding the threshold were found. Please investigate.</p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        {anomalies.map((a: any, i: number) => (
                          <div key={i} className="bg-white rounded-xl shadow-sm border border-red-100 p-5">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-3 mb-2">
                                  <span
                                    className="text-xs font-bold px-2.5 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: `${getSeverityColor(a.severity)}20`,
                                      color: getSeverityColor(a.severity),
                                    }}
                                  >
                                    {(a.severity || 'medium').toUpperCase()} SEVERITY
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    {a.from_quarter?.toUpperCase()} → {a.to_quarter?.toUpperCase()}
                                  </span>
                                </div>
                                <p className="font-semibold text-gray-900">{a.employee_name}</p>
                                <p className="text-sm text-gray-600 mt-0.5">{a.goal_title}</p>
                              </div>
                              <div className="flex items-center gap-3 text-right flex-shrink-0">
                                <div className="text-center">
                                  <div className="text-xs text-gray-400">From</div>
                                  <div className="text-2xl font-bold text-gray-700">{Math.round(a.from_score)}%</div>
                                </div>
                                <div className="text-gray-400 text-xl">→</div>
                                <div className="text-center">
                                  <div className="text-xs text-gray-400">To</div>
                                  <div className="text-2xl font-bold" style={{ color: getSeverityColor(a.severity) }}>
                                    {Math.round(a.to_score)}%
                                  </div>
                                </div>
                                <div className="text-center">
                                  <div className="text-xs text-gray-400">Jump</div>
                                  <div className="text-lg font-bold text-red-600">+{Math.round(Math.abs(a.delta))}pts</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from 'react';
import AppSidebar from './AppSidebar';
import { Lock, Clock, Loader2, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';
import type { UserRole, Page, Goal, Checkin } from '../types';

interface EmployeeCheckinsProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  userRole: UserRole;
}

interface CheckinRow {
  goalId: string;
  goalTitle: string;
  uomType: string;
  uomDirection: string;
  target: number;
  checkinId: string | null;
  planned: string;
  actual: string;
  score: number | null;
  submittedAt: string | null;
}

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'];
const QUARTER_KEYS = ['q1', 'q2', 'q3', 'q4'] as const;

export default function EmployeeCheckins({ onNavigate, onLogout, userRole }: EmployeeCheckinsProps) {
  const [activeQ, setActiveQ] = useState<'q1' | 'q2' | 'q3' | 'q4'>('q1');
  const [rows, setRows] = useState<CheckinRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [pageError, setPageError] = useState('');
  const [cycleName, setCycleName] = useState('FY 2025-26');
  const [windowCloses, setWindowCloses] = useState<string | null>(null);
  const [openQuarters, setOpenQuarters] = useState<Set<string>>(new Set(['q1']));

  // Load data from backend
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { default: api } = await import('../../lib/api');

      // Get active cycle info
      const cycleRes = await api.get('/api/cycles/active');
      const cycle = cycleRes.data?.cycle;
      if (cycle) {
        setCycleName(cycle.name || 'FY 2025-26');

        // Determine which quarters are currently open
        const today = new Date();
        const openSet = new Set<string>();
        QUARTER_KEYS.forEach(q => {
          const opens = new Date(cycle[`${q}_opens`]);
          const closes = new Date(cycle[`${q}_closes`]);
          if (today >= opens && today <= closes) {
            openSet.add(q);
            setWindowCloses(closes.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));
          }
        });

        // Default to open quarter if available
        const firstOpen = QUARTER_KEYS.find(q => openSet.has(q));
        if (firstOpen) setActiveQ(firstOpen);
        setOpenQuarters(openSet);
      }

      // Get locked goals for the employee
      const goalsRes = await api.get('/api/goals/my');
      const lockedGoals: Goal[] = (goalsRes.data?.goals || []).filter(
        (g: Goal) => g.status === 'locked' || g.status === 'approved'
      );

      // Get existing checkins for active quarter
      const checkinRes = await api.get('/api/checkins', { params: { quarter: activeQ } });
      const existingCheckins: Checkin[] = checkinRes.data?.checkins || [];

      // Build merged rows
      const checkinByGoal: Record<string, Checkin> = {};
      existingCheckins.forEach(c => { checkinByGoal[c.goal_id] = c; });

      const merged: CheckinRow[] = lockedGoals.map(g => {
        const ci = checkinByGoal[g.id];
        return {
          goalId: g.id,
          goalTitle: g.title,
          uomType: g.uom_type,
          uomDirection: g.uom_direction,
          target: g.target,
          checkinId: ci?.id ?? null,
          planned: ci?.planned?.toString() ?? '',
          actual: ci?.actual?.toString() ?? '',
          score: ci?.score ?? null,
          submittedAt: ci?.submitted_at ?? null,
        };
      });

      setRows(merged);
    } catch (err: any) {
      console.warn('[EmployeeCheckins] API unavailable, using demo data');
      // Fallback demo data
      setRows([
        { goalId: '1', goalTitle: 'Reduce customer churn', uomType: 'percent', uomDirection: 'min', target: 15, checkinId: null, planned: '5', actual: '3.5', score: 70, submittedAt: null },
        { goalId: '2', goalTitle: 'Launch 3 features', uomType: 'numeric', uomDirection: 'max', target: 3, checkinId: null, planned: '1', actual: '1', score: 100, submittedAt: new Date().toISOString() },
        { goalId: '3', goalTitle: 'Reduce infra cost', uomType: 'percent', uomDirection: 'min', target: 20, checkinId: null, planned: '5', actual: '', score: null, submittedAt: null },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [activeQ]);

  useEffect(() => { loadData(); }, [activeQ]);

  const handleFieldChange = (goalId: string, field: 'planned' | 'actual', value: string) => {
    setRows(prev => prev.map(r => r.goalId === goalId ? { ...r, [field]: value } : r));
  };

  const handleSaveRow = async (row: CheckinRow) => {
    setSavingId(row.goalId);
    setPageError('');
    try {
      const { default: api } = await import('../../lib/api');
      const { data } = await api.post('/api/checkins', {
        goal_id: row.goalId,
        quarter: activeQ,
        planned: Number(row.planned),
        actual: Number(row.actual),
      });

      // Update local state with returned score
      setRows(prev => prev.map(r =>
        r.goalId === row.goalId
          ? { ...r, checkinId: data.checkin?.id, score: data.score ?? r.score, submittedAt: data.checkin?.submitted_at }
          : r
      ));
    } catch (err: any) {
      setPageError(err.response?.data?.message || 'Save failed. Please try again.');
    } finally {
      setSavingId(null);
    }
  };

  const allFilled = rows.every(r => r.actual !== '');
  const avgScore = rows.filter(r => r.score !== null).length > 0
    ? Math.round(rows.reduce((s, r) => s + (r.score ?? 0), 0) / rows.filter(r => r.score !== null).length)
    : 0;
  const completedCount = rows.filter(r => r.submittedAt !== null).length;
  const atRiskCount = rows.filter(r => r.score !== null && r.score < 70).length;

  const getScoreBadge = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 70) return 'bg-green-100 text-green-700';
    if (score >= 40) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className="flex h-screen bg-[#F8FAF9]">
      <AppSidebar currentPage="check-ins" onNavigate={onNavigate} onLogout={onLogout} userRole={userRole} />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl mb-2">Quarterly Check-ins — {cycleName}</h1>
            {windowCloses && (
              <div className="flex items-center gap-2 text-amber-600">
                <Clock size={16} />
                <span className="text-sm">{activeQ.toUpperCase()} window closes: {windowCloses}</span>
              </div>
            )}
          </div>

          {/* Error Banner */}
          {pageError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <AlertTriangle size={16} /> {pageError}
              <button onClick={() => setPageError('')} className="ml-auto">✕</button>
            </div>
          )}

          {/* Quarter Tabs */}
          <div className="flex gap-3 mb-6">
            {QUARTER_KEYS.map((q, idx) => {
              const isOpen = openQuarters.has(q);
              return (
                <button
                  key={q}
                  onClick={() => isOpen && setActiveQ(q)}
                  disabled={!isOpen}
                  className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                    activeQ === q && isOpen
                      ? 'bg-[#1D9E75] text-white'
                      : isOpen
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {QUARTER_LABELS[idx]}
                  {!isOpen && <Lock size={14} />}
                </button>
              );
            })}
          </div>

          {/* Checkin Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            {isLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="animate-spin text-[#1D9E75] mx-auto mb-3" size={32} />
                <p className="text-gray-500">Loading check-ins…</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No locked goals found for this quarter. Goals must be approved and locked before you can submit check-ins.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Goal</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">UoM / Direction</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Target</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Planned ({activeQ.toUpperCase()})</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Actual Achieved</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Score</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rows.map((row) => (
                      <tr key={row.goalId} className={`hover:bg-gray-50 ${row.submittedAt ? 'opacity-80' : ''}`}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          <div className="flex items-center gap-2">
                            {row.submittedAt && <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />}
                            {row.goalTitle}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 uppercase">
                          {row.uomType} / {row.uomDirection}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700">{row.target}</td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            value={row.planned}
                            onChange={(e) => handleFieldChange(row.goalId, 'planned', e.target.value)}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-sm"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="number"
                            value={row.actual}
                            onChange={(e) => handleFieldChange(row.goalId, 'actual', e.target.value)}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-sm"
                            placeholder="0"
                          />
                        </td>
                        <td className="px-6 py-4">
                          {row.score !== null ? (
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getScoreBadge(row.score)}`}>
                              {Math.round(row.score)}%
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">Not submitted</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => handleSaveRow(row)}
                            disabled={savingId === row.goalId || !row.actual}
                            className="px-4 py-2 bg-[#1D9E75] text-white rounded-lg hover:bg-[#178f68] transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            {savingId === row.goalId && <Loader2 size={12} className="animate-spin" />}
                            {row.submittedAt ? 'Update' : 'Save'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Summary Card */}
          {!isLoading && rows.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4">{activeQ.toUpperCase()} Progress Summary</h3>
              <div className="grid grid-cols-3 gap-6 mb-6">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-gray-900">{avgScore}%</div>
                  <div className="text-sm text-gray-600 mt-1">Average Score</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-gray-900">{completedCount}/{rows.length}</div>
                  <div className="text-sm text-gray-600 mt-1">Submitted</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <div className="text-3xl font-bold text-gray-900">{atRiskCount}</div>
                  <div className="text-sm text-gray-600 mt-1">At Risk (&lt;70%)</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

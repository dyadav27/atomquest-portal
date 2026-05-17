import { useState, useEffect } from 'react';
import AppSidebar from './AppSidebar';
import { CheckCircle2, XCircle, ChevronDown, ChevronUp, Loader2, AlertTriangle, Clock } from 'lucide-react';
import type { UserRole, Page, Goal } from '../types';

interface ManagerApprovalProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  userRole: UserRole;
}

export default function ManagerApproval({ onNavigate, onLogout, userRole }: ManagerApprovalProps) {
  const [pendingGoals, setPendingGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [returnFeedback, setReturnFeedback] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [pageError, setPageError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadPending = async () => {
    setIsLoading(true);
    try {
      const { default: api } = await import('../../lib/api');
      const { data } = await api.get('/api/users/team/pending-approvals');
      setPendingGoals(data.pendingGoals || []);
    } catch {
      setPageError('Running in demo mode — live data unavailable.');
      setPendingGoals([
        { id: 'g1', employee_id: 'e1', cycle_id: 'c1', thrust_area: 'Innovation', title: 'Launch AI feature module', uom_type: 'numeric', uom_direction: 'max', target: 3, weightage: 30, status: 'pending', employee: { id: 'e1', name: 'Rahul Kumar', email: 'rahul@atomquest.in' } } as any,
        { id: 'g2', employee_id: 'e1', cycle_id: 'c1', thrust_area: 'Operational Excellence', title: 'Reduce deployment time by 40%', uom_type: 'percent', uom_direction: 'min', target: 40, weightage: 25, status: 'pending', employee: { id: 'e1', name: 'Rahul Kumar', email: 'rahul@atomquest.in' } } as any,
        { id: 'g3', employee_id: 'e2', cycle_id: 'c1', thrust_area: 'Customer Success', title: 'Achieve NPS > 70', uom_type: 'numeric', uom_direction: 'max', target: 70, weightage: 20, status: 'pending', employee: { id: 'e2', name: 'Dev Patel', email: 'dev@atomquest.in' } } as any,
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadPending(); }, []);

  // Group goals by employee
  const byEmployee: Record<string, { emp: any; goals: Goal[] }> = {};
  pendingGoals.forEach(g => {
    const emp = (g as any).employee;
    if (!emp) return;
    if (!byEmployee[emp.id]) byEmployee[emp.id] = { emp, goals: [] };
    byEmployee[emp.id].goals.push(g);
  });

  const handleApprove = async (goalId: string, employeeId: string) => {
    setActionLoading(prev => ({ ...prev, [goalId]: true }));
    setPageError('');
    try {
      const { default: api } = await import('../../lib/api');
      await api.post(`/api/goals/${goalId}/approve`);
      setPendingGoals(prev => prev.filter(g => g.id !== goalId));
      setSuccessMsg('Goal approved successfully.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setPageError(err.response?.data?.message || 'Approval failed.');
    } finally {
      setActionLoading(prev => ({ ...prev, [goalId]: false }));
    }
  };

  const handleReturn = async (goalId: string) => {
    const fb = returnFeedback[goalId]?.trim();
    if (!fb) { setPageError('Please enter feedback before returning a goal.'); return; }

    setActionLoading(prev => ({ ...prev, [goalId]: true }));
    setPageError('');
    try {
      const { default: api } = await import('../../lib/api');
      await api.post(`/api/goals/${goalId}/return`, { feedback: fb });
      setPendingGoals(prev => prev.filter(g => g.id !== goalId));
      setReturnFeedback(prev => { const n = { ...prev }; delete n[goalId]; return n; });
      setSuccessMsg('Goal returned with feedback.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setPageError(err.response?.data?.message || 'Return failed.');
    } finally {
      setActionLoading(prev => ({ ...prev, [goalId]: false }));
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAF9]">
      <AppSidebar currentPage="approval-queue" onNavigate={onNavigate} onLogout={onLogout} userRole={userRole} />

      <div className="flex-1 overflow-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl">Goal Approval Queue</h1>
          {pendingGoals.length > 0 && (
            <span className="px-4 py-2 bg-amber-100 text-amber-700 rounded-full text-sm font-semibold flex items-center gap-2">
              <Clock size={16} /> {pendingGoals.length} Pending
            </span>
          )}
        </div>

        {successMsg && (
          <div className="mb-4 p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm flex items-center gap-2">
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}
        {pageError && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
            <AlertTriangle size={16} /> {pageError}
            <button onClick={() => setPageError('')} className="ml-auto">✕</button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#1D9E75]" size={36} /></div>
        ) : Object.keys(byEmployee).length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <CheckCircle2 size={48} className="text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">All caught up!</h3>
            <p className="text-gray-500">No goal sheets are pending your approval.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.values(byEmployee).map(({ emp, goals }) => {
              const isExpanded = expandedEmployee === emp.id;
              const totalWeightage = goals.reduce((s, g) => s + Number(g.weightage), 0);

              return (
                <div key={emp.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  {/* Employee Header */}
                  <button
                    onClick={() => setExpandedEmployee(isExpanded ? null : emp.id)}
                    className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#1D9E75] flex items-center justify-center text-white font-semibold text-lg">
                        {emp.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                      </div>
                      <div className="text-left">
                        <h3 className="font-semibold text-gray-900">{emp.name}</h3>
                        <p className="text-sm text-gray-500">{emp.email}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                          {goals.length} goal{goals.length !== 1 ? 's' : ''} pending
                        </span>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${totalWeightage === 100 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          Total: {totalWeightage}%
                        </span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                  </button>

                  {/* Goals Detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-200">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Thrust Area</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Goal</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">UoM / Dir</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Target</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Weight</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {goals.map(goal => (
                            <tr key={goal.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 text-sm text-gray-600">{goal.thrust_area}</td>
                              <td className="px-6 py-4">
                                <div className="text-sm font-medium text-gray-900">{goal.title}</div>
                                {goal.description && <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{goal.description}</div>}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 uppercase">{goal.uom_type} / {goal.uom_direction}</td>
                              <td className="px-6 py-4 text-sm text-gray-700">{goal.target}</td>
                              <td className="px-6 py-4 text-sm font-medium">{goal.weightage}%</td>
                              <td className="px-6 py-4">
                                <div className="space-y-2">
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleApprove(goal.id, emp.id)}
                                      disabled={actionLoading[goal.id]}
                                      className="flex items-center gap-1 px-3 py-1.5 bg-[#1D9E75] text-white rounded-lg hover:bg-[#178f68] transition-colors text-xs font-medium disabled:opacity-60"
                                    >
                                      {actionLoading[goal.id] ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => setReturnFeedback(prev => ({ ...prev, [goal.id]: prev[goal.id] ?? '' }))}
                                      disabled={actionLoading[goal.id]}
                                      className="flex items-center gap-1 px-3 py-1.5 border-2 border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-xs font-medium disabled:opacity-60"
                                    >
                                      <XCircle size={12} /> Return
                                    </button>
                                  </div>
                                  {returnFeedback[goal.id] !== undefined && (
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        placeholder="Feedback for employee…"
                                        value={returnFeedback[goal.id]}
                                        onChange={e => setReturnFeedback(prev => ({ ...prev, [goal.id]: e.target.value }))}
                                        className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
                                      />
                                      <button
                                        onClick={() => handleReturn(goal.id)}
                                        disabled={actionLoading[goal.id]}
                                        className="px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-xs disabled:opacity-60"
                                      >
                                        {actionLoading[goal.id] ? <Loader2 size={12} className="animate-spin" /> : 'Send'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Bulk Approve All */}
                      {goals.length > 1 && totalWeightage === 100 && (
                        <div className="p-4 bg-green-50 border-t border-green-200 flex items-center justify-between">
                          <span className="text-sm text-green-700 font-medium">
                            Weightage is 100% — all goals look good!
                          </span>
                          <button
                            onClick={async () => {
                              for (const g of goals) await handleApprove(g.id, emp.id);
                            }}
                            className="px-4 py-2 bg-[#1D9E75] text-white rounded-lg hover:bg-[#178f68] transition-colors text-sm font-medium flex items-center gap-2"
                          >
                            <CheckCircle2 size={16} /> Approve All Goals
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

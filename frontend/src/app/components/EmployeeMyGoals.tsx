import { useState, useEffect } from 'react';
import AppSidebar from './AppSidebar';
import {
  Plus, Eye, Edit, Trash2, Lock, Sparkles, ArrowRight,
  AlertTriangle, CheckCircle2, Loader2
} from 'lucide-react';
import GoalFormModal from './GoalFormModal';
import DNAScorePanel from './DNAScorePanel';
import type { UserRole, Page, Goal } from '../types';

interface EmployeeMyGoalsProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  userRole: UserRole;
}

import useGoalStore from '../../store/goalStore';
import useCycleStore from '../../store/cycleStore';

export default function EmployeeMyGoals({ onNavigate, onLogout, userRole }: EmployeeMyGoalsProps) {
  const { goals, fetchGoals, deleteGoal, updateGoal, createGoal, submitGoalSheet } = useGoalStore();
  const { activeQuarter, isGoalSettingOpen } = useCycleStore();

  const [isLoading, setIsLoading] = useState(true);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showDNAPanel, setShowDNAPanel] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [aiGoalText, setAiGoalText] = useState('');
  const [aiParsing, setAiParsing] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        await fetchGoals();
      } catch (err) {
        console.error('[EmployeeMyGoals] Load error:', err);
        setPageError('Failed to load goals. Running in demo mode.');
        // Fallback demo data handled in UI if goals array is empty, but let's just let it be empty
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [fetchGoals]);

  const totalWeightage = goals.reduce((sum, g) => sum + Number(g.weightage), 0);
  const canSubmit = totalWeightage === 100 && goals.some(g => g.status === 'draft');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved': case 'locked': return 'bg-green-100 text-green-700 border-green-300';
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-300';
      case 'returned': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': case 'locked': return 'border-l-green-500';
      case 'pending': return 'border-l-amber-500';
      case 'returned': return 'border-l-red-500';
      default: return 'border-l-gray-400';
    }
  };

  const handleAddGoal = () => { setEditingGoal(null); setShowGoalForm(true); };
  const handleEditGoal = (goal: Goal) => { setEditingGoal(goal); setShowGoalForm(true); };

  const handleDeleteGoal = async (goalId: string) => {
    if (!window.confirm('Delete this goal?')) return;
    await deleteGoal(goalId);
  };

  const handleViewDNA = (goal: Goal) => { setSelectedGoal(goal); setShowDNAPanel(true); };

  const handleSaveGoal = async (goalData: Partial<Goal>) => {
    setPageError('');
    if (editingGoal) {
      const result = await updateGoal(editingGoal.id, goalData);
      if (!result.success) setPageError(result.error || 'Update failed');
    } else {
      const result = await createGoal(goalData);
      if (!result.success) setPageError(result.error || 'Create failed');
    }
    setShowGoalForm(false);
  };

  const handleSubmitGoalSheet = async () => {
    setSubmitLoading(true);
    setPageError('');
    try {
      const result = await submitGoalSheet();
      if (!result.success) setPageError(result.error || 'Submission failed');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleParseWithAI = async () => {
    if (!aiGoalText.trim()) return;
    setAiParsing(true);
    try {
      const { parseGoal } = await import('../../lib/ai');
      const result = await parseGoal(aiGoalText);
      if (result.parsed && !result.fallback) {
        const p = result.parsed;
        setEditingGoal(null);
        setShowGoalForm(true);
        // The form modal will receive pre-filled data via editingGoal
        setEditingGoal({
          id: '',
          employee_id: '',
          cycle_id: '',
          thrust_area: p.thrust_area || '',
          title: p.title || '',
          description: p.description || '',
          uom_type: p.uom_type || 'numeric',
          uom_direction: p.uom_direction || 'max',
          target: Number(p.target) || 0,
          weightage: Number(p.weightage_suggestion) || 20,
          status: 'draft',
        });
        setAiGoalText('');
      } else {
        setPageError('AI parsing unavailable. Please fill in the goal form manually.');
        setShowGoalForm(true);
      }
    } catch {
      setPageError('AI parsing failed. Please fill in the goal form manually.');
      setShowGoalForm(true);
    } finally {
      setAiParsing(false);
    }
  };

  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];

  return (
    <div className="flex h-screen bg-[#F8FAF9]">
      <AppSidebar currentPage="my-goals" onNavigate={onNavigate} onLogout={onLogout} userRole={userRole} />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Error Banner */}
          {pageError && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
              <AlertTriangle size={16} /> {pageError}
              <button onClick={() => setPageError('')} className="ml-auto text-amber-600 hover:text-amber-800">✕</button>
            </div>
          )}

          {/* Top Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl mb-1">My Goals — FY 2025-26</h1>
                <div className="flex items-center gap-3 mt-2">
                  {isGoalSettingOpen ? (
                    <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      Goal Setting Open
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-sm font-medium">
                      Goal Setting Closed
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={handleSubmitGoalSheet}
                disabled={!canSubmit || submitLoading}
                className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  canSubmit && !submitLoading
                    ? 'bg-[#1D9E75] text-white hover:bg-[#178f68]'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {submitLoading && <Loader2 size={16} className="animate-spin" />}
                Submit Goal Sheet
              </button>
            </div>

            {/* Quarter Timeline */}
            <div className="flex gap-2">
              {quarters.map((q) => (
                <div
                  key={q}
                  className={`flex-1 px-4 py-2 rounded-lg text-center font-medium text-sm ${
                    activeQuarter === q
                      ? 'bg-green-100 text-green-700 border-2 border-green-300'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {q}{activeQuarter === q && ' (Active)'}
                </div>
              ))}
            </div>
          </div>

          {/* Weightage Meter */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium">Total Weightage</h3>
              <span className={`text-2xl font-bold ${totalWeightage === 100 ? 'text-green-600' : 'text-amber-600'}`}>
                {totalWeightage} / 100%
              </span>
            </div>
            <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${totalWeightage === 100 ? 'bg-green-500' : totalWeightage > 100 ? 'bg-red-500' : 'bg-amber-500'}`}
                style={{ width: `${Math.min(totalWeightage, 100)}%` }}
              />
            </div>
            {totalWeightage < 100 ? (
              <p className="text-amber-600 text-sm mt-2 flex items-center gap-2">
                <AlertTriangle size={16} /> You need {100 - totalWeightage}% more to submit
              </p>
            ) : totalWeightage === 100 ? (
              <p className="text-green-600 text-sm mt-2 flex items-center gap-2">
                <CheckCircle2 size={16} /> Ready to submit
              </p>
            ) : (
              <p className="text-red-600 text-sm mt-2 flex items-center gap-2">
                <AlertTriangle size={16} /> Total weightage exceeds 100% by {totalWeightage - 100}%
              </p>
            )}
          </div>

          {/* Goals Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            {isLoading ? (
              <div className="p-12 text-center">
                <Loader2 className="animate-spin text-[#1D9E75] mx-auto mb-3" size={32} />
                <p className="text-gray-500">Loading your goals…</p>
              </div>
            ) : goals.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                No goals yet. Add your first goal below.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Thrust Area</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Goal Title</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">UoM</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Target</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Weightage</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Status</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">DNA Score</th>
                      <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {goals.map((goal) => (
                      <tr key={goal.id} className={`border-l-4 ${getStatusColor(goal.status)} hover:bg-gray-50`}>
                        <td className="px-6 py-4 text-sm text-gray-700">{goal.thrust_area}</td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            {(goal.status === 'approved' || goal.status === 'locked') && <Lock size={14} className="text-gray-400" />}
                            <span className="font-medium">{goal.title}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-700 uppercase">{goal.uom_type}</td>
                        <td className="px-6 py-4 text-sm text-gray-700">{goal.target}</td>
                        <td className="px-6 py-4 text-sm"><span className="font-medium">{goal.weightage}%</span></td>
                        <td className="px-6 py-4 text-sm">
                          <span className={`px-3 py-1 rounded-full border text-xs font-medium ${getStatusBadge(goal.status)}`}>
                            {goal.status.charAt(0).toUpperCase() + goal.status.slice(1)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {goal.dna_score ? (
                            <button onClick={() => handleViewDNA(goal)} className="flex items-center gap-1 text-[#7F77DD] hover:underline">
                              <span className="font-medium">{goal.dna_score.total}/100</span>
                              <Eye size={14} />
                            </button>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <div className="flex items-center gap-2">
                            {goal.status === 'approved' || goal.status === 'locked' ? (
                              <button onClick={() => handleViewDNA(goal)} className="text-gray-600 hover:text-gray-800 text-sm">
                                View
                              </button>
                            ) : (
                              <>
                                <button onClick={() => handleEditGoal(goal)} className="text-[#1D9E75] hover:text-[#178f68]">
                                  <Edit size={16} />
                                </button>
                                <button onClick={() => handleDeleteGoal(goal.id)} className="text-red-600 hover:text-red-700">
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Add New Goal Button */}
            {isGoalSettingOpen && (
              <div className="p-4 border-t border-gray-200">
                <button
                  onClick={handleAddGoal}
                  className="flex items-center gap-2 px-4 py-2 border-2 border-[#1D9E75] text-[#1D9E75] rounded-lg hover:bg-green-50 transition-colors"
                >
                  <Plus size={18} /> Add New Goal
                </button>
              </div>
            )}
          </div>

          {/* AI Goal Entry */}
          <div className="bg-gradient-to-br from-[#7F77DD]/10 to-[#7F77DD]/5 rounded-xl shadow-sm border-2 border-[#7F77DD]/30 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Sparkles size={20} className="text-[#7F77DD]" />
              <h3 className="text-lg font-medium text-gray-800">AI Goal Entry — describe your goal naturally</h3>
            </div>
            <div className="flex gap-3">
              <input
                type="text"
                value={aiGoalText}
                onChange={(e) => setAiGoalText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleParseWithAI()}
                placeholder="e.g. I want to reduce support tickets by 30% by end of Q3..."
                className="flex-1 px-4 py-3 border border-[#7F77DD]/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7F77DD] bg-white"
              />
              <button
                onClick={handleParseWithAI}
                disabled={aiParsing || !aiGoalText.trim()}
                className="px-6 py-3 bg-[#7F77DD] text-white rounded-lg font-medium hover:bg-[#6d65c9] transition-colors flex items-center gap-2 disabled:opacity-60"
              >
                {aiParsing ? <Loader2 size={18} className="animate-spin" /> : <><span>Parse with AI</span><ArrowRight size={18} /></>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showGoalForm && (
        <GoalFormModal
          goal={editingGoal}
          onClose={() => setShowGoalForm(false)}
          onSave={handleSaveGoal}
          remainingWeightage={100 - totalWeightage + (editingGoal?.weightage || 0)}
        />
      )}

      {showDNAPanel && selectedGoal && (
        <DNAScorePanel goal={selectedGoal} onClose={() => setShowDNAPanel(false)} />
      )}
    </div>
  );
}

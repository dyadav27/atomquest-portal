import { useState, useEffect } from 'react';
import AppSidebar from './AppSidebar';
import { Calendar, Plus, Loader2, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { UserRole, Page } from '../types';

interface AdminGoalCyclesProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  userRole: UserRole;
}

interface GoalCycle {
  id: string;
  name: string;
  is_active: boolean;
  goal_setting_opens: string;
  q1_opens: string;
  q1_closes: string;
  q2_opens: string;
  q2_closes: string;
  q3_opens: string;
  q3_closes: string;
  q4_opens: string;
  q4_closes: string;
}

export default function AdminGoalCycles({ onNavigate, onLogout, userRole }: AdminGoalCyclesProps) {
  const [cycles, setCycles] = useState<GoalCycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Default to Next Year
  const currentYear = new Date().getFullYear();
  const [formData, setFormData] = useState({
    name: `FY ${currentYear}-${currentYear + 1}`,
    goal_setting_opens: `${currentYear}-04-01`,
    q1_opens: `${currentYear}-04-01`,
    q1_closes: `${currentYear}-06-30`,
    q2_opens: `${currentYear}-07-01`,
    q2_closes: `${currentYear}-09-30`,
    q3_opens: `${currentYear}-10-01`,
    q3_closes: `${currentYear}-12-31`,
    q4_opens: `${currentYear + 1}-01-01`,
    q4_closes: `${currentYear + 1}-03-31`,
    is_active: true
  });

  const loadCycles = async () => {
    setIsLoading(true);
    try {
      const { default: api } = await import('../../lib/api');
      const { data } = await api.get('/api/cycles');
      setCycles(data.cycles || []);
    } catch (err: any) {
      console.error(err);
      setPageError(err.response?.data?.message || 'Failed to load goal cycles.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCycles();
  }, []);

  const handleCreateCycle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setPageError('');
    setSuccessMsg('');

    try {
      const { default: api } = await import('../../lib/api');
      await api.post('/api/cycles', formData);
      setSuccessMsg('Goal Cycle created successfully.');
      setShowAddForm(false);
      loadCycles();
    } catch (err: any) {
      setPageError(err.response?.data?.message || 'Failed to create goal cycle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="flex h-screen bg-[#F8FAF9]">
      <AppSidebar currentPage="goal-cycles" onNavigate={onNavigate} onLogout={onLogout} userRole={userRole} />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl mb-1 flex items-center gap-2">
                <Calendar className="text-gray-400" /> Goal Cycles
              </h1>
              <p className="text-gray-500">Manage financial years, goal-setting windows, and quarterly check-ins.</p>
            </div>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-[#1D9E75] text-white rounded-lg flex items-center gap-2 hover:bg-[#178f68] transition-colors font-medium shadow-sm"
              >
                <Plus size={18} /> New Goal Cycle
              </button>
            )}
          </div>

          {pageError && (
            <div className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm flex items-center gap-2 shadow-sm">
              <AlertTriangle size={16} /> {pageError}
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm flex items-center gap-2 shadow-sm">
              <CheckCircle2 size={16} /> {successMsg}
            </div>
          )}

          {showAddForm && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
              <h2 className="text-lg font-semibold mb-4 border-b pb-2">Create New Goal Cycle</h2>
              <form onSubmit={handleCreateCycle} className="space-y-6">
                
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Cycle Name</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Goal Setting Opens</label>
                    <input
                      type="date"
                      required
                      value={formData.goal_setting_opens}
                      onChange={e => setFormData({ ...formData, goal_setting_opens: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-8 gap-y-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  {/* Q1 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Quarter 1</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Opens</label>
                        <input type="date" required value={formData.q1_opens} onChange={e => setFormData({ ...formData, q1_opens: e.target.value })} className="w-full px-3 py-1.5 text-sm border rounded focus:ring-1 focus:ring-[#1D9E75]"/>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Closes</label>
                        <input type="date" required value={formData.q1_closes} onChange={e => setFormData({ ...formData, q1_closes: e.target.value })} className="w-full px-3 py-1.5 text-sm border rounded focus:ring-1 focus:ring-[#1D9E75]"/>
                      </div>
                    </div>
                  </div>
                  
                  {/* Q2 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Quarter 2</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Opens</label>
                        <input type="date" required value={formData.q2_opens} onChange={e => setFormData({ ...formData, q2_opens: e.target.value })} className="w-full px-3 py-1.5 text-sm border rounded focus:ring-1 focus:ring-[#1D9E75]"/>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Closes</label>
                        <input type="date" required value={formData.q2_closes} onChange={e => setFormData({ ...formData, q2_closes: e.target.value })} className="w-full px-3 py-1.5 text-sm border rounded focus:ring-1 focus:ring-[#1D9E75]"/>
                      </div>
                    </div>
                  </div>

                  {/* Q3 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Quarter 3</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Opens</label>
                        <input type="date" required value={formData.q3_opens} onChange={e => setFormData({ ...formData, q3_opens: e.target.value })} className="w-full px-3 py-1.5 text-sm border rounded focus:ring-1 focus:ring-[#1D9E75]"/>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Closes</label>
                        <input type="date" required value={formData.q3_closes} onChange={e => setFormData({ ...formData, q3_closes: e.target.value })} className="w-full px-3 py-1.5 text-sm border rounded focus:ring-1 focus:ring-[#1D9E75]"/>
                      </div>
                    </div>
                  </div>

                  {/* Q4 */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Quarter 4</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Opens</label>
                        <input type="date" required value={formData.q4_opens} onChange={e => setFormData({ ...formData, q4_opens: e.target.value })} className="w-full px-3 py-1.5 text-sm border rounded focus:ring-1 focus:ring-[#1D9E75]"/>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Closes</label>
                        <input type="date" required value={formData.q4_closes} onChange={e => setFormData({ ...formData, q4_closes: e.target.value })} className="w-full px-3 py-1.5 text-sm border rounded focus:ring-1 focus:ring-[#1D9E75]"/>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <input 
                    type="checkbox" 
                    id="is_active" 
                    checked={formData.is_active} 
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    className="rounded text-[#1D9E75] focus:ring-[#1D9E75]"
                  />
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
                    Set as Active Cycle immediately (Deactivates other cycles)
                  </label>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2 bg-[#1D9E75] text-white font-medium rounded-lg hover:bg-[#178f68] transition-colors flex items-center gap-2"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'Create Cycle'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid gap-6">
            {isLoading ? (
              <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200">
                <Loader2 className="animate-spin inline text-[#1D9E75] mb-2" size={32} />
                <p>Loading cycles...</p>
              </div>
            ) : cycles.length === 0 ? (
              <div className="p-12 text-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200">
                No goal cycles found.
              </div>
            ) : (
              cycles.map(cycle => (
                <div key={cycle.id} className={`bg-white rounded-xl shadow-sm border p-6 relative overflow-hidden ${cycle.is_active ? 'border-[#1D9E75] ring-1 ring-[#1D9E75]' : 'border-gray-200'}`}>
                  {cycle.is_active && (
                    <div className="absolute top-0 right-0 bg-[#1D9E75] text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
                      ACTIVE CYCLE
                    </div>
                  )}
                  
                  <h2 className="text-2xl font-bold text-gray-900 mb-1">{cycle.name}</h2>
                  <p className="text-sm text-gray-500 mb-6 flex items-center gap-1">
                    <Clock size={14} /> Goal Setting Opened: {formatDate(cycle.goal_setting_opens)}
                  </p>

                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Q1</div>
                      <div className="text-sm font-medium text-gray-900">{formatDate(cycle.q1_opens)}</div>
                      <div className="text-xs text-gray-500">to {formatDate(cycle.q1_closes)}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Q2</div>
                      <div className="text-sm font-medium text-gray-900">{formatDate(cycle.q2_opens)}</div>
                      <div className="text-xs text-gray-500">to {formatDate(cycle.q2_closes)}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Q3</div>
                      <div className="text-sm font-medium text-gray-900">{formatDate(cycle.q3_opens)}</div>
                      <div className="text-xs text-gray-500">to {formatDate(cycle.q3_closes)}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Q4</div>
                      <div className="text-sm font-medium text-gray-900">{formatDate(cycle.q4_opens)}</div>
                      <div className="text-xs text-gray-500">to {formatDate(cycle.q4_closes)}</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

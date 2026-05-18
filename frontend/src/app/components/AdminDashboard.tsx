import { useState, useEffect } from 'react';
import AppSidebar from './AppSidebar';
import { Users, CheckCircle2, Clock, AlertTriangle, Loader2 } from 'lucide-react';

type UserRole = 'employee' | 'manager' | 'admin';
type Page = 'my-goals' | 'check-ins' | 'analytics' | 'reports' | 'team-dashboard' | 'approval-queue' | 'checkin-reviews' | 'admin-overview' | 'users-roles' | 'goal-cycles' | 'shared-goals' | 'audit-log' | 'escalations';

interface AdminDashboardProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  userRole: UserRole;
}

export default function AdminDashboard({ onNavigate, onLogout, userRole }: AdminDashboardProps) {
  const [employees, setEmployees] = useState<any[]>([]);
  const [activeEscalations, setActiveEscalations] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const { default: api } = await import('../../lib/api');
        
        // Fetch real users
        const { data: userData } = await api.get('/api/users');
        
        // Fetch heatmap data
        const { data: heatmapRes } = await api.get('/api/analytics/heatmap');
        const heatmapData = heatmapRes.heatmap || [];
        const heatmapMap = new Map(heatmapData.map((h: any) => [h.employee_id, h]));
        
        const mergedEmployees = (userData.users || []).map((u: any) => {
          const h = heatmapMap.get(u.id);
          return {
            ...u,
            q1: h?.q1 || 0,
            q2: h?.q2 || 0,
            q3: h?.q3 || 0,
            q4: h?.q4 || 0,
          };
        });
        setEmployees(mergedEmployees);

        // Fetch real escalations
        const { data: escData } = await api.get('/api/escalations');
        const active = (escData.escalations || []).filter((e: any) => !e.resolved).length;
        setActiveEscalations(active);

      } catch (err) {
        console.error('Failed to load admin dashboard data', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  const getCellColor = (score: number) => {
    if (score === 0) return 'bg-gray-200';
    if (score > 80) return 'bg-green-600';
    if (score >= 60) return 'bg-green-400';
    if (score >= 40) return 'bg-amber-400';
    return 'bg-red-400';
  };

  if (isLoading) {
    return (
      <div className="flex h-screen bg-[#F8FAF9]">
        <AppSidebar currentPage="admin-overview" onNavigate={onNavigate} onLogout={onLogout} userRole={userRole} />
        <div className="flex-1 flex items-center justify-center">
           <Loader2 className="animate-spin text-[#1D9E75]" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#F8FAF9]">
      <AppSidebar
        currentPage="admin-overview"
        onNavigate={onNavigate}
        onLogout={onLogout}
        userRole={userRole}
      />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <h1 className="text-3xl mb-6">Organization Overview — FY 2025-26</h1>

          {/* KPI Strip */}
          <div className="grid grid-cols-5 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center gap-3">
                <Users size={20} className="text-gray-600" />
                <div>
                  <div className="text-2xl font-bold">{employees.length}</div>
                  <div className="text-xs text-gray-600">Total Employees</div>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div>
                <div className="text-2xl font-bold">3</div>
                <div className="text-xs text-gray-600 mb-1">Goal Sheets Submitted</div>
                <div className="text-xs font-medium text-green-600">100%</div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div>
                <div className="text-2xl font-bold">2</div>
                <div className="text-xs text-gray-600 mb-1">Approved</div>
                <div className="text-xs font-medium text-green-600">66%</div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div>
                <div className="text-2xl font-bold">1</div>
                <div className="text-xs text-gray-600 mb-1">Q1 Check-ins Done</div>
                <div className="text-xs font-medium text-amber-600">33%</div>
              </div>
            </div>
            <div className="bg-red-50 rounded-xl shadow-sm border border-red-200 p-5">
              <div>
                <div className="text-2xl font-bold text-red-700">{activeEscalations}</div>
                <div className="text-xs text-red-600">Escalations Active</div>
              </div>
            </div>
          </div>

          {/* Completion Heatmap */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Goal Completion Heatmap — All Employees</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="text-left text-sm font-medium text-gray-700 pb-3 pr-8">Employee</th>
                    <th className="text-center text-sm font-medium text-gray-700 pb-3 px-3">Q1</th>
                    <th className="text-center text-sm font-medium text-gray-700 pb-3 px-3">Q2</th>
                    <th className="text-center text-sm font-medium text-gray-700 pb-3 px-3">Q3</th>
                    <th className="text-center text-sm font-medium text-gray-700 pb-3 px-3">Q4</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((emp) => {
                    const q1Score = emp.q1 || 0;
                    return (
                      <tr key={emp.id}>
                        <td className="text-sm text-gray-900 py-2 pr-8">{emp.name} <span className="text-xs text-gray-400">({emp.role})</span></td>
                        <td className="py-2 px-3">
                          <div className={`w-full h-10 rounded ${getCellColor(q1Score)} flex items-center justify-center text-white text-sm font-medium`}>
                            {q1Score > 0 ? `${Math.round(q1Score)}%` : ''}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className={`w-full h-10 rounded ${getCellColor(0)} flex items-center justify-center text-gray-500 text-xs`}>
                            🔒
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className={`w-full h-10 rounded ${getCellColor(0)} flex items-center justify-center text-gray-500 text-xs`}>
                            🔒
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <div className={`w-full h-10 rounded ${getCellColor(0)} flex items-center justify-center text-gray-500 text-xs`}>
                            🔒
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-4 mt-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-600 rounded" />
                <span className="text-gray-600">&gt;80%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-green-400 rounded" />
                <span className="text-gray-600">60-80%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-amber-400 rounded" />
                <span className="text-gray-600">40-60%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-400 rounded" />
                <span className="text-gray-600">&lt;40%</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-200 rounded" />
                <span className="text-gray-600">Locked</span>
              </div>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4">Goal Distribution by Thrust Area</h3>
              <p className="text-gray-500 text-sm">Chart placeholder</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold mb-4">Manager Effectiveness</h3>
              <p className="text-gray-500 text-sm">Chart placeholder</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

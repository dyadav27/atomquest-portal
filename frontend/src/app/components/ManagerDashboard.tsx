import { useState, useEffect } from 'react';
import AppSidebar from './AppSidebar';
import { Users, CheckCircle2, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import type { UserRole, Page, TeamMember } from '../types';

interface ManagerDashboardProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  userRole: UserRole;
}

interface TeamMemberStats extends TeamMember {
  goalsTotal: number;
  goalsPending: number;
  checkinSubmitted: boolean;
  risk: 'low' | 'medium' | 'high';
  progress: number;
  initials: string;
  color: string;
}

const AVATAR_COLORS = ['#1D9E75', '#7F77DD', '#BA7517', '#D85A30', '#0F6E56', '#2563eb', '#9333ea', '#db2777'];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function ManagerDashboard({ onNavigate, onLogout, userRole }: ManagerDashboardProps) {
  const [teamMembers, setTeamMembers] = useState<TeamMemberStats[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const { default: api } = await import('../../lib/api');

        const [teamRes, approvalRes] = await Promise.all([
          api.get('/api/users'),
          api.get('/api/users/team/pending-approvals'),
        ]);

        const members: TeamMember[] = teamRes.data?.users || [];
        const pending: any[] = approvalRes.data?.pendingGoals || [];
        setPendingApprovals(pending);

        // Enrich with goal/checkin stats
        const enriched: TeamMemberStats[] = await Promise.all(
          members.map(async (m, idx) => {
            let goalsTotal = 0, goalsPending = 0, checkinSubmitted = false, progress = 0;
            try {
              // Try to get goal counts per member
              const gRes = await api.get('/api/goals/team', { params: { employee_id: m.id } });
              const goals = gRes.data?.goals || [];
              goalsTotal = goals.length;
              goalsPending = goals.filter((g: any) => g.status === 'pending').length;

              const cRes = await api.get('/api/checkins', { params: { employee_id: m.id, quarter: 'q1' } });
              const checkins = cRes.data?.checkins || [];
              checkinSubmitted = checkins.some((c: any) => c.submitted_at);

              const scored = checkins.filter((c: any) => c.score !== null);
              progress = scored.length > 0
                ? Math.round(scored.reduce((s: number, c: any) => s + Number(c.score), 0) / scored.length)
                : 0;
            } catch { /* Use defaults if team endpoint not accessible */ }

            const risk: 'low' | 'medium' | 'high' =
              !checkinSubmitted && goalsPending > 1 ? 'high'
              : goalsPending > 0 ? 'medium'
              : 'low';

            return {
              ...m,
              goalsTotal,
              goalsPending,
              checkinSubmitted,
              risk,
              progress,
              initials: getInitials(m.name),
              color: AVATAR_COLORS[idx % AVATAR_COLORS.length],
            };
          })
        );

        setTeamMembers(enriched);
      } catch (err: any) {
        console.error('[ManagerDashboard] API unavailable', err);
        setPageError('Failed to load live data from server. Please check your connection.');
        setTeamMembers([]);
        setPendingApprovals([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const approvedSheets = teamMembers.filter(m => m.goalsPending === 0).length;
  const atRisk = teamMembers.filter(m => m.risk === 'high' || !m.checkinSubmitted).length;

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'low': return 'bg-green-100 text-green-700';
      case 'medium': return 'bg-amber-100 text-amber-700';
      case 'high': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  function daysAgo(dateStr: string) {
    const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
  }

  return (
    <div className="flex h-screen bg-[#F8FAF9]">
      <AppSidebar currentPage="team-dashboard" onNavigate={onNavigate} onLogout={onLogout} userRole={userRole} />

      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <h1 className="text-3xl mb-6">My Team — Current Quarter</h1>

          {pageError && (
            <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
              <AlertTriangle size={16} /> {pageError}
              <button onClick={() => setPageError('')} className="ml-auto">✕</button>
            </div>
          )}

          {/* Summary Stats */}
          <div className="grid grid-cols-4 gap-6 mb-8">
            {[
              { label: 'Team Members', value: teamMembers.length, icon: Users, color: 'blue' },
              { label: 'Goal Sheets Approved', value: approvedSheets, icon: CheckCircle2, color: 'green' },
              { label: 'Pending Approval', value: pendingApprovals.length, icon: Clock, color: 'amber' },
              { label: 'At Risk', value: atRisk, icon: AlertTriangle, color: 'red', highlight: true },
            ].map(({ label, value, icon: Icon, color, highlight }) => (
              <div key={label} className={`rounded-xl shadow-sm border p-6 ${highlight ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 bg-${color}-100 rounded-lg flex items-center justify-center`}>
                    <Icon size={24} className={`text-${color}-600`} />
                  </div>
                  <div>
                    <div className={`text-2xl font-bold ${highlight ? 'text-red-700' : 'text-gray-900'}`}>{value}</div>
                    <div className={`text-sm ${highlight ? 'text-red-600' : 'text-gray-600'}`}>{label}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Team Grid */}
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-[#1D9E75]" size={36} />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-6">
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className={`bg-white rounded-xl shadow-sm border-2 p-6 relative ${
                    member.risk === 'high' ? 'border-red-300' : 'border-gray-200'
                  }`}
                >
                  {member.risk === 'high' && (
                    <span className="absolute top-4 right-4 px-3 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                      Escalation Triggered
                    </span>
                  )}

                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold text-lg flex-shrink-0"
                      style={{ backgroundColor: member.color }}
                    >
                      {member.initials}
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">{member.name}</h3>
                      <p className="text-sm text-gray-600">{member.department || member.role}</p>
                    </div>
                  </div>

                  {/* Progress Ring */}
                  <div className="flex items-center justify-center mb-4">
                    <div className="relative w-32 h-32">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="64" cy="64" r="56" stroke="#e5e7eb" strokeWidth="8" fill="none" />
                        <circle
                          cx="64" cy="64" r="56"
                          stroke={member.color}
                          strokeWidth="8"
                          fill="none"
                          strokeDasharray={`${2 * Math.PI * 56}`}
                          strokeDashoffset={`${2 * Math.PI * 56 * (1 - member.progress / 100)}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-2xl font-bold text-gray-900">{member.progress}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-600">
                      {member.goalsTotal} Goals | {member.goalsTotal - member.goalsPending} Approved | {member.goalsPending} Pending
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-2 mb-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRiskBadge(member.risk)}`}>
                      {member.risk.charAt(0).toUpperCase() + member.risk.slice(1)} Risk
                    </span>
                    {member.checkinSubmitted ? (
                      <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium flex items-center gap-1">
                        <CheckCircle2 size={12} /> Check-in Submitted
                      </span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium flex items-center gap-1">
                        <AlertTriangle size={12} /> Not Submitted
                      </span>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => onNavigate('approval-queue')}
                      className="flex-1 px-4 py-2 border-2 border-[#1D9E75] text-[#1D9E75] rounded-lg hover:bg-green-50 transition-colors text-sm font-medium"
                    >
                      View Goals
                    </button>
                    <button
                      onClick={() => onNavigate('checkin-reviews')}
                      className="flex-1 px-4 py-2 bg-[#1D9E75] text-white rounded-lg hover:bg-[#178f68] transition-colors text-sm font-medium"
                    >
                      Review Check-in
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar — Quick Actions */}
      <div className="w-80 bg-white border-l border-gray-200 p-6 overflow-auto">
        <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>

        <div className="mb-6">
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <Clock size={16} /> Pending Approvals ({pendingApprovals.length})
          </h4>
          {pendingApprovals.length === 0 ? (
            <p className="text-sm text-gray-400">No pending approvals 🎉</p>
          ) : (
            <div className="space-y-3">
              {pendingApprovals.slice(0, 5).map((goal: any) => (
                <div key={goal.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900 truncate">{goal.employee?.name || 'Unknown'}</span>
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{daysAgo(goal.updated_at)}</span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2 truncate">{goal.title}</p>
                  <button
                    onClick={() => onNavigate('approval-queue')}
                    className="w-full px-3 py-2 bg-[#1D9E75] text-white rounded-lg hover:bg-[#178f68] transition-colors text-sm"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} /> At Risk Members
          </h4>
          {teamMembers.filter(m => m.risk === 'high').length === 0 ? (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <CheckCircle2 size={14} /> All team members on track
            </p>
          ) : (
            <div className="space-y-2">
              {teamMembers.filter(m => m.risk === 'high').map(m => (
                <div key={m.id} className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium flex-shrink-0" style={{ backgroundColor: m.color }}>
                      {m.initials}
                    </div>
                    <span className="text-sm font-medium text-red-900">{m.name}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

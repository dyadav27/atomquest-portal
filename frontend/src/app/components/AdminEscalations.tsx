import { useState, useEffect } from 'react';
import AppSidebar from './AppSidebar';
import { AlertTriangle, CheckCircle2, Clock, Loader2, Shield, Users, TrendingDown } from 'lucide-react';
import type { UserRole, Page, Escalation } from '../types';

interface AdminEscalationsProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  userRole: UserRole;
}

const RULE_LABELS: Record<string, string> = {
  goal_setting_miss:    'Goal Setting Not Submitted',
  checkin_miss:         'Check-in Not Submitted',
  low_score:            'Consistently Low Score',
  manager_review_miss:  'Manager Did Not Review',
};

const LEVEL_BADGES: Record<number, string> = {
  1: 'bg-amber-100 text-amber-700',
  2: 'bg-orange-100 text-orange-700',
  3: 'bg-red-100 text-red-700',
};

export default function AdminEscalations({ onNavigate, onLogout, userRole }: AdminEscalationsProps) {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'resolved' | 'all'>('active');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [manualTriggering, setManualTriggering] = useState(false);
  const [pageError, setPageError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadEscalations = async () => {
    setIsLoading(true);
    try {
      const { default: api } = await import('../../lib/api');
      const params: Record<string, any> = {};
      if (filter === 'active') params.resolved = false;
      if (filter === 'resolved') params.resolved = true;

      const { data } = await api.get('/api/escalations', { params });
      setEscalations(data.escalations || []);
    } catch {
      setPageError('Running in demo mode.');
      const now = new Date().toISOString();
      setEscalations([
        { id: 'e1', target_user_id: 'u1', rule_type: 'checkin_miss', level: 1, resolved: false, created_at: new Date(Date.now() - 2 * 86400000).toISOString(), target_user: { id: 'u1', name: 'Dev Patel', email: 'dev@atomquest.in', role: 'employee' } },
        { id: 'e2', target_user_id: 'u2', rule_type: 'goal_setting_miss', level: 2, resolved: false, created_at: new Date(Date.now() - 5 * 86400000).toISOString(), target_user: { id: 'u2', name: 'Amit Singh', email: 'amit@atomquest.in', role: 'employee' } },
        { id: 'e3', target_user_id: 'u3', rule_type: 'low_score', level: 1, resolved: false, created_at: new Date(Date.now() - 86400000).toISOString(), target_user: { id: 'u3', name: 'Kavita Joshi', email: 'kavita@atomquest.in', role: 'employee' } },
        { id: 'e4', target_user_id: 'u4', rule_type: 'checkin_miss', level: 1, resolved: true, resolved_at: now, created_at: new Date(Date.now() - 10 * 86400000).toISOString(), target_user: { id: 'u4', name: 'Sneha Reddy', email: 'sneha@atomquest.in', role: 'employee' } },
      ].filter(e => filter === 'all' || (filter === 'active' ? !e.resolved : e.resolved)));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { loadEscalations(); }, [filter]);

  const handleResolve = async (id: string) => {
    setResolvingId(id);
    setPageError('');
    try {
      const { default: api } = await import('../../lib/api');
      await api.post(`/api/escalations/${id}/resolve`);
      setEscalations(prev =>
        prev.map(e => e.id === id ? { ...e, resolved: true, resolved_at: new Date().toISOString() } : e)
      );
      setSuccessMsg('Escalation resolved.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setPageError(err.response?.data?.message || 'Resolve failed.');
    } finally {
      setResolvingId(null);
    }
  };

  const handleManualTrigger = async () => {
    setManualTriggering(true);
    setPageError('');
    try {
      const { default: api } = await import('../../lib/api');
      const { data } = await api.post('/api/escalations/trigger');
      setSuccessMsg(`Escalation engine ran. ${data.new_escalations ?? 0} new escalation(s) created.`);
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadEscalations();
    } catch (err: any) {
      setPageError(err.response?.data?.message || 'Trigger failed.');
    } finally {
      setManualTriggering(false);
    }
  };

  const active = escalations.filter(e => !e.resolved);
  const resolved = escalations.filter(e => e.resolved);

  function daysAgo(dateStr: string) {
    const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`;
  }

  return (
    <div className="flex h-screen bg-[#F8FAF9]">
      <AppSidebar currentPage="escalations" onNavigate={onNavigate} onLogout={onLogout} userRole={userRole} />

      <div className="flex-1 overflow-auto p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl">Escalations</h1>
            <p className="text-sm text-gray-500 mt-1">Automated alerts for unsubmitted goals, missed check-ins, and low performance.</p>
          </div>
          <button
            onClick={handleManualTrigger}
            disabled={manualTriggering}
            className="flex items-center gap-2 px-4 py-2 bg-[#1D9E75] text-white rounded-lg hover:bg-[#178f68] transition-colors text-sm font-medium disabled:opacity-60"
          >
            {manualTriggering ? <Loader2 size={16} className="animate-spin" /> : <Shield size={16} />}
            Run Engine Now
          </button>
        </div>

        {/* Banners */}
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

        {/* Stats Strip */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle size={20} className="text-red-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{active.length}</div>
              <div className="text-sm text-gray-500">Active Escalations</div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <TrendingDown size={20} className="text-amber-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{active.filter(e => e.level >= 2).length}</div>
              <div className="text-sm text-gray-500">Level 2+ (Critical)</div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 size={20} className="text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{resolved.length}</div>
              <div className="text-sm text-gray-500">Resolved</div>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4">
          {(['active', 'resolved', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                filter === f ? 'bg-[#1D9E75] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Escalation List */}
        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#1D9E75]" size={36} /></div>
        ) : escalations.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            {filter === 'active' ? (
              <>
                <CheckCircle2 size={48} className="text-green-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">No active escalations!</h3>
                <p className="text-gray-500">Your team is on track. Escalation engine runs nightly.</p>
              </>
            ) : (
              <p className="text-gray-500">No {filter} escalations found.</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {escalations.map(e => (
              <div
                key={e.id}
                className={`bg-white rounded-xl shadow-sm border-l-4 border border-gray-200 p-5 flex items-start gap-4 ${
                  e.resolved
                    ? 'border-l-green-400 opacity-75'
                    : e.level >= 3
                    ? 'border-l-red-500'
                    : e.level === 2
                    ? 'border-l-orange-400'
                    : 'border-l-amber-400'
                }`}
              >
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-700 font-semibold flex-shrink-0">
                  {e.target_user?.name.split(' ').map(n => n[0]).join('').slice(0, 2) || 'U'}
                </div>

                {/* Details */}
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">{e.target_user?.name || e.target_user_id}</h3>
                      <p className="text-sm text-gray-500">{e.target_user?.email}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${LEVEL_BADGES[e.level] || 'bg-gray-100 text-gray-600'}`}>
                        Level {e.level}
                      </span>
                      {e.resolved && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Resolved
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-2 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle size={14} className="text-amber-500" />
                      <span className="text-sm font-medium text-gray-700">
                        {RULE_LABELS[e.rule_type] || e.rule_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock size={12} />
                      Created {daysAgo(e.created_at)}
                    </div>
                    {e.resolved_at && (
                      <div className="flex items-center gap-1.5 text-xs text-green-600">
                        <CheckCircle2 size={12} />
                        Resolved {daysAgo(e.resolved_at)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Action */}
                {!e.resolved && (
                  <button
                    onClick={() => handleResolve(e.id)}
                    disabled={resolvingId === e.id}
                    className="flex items-center gap-2 px-4 py-2 bg-[#1D9E75] text-white rounded-lg hover:bg-[#178f68] transition-colors text-sm font-medium flex-shrink-0 disabled:opacity-60"
                  >
                    {resolvingId === e.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <CheckCircle2 size={14} />}
                    Resolve
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

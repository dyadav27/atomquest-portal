import { useState, useEffect, useCallback } from 'react';
import AppSidebar from './AppSidebar';
import { Search, Filter, ChevronLeft, ChevronRight, Loader2, AlertTriangle, Clock } from 'lucide-react';
import type { UserRole, Page, AuditLog } from '../types';

interface AdminAuditLogProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  userRole: UserRole;
}

const ENTITY_TYPES = ['all', 'goal', 'checkin', 'user', 'cycle', 'escalation'];
const ACTIONS = ['all', 'created', 'updated', 'approved', 'returned', 'deleted', 'submitted', 'resolved'];

export default function AdminAuditLog({ onNavigate, onLogout, userRole }: AdminAuditLogProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [entityFilter, setEntityFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [pageError, setPageError] = useState('');

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const { default: api } = await import('../../lib/api');
      const params: Record<string, any> = { page, limit: PAGE_SIZE };
      if (entityFilter !== 'all') params.entity_type = entityFilter;
      if (actionFilter !== 'all') params.action = actionFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const { data } = await api.get('/api/audit', { params });
      setLogs(data.logs || []);
      setTotal(data.total || 0);
    } catch {
      setPageError('Running in demo mode — live audit data unavailable.');
      const now = new Date();
      setLogs([
        { id: '1', entity_type: 'goal', entity_id: 'g1', action: 'created', changed_by: 'u1', after_state: { title: 'Reduce churn rate' }, created_at: new Date(now.getTime() - 5 * 60000).toISOString(), actor: { id: 'u1', name: 'Priya Sharma', email: '', role: 'employee' } },
        { id: '2', entity_type: 'goal', entity_id: 'g1', action: 'approved', changed_by: 'u2', reason: 'Goal is well-defined', created_at: new Date(now.getTime() - 3 * 60000).toISOString(), actor: { id: 'u2', name: 'Rahul Mehta', email: '', role: 'manager' } },
        { id: '3', entity_type: 'checkin', entity_id: 'ci1', action: 'submitted', changed_by: 'u1', after_state: { actual: 3.5, score: 70 }, created_at: new Date(now.getTime() - 1 * 60000).toISOString(), actor: { id: 'u1', name: 'Priya Sharma', email: '', role: 'employee' } },
        { id: '4', entity_type: 'escalation', entity_id: 'e1', action: 'created', changed_by: 'system', after_state: { rule_type: 'checkin_miss', level: 1 }, created_at: now.toISOString(), actor: { id: 'system', name: 'System', email: '', role: 'admin' } },
      ]);
      setTotal(4);
    } finally {
      setIsLoading(false);
    }
  }, [page, entityFilter, actionFilter, searchTerm]);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); loadLogs(); }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const getEntityBadge = (type: string) => {
    const map: Record<string, string> = {
      goal: 'bg-blue-100 text-blue-700',
      checkin: 'bg-green-100 text-green-700',
      user: 'bg-purple-100 text-purple-700',
      cycle: 'bg-orange-100 text-orange-700',
      escalation: 'bg-red-100 text-red-700',
    };
    return map[type] || 'bg-gray-100 text-gray-600';
  };

  const getActionBadge = (action: string) => {
    const map: Record<string, string> = {
      created:   'bg-blue-50 text-blue-600',
      updated:   'bg-amber-50 text-amber-600',
      approved:  'bg-green-50 text-green-600',
      returned:  'bg-red-50 text-red-600',
      deleted:   'bg-red-100 text-red-700',
      submitted: 'bg-teal-50 text-teal-600',
      resolved:  'bg-green-100 text-green-700',
    };
    return map[action] || 'bg-gray-50 text-gray-600';
  };

  function timeAgo(dateStr: string) {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  return (
    <div className="flex h-screen bg-[#F8FAF9]">
      <AppSidebar currentPage="audit-log" onNavigate={onNavigate} onLogout={onLogout} userRole={userRole} />

      <div className="flex-1 overflow-auto p-8">
        <h1 className="text-3xl mb-6">Audit Log</h1>

        {pageError && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
            <AlertTriangle size={16} /> {pageError}
            <button onClick={() => setPageError('')} className="ml-auto">✕</button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-48 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search actor, entity…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={entityFilter}
              onChange={e => { setEntityFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] capitalize"
            >
              {ENTITY_TYPES.map(t => <option key={t} value={t}>{t === 'all' ? 'All entities' : t}</option>)}
            </select>

            <select
              value={actionFilter}
              onChange={e => { setActionFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75] capitalize"
            >
              {ACTIONS.map(a => <option key={a} value={a}>{a === 'all' ? 'All actions' : a}</option>)}
            </select>
          </div>

          <span className="text-sm text-gray-500">{total} entries</span>
        </div>

        {/* Log Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="animate-spin text-[#1D9E75]" size={32} /></div>
          ) : logs.length === 0 ? (
            <div className="p-12 text-center text-gray-500">No audit logs match your filters.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 uppercase">Time</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 uppercase">Actor</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 uppercase">Action</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 uppercase">Entity</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 uppercase">Reason / Details</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-gray-600 uppercase">Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map(log => (
                  <>
                    <tr
                      key={log.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpanded(expanded === log.id ? null : log.id)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <Clock size={12} />
                          {timeAgo(log.created_at)}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <div className="font-medium text-gray-900">{log.actor?.name || log.changed_by}</div>
                        <div className="text-xs text-gray-500 capitalize">{log.actor?.role || ''}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium capitalize ${getActionBadge(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 rounded-md text-xs font-medium capitalize ${getEntityBadge(log.entity_type)}`}>
                          {log.entity_type}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {log.reason || (log.after_state ? JSON.stringify(log.after_state).slice(0, 60) + '…' : '—')}
                      </td>
                      <td className="px-5 py-3">
                        {(log.before_state || log.after_state) && (
                          <span className="text-xs text-[#1D9E75] underline cursor-pointer">View</span>
                        )}
                      </td>
                    </tr>

                    {/* Expanded diff */}
                    {expanded === log.id && (log.before_state || log.after_state) && (
                      <tr key={`${log.id}-exp`} className="bg-gray-50">
                        <td colSpan={6} className="px-5 py-4">
                          <div className="grid grid-cols-2 gap-4">
                            {log.before_state && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">Before</p>
                                <pre className="text-xs bg-red-50 border border-red-200 rounded-lg p-3 overflow-auto max-h-40 text-red-800">
                                  {JSON.stringify(log.before_state, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.after_state && (
                              <div>
                                <p className="text-xs font-semibold text-gray-500 mb-1 uppercase">After</p>
                                <pre className="text-xs bg-green-50 border border-green-200 rounded-lg p-3 overflow-auto max-h-40 text-green-800">
                                  {JSON.stringify(log.after_state, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={16} /> Previous
              </button>
              <span className="text-sm text-gray-600 px-2">Page {page} of {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

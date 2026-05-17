import { useState, useEffect } from 'react';
import AppSidebar from './AppSidebar';
import { Sparkles, Send, Loader2, AlertTriangle, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import type { UserRole, Page } from '../types';

interface ManagerCheckinReviewProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  userRole: UserRole;
}

interface CheckinEntry {
  checkinId: string;
  goalId: string;
  goalTitle: string;
  thrustArea: string;
  employeeId: string;
  employeeName: string;
  quarter: string;
  planned: number | null;
  actual: number | null;
  score: number | null;
  submittedAt: string | null;
  comments: { id: string; comment: string; ai_generated: boolean; created_at: string; actor?: { name: string } }[];
}

export default function ManagerCheckinReview({ onNavigate, onLogout, userRole }: ManagerCheckinReviewProps) {
  const [checkins, setCheckins] = useState<CheckinEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [commentLoading, setCommentLoading] = useState<Record<string, boolean>>({});
  const [pageError, setPageError] = useState('');
  const [quarterFilter, setQuarterFilter] = useState('q1');

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const { default: api } = await import('../../lib/api');

        // Get team members first
        const teamRes = await api.get('/api/users');
        const members = teamRes.data?.users || [];

        const allCheckins: CheckinEntry[] = [];

        for (const m of members) {
          try {
            const ciRes = await api.get('/api/checkins', { params: { employee_id: m.id, quarter: quarterFilter } });
            const cis = ciRes.data?.checkins || [];
            for (const c of cis) {
              if (!c.submitted_at) continue; // Only show submitted
              allCheckins.push({
                checkinId: c.id,
                goalId: c.goal_id,
                goalTitle: c.goal?.title || 'Goal',
                thrustArea: c.goal?.thrust_area || '',
                employeeId: m.id,
                employeeName: m.name,
                quarter: c.quarter,
                planned: c.planned,
                actual: c.actual,
                score: c.score,
                submittedAt: c.submitted_at,
                comments: c.comments || [],
              });
            }
          } catch { /* Skip if employee has no checkins */ }
        }

        setCheckins(allCheckins);
      } catch {
        setPageError('Running in demo mode.');
        setCheckins([
          { checkinId: 'ci1', goalId: 'g1', goalTitle: 'Reduce customer churn', thrustArea: 'Customer Success', employeeId: 'e1', employeeName: 'Priya Sharma', quarter: 'q1', planned: 5, actual: 3.5, score: 70, submittedAt: new Date().toISOString(), comments: [] },
          { checkinId: 'ci2', goalId: 'g2', goalTitle: 'Launch 3 features', thrustArea: 'Innovation', employeeId: 'e1', employeeName: 'Priya Sharma', quarter: 'q1', planned: 1, actual: 1, score: 100, submittedAt: new Date().toISOString(), comments: [] },
          { checkinId: 'ci3', goalId: 'g3', goalTitle: 'Improve deployment frequency', thrustArea: 'Operational Excellence', employeeId: 'e2', employeeName: 'Anita Desai', quarter: 'q1', planned: 5, actual: 3, score: 60, submittedAt: new Date().toISOString(), comments: [] },
        ]);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [quarterFilter]);

  const handleDraftComment = async (entry: CheckinEntry) => {
    setAiLoading(prev => ({ ...prev, [entry.checkinId]: true }));
    try {
      const { draftComment } = await import('../../lib/ai');
      const result = await draftComment({
        employee_name: entry.employeeName,
        goal_title: entry.goalTitle,
        planned: entry.planned,
        actual: entry.actual,
        status: entry.score !== null ? (entry.score >= 70 ? 'On track' : 'At risk') : 'Submitted',
        score: entry.score,
      });
      if (result.comment) {
        setComments(prev => ({ ...prev, [entry.checkinId]: result.comment }));
      }
    } catch {
      setPageError('AI draft failed. Please write your comment manually.');
    } finally {
      setAiLoading(prev => ({ ...prev, [entry.checkinId]: false }));
    }
  };

  const handlePostComment = async (entry: CheckinEntry, aiGenerated = false) => {
    const text = comments[entry.checkinId]?.trim();
    if (!text) return;

    setCommentLoading(prev => ({ ...prev, [entry.checkinId]: true }));
    try {
      const { default: api } = await import('../../lib/api');
      const { data } = await api.post(`/api/checkins/${entry.checkinId}/comment`, {
        comment: text,
        ai_generated: aiGenerated,
      });

      setCheckins(prev =>
        prev.map(c =>
          c.checkinId === entry.checkinId
            ? { ...c, comments: [...c.comments, data.comment] }
            : c
        )
      );
      setComments(prev => { const n = { ...prev }; delete n[entry.checkinId]; return n; });
    } catch (err: any) {
      setPageError(err.response?.data?.message || 'Comment post failed.');
    } finally {
      setCommentLoading(prev => ({ ...prev, [entry.checkinId]: false }));
    }
  };

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-500';
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-amber-600';
    return 'text-red-600';
  };

  const getScoreBg = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-500';
    if (score >= 70) return 'bg-green-100 text-green-700';
    if (score >= 40) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  };

  // Group by employee
  const byEmployee: Record<string, { name: string; entries: CheckinEntry[] }> = {};
  checkins.forEach(c => {
    if (!byEmployee[c.employeeId]) byEmployee[c.employeeId] = { name: c.employeeName, entries: [] };
    byEmployee[c.employeeId].entries.push(c);
  });

  return (
    <div className="flex h-screen bg-[#F8FAF9]">
      <AppSidebar currentPage="checkin-reviews" onNavigate={onNavigate} onLogout={onLogout} userRole={userRole} />

      <div className="flex-1 overflow-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl">Check-in Reviews</h1>
          <select
            value={quarterFilter}
            onChange={e => setQuarterFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
          >
            {['q1', 'q2', 'q3', 'q4'].map(q => (
              <option key={q} value={q}>{q.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {pageError && (
          <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-center gap-2">
            <AlertTriangle size={16} /> {pageError}
            <button onClick={() => setPageError('')} className="ml-auto">✕</button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#1D9E75]" size={36} /></div>
        ) : checkins.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center text-gray-500">
            No submitted check-ins found for {quarterFilter.toUpperCase()}.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.values(byEmployee).map(({ name, entries }) => (
              <div key={name} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#1D9E75] flex items-center justify-center text-white font-semibold text-sm">
                    {name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{name}</h3>
                    <p className="text-xs text-gray-500">{entries.length} goal{entries.length !== 1 ? 's' : ''} submitted</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    {entries.every(e => (e.score ?? 0) >= 70) ? (
                      <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">On Track</span>
                    ) : entries.some(e => (e.score ?? 100) < 40) ? (
                      <span className="px-3 py-1 rounded-full bg-red-100 text-red-700 text-xs font-medium">At Risk</span>
                    ) : (
                      <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">Needs Attention</span>
                    )}
                  </div>
                </div>

                {entries.map(entry => (
                  <div key={entry.checkinId} className="border-b border-gray-100 last:border-b-0">
                    <button
                      onClick={() => setExpandedId(expandedId === entry.checkinId ? null : entry.checkinId)}
                      className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className="text-left">
                          <p className="text-sm font-medium text-gray-900">{entry.goalTitle}</p>
                          <p className="text-xs text-gray-500">{entry.thrustArea}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-gray-600">
                            Planned: <span className="font-medium">{entry.planned ?? '—'}</span>
                            <span className="mx-2">→</span>
                            Actual: <span className="font-medium">{entry.actual ?? '—'}</span>
                          </div>
                          {entry.score !== null && (
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${getScoreBg(entry.score)}`}>
                              {Math.round(entry.score)}%
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {entry.comments.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <MessageSquare size={12} /> {entry.comments.length}
                          </span>
                        )}
                        {expandedId === entry.checkinId ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </button>

                    {expandedId === entry.checkinId && (
                      <div className="px-6 pb-6 bg-gray-50 border-t border-gray-100">
                        {/* Existing Comments */}
                        {entry.comments.length > 0 && (
                          <div className="mt-4 space-y-3 mb-4">
                            {entry.comments.map(c => (
                              <div key={c.id} className={`p-3 rounded-lg border text-sm ${c.ai_generated ? 'bg-[#7F77DD]/5 border-[#7F77DD]/30' : 'bg-white border-gray-200'}`}>
                                <div className="flex items-center gap-2 mb-1">
                                  {c.ai_generated && <Sparkles size={12} className="text-[#7F77DD]" />}
                                  <span className="text-xs text-gray-500">{c.actor?.name || 'Manager'} · {new Date(c.created_at).toLocaleDateString('en-IN')}</span>
                                </div>
                                <p className="text-gray-700">{c.comment}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Add Comment */}
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-2">Add Review Comment</label>
                          <textarea
                            rows={3}
                            value={comments[entry.checkinId] || ''}
                            onChange={e => setComments(prev => ({ ...prev, [entry.checkinId]: e.target.value }))}
                            placeholder="Write your assessment…"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] text-sm resize-none"
                          />
                          <div className="flex gap-3 mt-3">
                            <button
                              onClick={() => handleDraftComment(entry)}
                              disabled={aiLoading[entry.checkinId]}
                              className="flex items-center gap-2 px-4 py-2 border-2 border-[#7F77DD] text-[#7F77DD] rounded-lg hover:bg-purple-50 transition-colors text-sm font-medium disabled:opacity-60"
                            >
                              {aiLoading[entry.checkinId] ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                              Draft with AI
                            </button>
                            <button
                              onClick={() => handlePostComment(entry, !!aiLoading[entry.checkinId])}
                              disabled={!comments[entry.checkinId]?.trim() || commentLoading[entry.checkinId]}
                              className="flex items-center gap-2 px-4 py-2 bg-[#1D9E75] text-white rounded-lg hover:bg-[#178f68] transition-colors text-sm font-medium disabled:opacity-60"
                            >
                              {commentLoading[entry.checkinId] ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                              Post Comment
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { X, Sparkles, Lightbulb, TrendingUp, RefreshCw, Loader2 } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import type { Goal } from '../types';

interface DNAScorePanelProps {
  goal: Goal;
  onClose: () => void;
}

const getBarColor = (score: number) => {
  if (score >= 80) return '#1D9E75';
  if (score >= 60) return '#BA7517';
  return '#D85A30';
};

export default function DNAScorePanel({ goal, onClose }: DNAScorePanelProps) {
  const [dna, setDna] = useState(goal.dna_score ?? null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [feedback, setFeedback] = useState(goal.dna_score?.feedback ?? '');

  const overallScore = dna?.total ?? null;

  const radarData = dna
    ? [
        { dimension: 'Specificity', value: dna.specificity, fullMark: 100 },
        { dimension: 'Ambition',    value: dna.ambition,    fullMark: 100 },
        { dimension: 'Alignment',   value: dna.alignment,   fullMark: 100 },
        { dimension: 'Risk',        value: dna.risk,        fullMark: 100 },
      ]
    : [
        { dimension: 'Specificity', value: 85, fullMark: 100 },
        { dimension: 'Ambition',    value: 70, fullMark: 100 },
        { dimension: 'Alignment',   value: 90, fullMark: 100 },
        { dimension: 'Risk',        value: 65, fullMark: 100 },
      ];

  const barData = dna
    ? [
        { name: 'Specificity', score: dna.specificity },
        { name: 'Ambition',    score: dna.ambition },
        { name: 'Alignment',   score: dna.alignment },
        { name: 'Risk',        score: dna.risk },
      ]
    : [
        { name: 'Specificity', score: 85 },
        { name: 'Ambition',    score: 70 },
        { name: 'Alignment',   score: 90 },
        { name: 'Risk',        score: 65 },
      ];

  const handleRefreshScore = async () => {
    setIsRefreshing(true);
    try {
      const { getDnaScore } = await import('../../lib/ai');
      const result = await getDnaScore({
        title: goal.title,
        description: goal.description,
        uom_type: goal.uom_type,
        uom_direction: goal.uom_direction,
        target: goal.target,
        thrust_area: goal.thrust_area,
        goal_id: goal.id,
      });
      if (result.score && !result.fallback) {
        setDna(result.score);
        setFeedback(result.score.feedback ?? '');
      }
    } catch {
      // Silently fail
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Sparkles size={20} className="text-[#7F77DD]" />
            <h2 className="text-xl font-semibold">Goal Intelligence Report</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Goal Info */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{goal.title}</h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">
                {goal.thrust_area}
              </span>
              <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">
                {goal.uom_type.toUpperCase()} · {goal.uom_direction.toUpperCase()}
              </span>
              <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">
                Target: {goal.target}
              </span>
            </div>
          </div>

          {/* Overall Score */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 text-center">
            {overallScore !== null ? (
              <>
                <div className="text-6xl font-bold text-[#1D9E75] mb-1">
                  {Math.round(overallScore)}<span className="text-2xl text-gray-400">/100</span>
                </div>
                <div className="text-sm text-gray-700 font-medium">Overall DNA Score</div>
              </>
            ) : (
              <div className="py-4">
                <p className="text-gray-500 text-sm mb-3">No DNA score yet</p>
                <button
                  onClick={handleRefreshScore}
                  disabled={isRefreshing}
                  className="px-4 py-2 bg-[#1D9E75] text-white rounded-lg text-sm font-medium hover:bg-[#178f68] transition-colors disabled:opacity-60 flex items-center gap-2 mx-auto"
                >
                  {isRefreshing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  Score with AI
                </button>
              </div>
            )}
          </div>

          {/* Score Breakdown */}
          <div className="space-y-3">
            <h4 className="font-semibold text-gray-900">Score Breakdown</h4>
            {barData.map((item) => (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{item.name}</span>
                  <span className="font-semibold" style={{ color: getBarColor(item.score) }}>
                    {item.score}/100
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all rounded-full"
                    style={{ width: `${item.score}%`, backgroundColor: getBarColor(item.score) }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Radar Chart */}
          <div>
            <h4 className="font-semibold text-gray-900 mb-3">Performance Radar</h4>
            <div className="h-64 bg-gray-50 rounded-xl p-4">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#cbd5e1" />
                  <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 12, fill: '#64748b' }} />
                  <Radar dataKey="value" stroke="#1D9E75" fill="#1D9E75" fillOpacity={0.4} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI Feedback */}
          <div className="bg-gradient-to-br from-[#7F77DD]/10 to-[#7F77DD]/5 rounded-xl border border-[#7F77DD]/30 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={18} className="text-[#7F77DD]" />
              <h4 className="font-semibold text-gray-900">Claude's Assessment</h4>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              {feedback ||
                'This goal demonstrates good alignment with organizational objectives. Use the "Refresh Score" button to get an AI-generated assessment.'}
            </p>
            <div className="flex items-start gap-2 bg-white/60 rounded-lg p-3">
              <Lightbulb size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-xs font-semibold text-gray-900 mb-1">Improvement Tip</div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Consider breaking this annual goal into quarterly milestones to track progress more effectively.
                </p>
              </div>
            </div>
          </div>

          {/* Year-end Projection */}
          <div className="bg-gray-50 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={18} className="text-gray-700" />
              <h4 className="font-semibold text-gray-900">Year-end Projection</h4>
            </div>
            <p className="text-xs text-gray-500">
              Connect quarterly check-ins to enable AI-powered Q4 outcome prediction.
            </p>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleRefreshScore}
              disabled={isRefreshing}
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isRefreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Refresh Score
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-[#1D9E75] text-white rounded-lg hover:bg-[#178f68] transition-colors font-medium text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

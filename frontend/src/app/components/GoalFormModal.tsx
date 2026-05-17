import { useState, useEffect } from 'react';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer } from 'recharts';
import type { Goal } from '../types';

interface GoalFormModalProps {
  goal: Goal | null;
  onClose: () => void;
  onSave: (goal: Partial<Goal>) => Promise<void>;
  remainingWeightage: number;
}

const thrustAreas = [
  'Customer Success', 'Innovation', 'Operational Excellence', 'People & Culture', 'Revenue Growth'
];

// Values match DB enum exactly: numeric | percent | timeline | zero
const uomTypes = [
  { id: 'numeric',  label: 'Numeric',  description: 'Count or number value' },
  { id: 'percent',  label: '%',        description: 'Percentage value' },
  { id: 'timeline', label: 'Timeline', description: 'Date-based completion' },
  { id: 'zero',     label: 'Zero',     description: 'Binary — must reach zero' },
];

// Values match DB enum exactly: min | max | timeline | zero
const directions = [
  { id: 'max',      label: 'Higher is Better', description: 'Maximize this metric (e.g. revenue, NPS)' },
  { id: 'min',      label: 'Lower is Better',  description: 'Minimize this metric (e.g. churn, defects)' },
  { id: 'zero',     label: 'Zero Target',      description: 'Must reach exactly zero (e.g. incidents)' },
  { id: 'timeline', label: 'On-Time',           description: 'Complete before deadline' },
];

export default function GoalFormModal({ goal, onClose, onSave, remainingWeightage }: GoalFormModalProps) {
  const [thrustArea, setThrustArea] = useState(goal?.thrust_area || '');
  const [title, setTitle] = useState(goal?.title || '');
  const [description, setDescription] = useState(goal?.description || '');
  const [uomType, setUomType] = useState<Goal['uom_type']>(goal?.uom_type || 'numeric');
  const [direction, setDirection] = useState<Goal['uom_direction']>(goal?.uom_direction || 'max');
  const [target, setTarget] = useState(goal?.target?.toString() || '');
  const [weightage, setWeightage] = useState(goal?.weightage?.toString() || '');
  const [isSaving, setIsSaving] = useState(false);
  const [dnaScore, setDnaScore] = useState<number | null>(goal?.dna_score?.total ?? null);
  const [dnaDetails, setDnaDetails] = useState<Goal['dna_score'] | null>(goal?.dna_score ?? null);
  const [dnaLoading, setDnaLoading] = useState(false);
  const [showDNAPreview, setShowDNAPreview] = useState(!!(title && description));

  // Auto-show DNA preview when title + description filled
  useEffect(() => {
    setShowDNAPreview(!!(title && description));
  }, [title, description]);

  const radarData = dnaDetails
    ? [
        { dimension: 'Specificity', value: dnaDetails.specificity },
        { dimension: 'Ambition',    value: dnaDetails.ambition },
        { dimension: 'Alignment',   value: dnaDetails.alignment },
        { dimension: 'Risk',        value: dnaDetails.risk },
      ]
    : [
        { dimension: 'Specificity', value: 85 },
        { dimension: 'Ambition',    value: 70 },
        { dimension: 'Alignment',   value: 90 },
        { dimension: 'Risk',        value: 82 },
      ];

  const getGoalPayload = (): Partial<Goal> => ({
    thrust_area: thrustArea,
    title,
    description,
    uom_type: uomType,
    uom_direction: direction,
    target: Number(target),
    weightage: Number(weightage),
    ...(dnaDetails ? { dna_score: dnaDetails } : {}),
  });

  const handleSaveDraft = async () => {
    setIsSaving(true);
    await onSave({ ...getGoalPayload(), status: 'draft' });
    setIsSaving(false);
  };

  const handleSaveAndScore = async () => {
    setIsSaving(true);
    setDnaLoading(true);

    let scoreResult = dnaDetails;

    try {
      const { getDnaScore } = await import('../../lib/ai');
      const result = await getDnaScore({
        title, description, uom_type: uomType, uom_direction: direction,
        target: Number(target), thrust_area: thrustArea,
        goal_id: goal?.id,
      });

      if (result.score && !result.fallback) {
        scoreResult = result.score;
        setDnaDetails(result.score);
        setDnaScore(result.score.total);
      }
    } catch {
      // Silently fall through — save without score
    } finally {
      setDnaLoading(false);
    }

    await onSave({ ...getGoalPayload(), dna_score: scoreResult ?? undefined });
    setIsSaving(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-2xl">{goal?.id ? 'Edit Goal' : 'Add New Goal'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-5">
              {/* Thrust Area */}
              <div>
                <label className="block text-sm mb-2 text-gray-700">Thrust Area</label>
                <select
                  value={thrustArea}
                  onChange={(e) => setThrustArea(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  required
                >
                  <option value="">Select thrust area...</option>
                  {thrustAreas.map(area => <option key={area} value={area}>{area}</option>)}
                </select>
              </div>

              {/* Goal Title */}
              <div>
                <label className="block text-sm mb-2 text-gray-700">Goal Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Reduce customer churn rate"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm mb-2 text-gray-700">Goal Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your goal in detail..."
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] resize-none"
                />
              </div>

              {/* UoM Type */}
              <div>
                <label className="block text-sm mb-2 text-gray-700">Unit of Measurement</label>
                <div className="grid grid-cols-2 gap-3">
                  {uomTypes.map(type => (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() => setUomType(type.id as Goal['uom_type'])}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${uomType === type.id ? 'border-[#1D9E75] bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="font-medium text-gray-900">{type.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{type.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Direction */}
              <div>
                <label className="block text-sm mb-2 text-gray-700">Direction</label>
                <div className="grid grid-cols-2 gap-3">
                  {directions.map(dir => (
                    <button
                      key={dir.id}
                      type="button"
                      onClick={() => setDirection(dir.id as Goal['uom_direction'])}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${direction === dir.id ? 'border-[#1D9E75] bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <div className="font-medium text-gray-900">{dir.label}</div>
                      <div className="text-xs text-gray-500 mt-1">{dir.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Target and Weightage */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2 text-gray-700">Target</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      placeholder="15"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                      required
                    />
                    {uomType === 'percent' && (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm mb-2 text-gray-700">Weightage</label>
                  <div className="relative">
                    <input
                      type="number"
                      min={10}
                      max={remainingWeightage}
                      value={weightage}
                      onChange={(e) => setWeightage(e.target.value)}
                      placeholder="25"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75]"
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Min 10%, remaining: {remainingWeightage}%</p>
                </div>
              </div>
            </div>

            {/* Right Column - DNA Preview */}
            {showDNAPreview && (
              <div className="lg:col-span-1">
                <div className="sticky top-6 bg-gradient-to-br from-[#7F77DD]/10 to-[#7F77DD]/5 rounded-xl border-2 border-[#7F77DD]/30 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles size={18} className="text-[#7F77DD]" />
                    <h3 className="font-medium text-gray-900">Goal Quality Preview</h3>
                  </div>

                  <div className="h-48 mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData}>
                        <PolarGrid stroke="#cbd5e1" />
                        <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: '#64748b' }} />
                        <Radar dataKey="value" stroke="#7F77DD" fill="#7F77DD" fillOpacity={0.4} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="text-center mb-4">
                    {dnaScore !== null ? (
                      <>
                        <div className="text-4xl font-bold text-[#1D9E75]">
                          {Math.round(dnaScore)}<span className="text-xl text-gray-400">/100</span>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">DNA Score</div>
                        {dnaDetails?.feedback && (
                          <p className="text-xs text-gray-500 mt-2 leading-relaxed">{dnaDetails.feedback}</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">Click "Save & Score with AI" to get your DNA score</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 mt-8 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={!title || !thrustArea || !target || !weightage || isSaving}
              className="px-6 py-3 border-2 border-[#1D9E75] text-[#1D9E75] rounded-lg hover:bg-green-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving && !dnaLoading ? <Loader2 size={16} className="animate-spin inline mr-2" /> : null}
              Save Draft
            </button>
            <button
              type="button"
              onClick={handleSaveAndScore}
              disabled={!title || !thrustArea || !target || !weightage || isSaving}
              className="px-6 py-3 bg-[#1D9E75] text-white rounded-lg hover:bg-[#178f68] transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {dnaLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Save & Score with AI
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

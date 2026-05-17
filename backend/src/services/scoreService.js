'use strict';

/**
 * ScoreService — computes a 0-100 performance score for a goal checkin.
 *
 * Formula by UoM direction:
 *   max:      score = min((actual / target) * 100, 100)
 *   min:      score = min((target / actual) * 100, 100)  [lower actual = better]
 *   zero:     score = actual === 0 ? 100 : 0
 *   timeline: handled externally with date logic; returns null from this function
 *
 * This formula is kept identical to:
 *   - frontend/src/lib/utils.js :: computeScore
 *   - supabase/migrations/003_functions.sql :: compute_score()
 *
 * @param {string} uomDirection - 'min' | 'max' | 'timeline' | 'zero'
 * @param {number} target       - The goal target value
 * @param {number} actual       - The actual achieved value
 * @returns {number|null}       - Score 0-100, or null for timeline goals
 */
function computeScore(uomDirection, target, actual) {
  if (target === null || target === undefined || actual === null || actual === undefined) {
    return null;
  }

  const t = Number(target);
  const a = Number(actual);

  switch (uomDirection) {
    case 'max':
      if (t === 0) return 0;
      return Math.min((a / t) * 100, 100);

    case 'min':
      if (a === 0) return 100; // achieved zero — perfect score
      if (t === 0) return 0;
      return Math.min((t / a) * 100, 100);

    case 'zero':
      return a === 0 ? 100 : 0;

    case 'timeline':
      // Timeline goals require date-based scoring (submitted before/after deadline).
      // This must be handled in the checkin controller with actual dates.
      return null;

    default:
      return 0;
  }
}

/**
 * Computes a timeline score based on submission date vs deadline.
 *
 * @param {Date|string} deadline     - The deadline date
 * @param {Date|string} submittedAt  - When the checkin was submitted
 * @returns {number} 100 if on time, 0 if late
 */
function computeTimelineScore(deadline, submittedAt) {
  const dl = new Date(deadline);
  const sub = new Date(submittedAt);
  return sub <= dl ? 100 : 0;
}

/**
 * Clamps a score to [0, 100].
 * @param {number} score
 * @returns {number}
 */
function clampScore(score) {
  return Math.max(0, Math.min(100, score));
}

module.exports = { computeScore, computeTimelineScore, clampScore };

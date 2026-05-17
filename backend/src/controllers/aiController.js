'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.GEMINI_API_KEY;
let genAI = null;
if (API_KEY && !API_KEY.includes('AIzaSy...')) {
  genAI = new GoogleGenerativeAI(API_KEY);
}

/**
 * Calls the Google Gemini API with a given prompt.
 * Returns parsed JSON if expectJson is true, otherwise returns the text.
 *
 * @param {string} systemPrompt
 * @param {string} userContent
 * @param {boolean} expectJson
 * @returns {Promise<object|string|null>}
 */
async function callGemini(systemPrompt, userContent, expectJson = true) {
  if (!genAI) {
    console.warn('[AIController] Valid GEMINI_API_KEY not set — returning null');
    return null;
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      generationConfig: expectJson ? { responseMimeType: 'application/json' } : {},
    });

    const result = await model.generateContent(userContent);
    const text = result.response.text().trim();

    if (!text) return null;

    if (expectJson) {
      try {
        return JSON.parse(text);
      } catch {
        console.error('[AIController] Failed to parse Gemini JSON response:', text);
        return null;
      }
    }

    return text;
  } catch (err) {
    console.error('[AIController] Unexpected error calling Gemini:', err.message);
    return null;
  }
}

// ============================================================
// POST /api/ai/parse-goal
// ============================================================
async function parseGoal(req, res, next) {
  try {
    const { input } = req.body;
    if (!input || input.trim().length === 0) {
      return res.status(400).json({ error: 'input is required' });
    }

    const system = `You are a goal parser for an enterprise OKR system. Extract structured goal data from natural language.`;
    const user = `The user typed: '${input}'. Extract and return ONLY valid JSON with these fields: {"thrust_area": "string", "title": "string", "description": "string", "uom_type": "one of: numeric/percent/timeline/zero", "uom_direction": "one of: min/max/timeline/zero", "target": "number", "weightage_suggestion": "number between 10-30", "confidence": "number between 0-1"}. No explanation, just JSON.`;

    const result = await callGemini(system, user, true);

    if (!result) {
      // Fallback: return empty structure
      return res.json({
        parsed: null,
        fallback: true,
        message: 'AI parsing unavailable — please fill in goal details manually',
      });
    }

    res.json({ parsed: result, fallback: false });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/ai/dna-score
// ============================================================
async function getDnaScore(req, res, next) {
  try {
    const { title, description, uom_type, uom_direction, target, thrust_area } = req.body;

    if (!title) {
      return res.status(400).json({ error: 'title is required' });
    }

    const system = `You are an OKR expert evaluating workplace goals for an enterprise performance management system. Score goals on 4 dimensions.`;
    const user = `Evaluate this goal:
Title: '${title}'
Description: '${description || ''}'
UoM Type: '${uom_type || ''}'
UoM Direction: '${uom_direction || ''}'
Target: '${target || ''}'
Thrust Area: '${thrust_area || ''}'

Return ONLY valid JSON: {"specificity": number 0-100, "ambition": number 0-100, "alignment": number 0-100, "risk": number 0-100 (lower=more risky), "total": number 0-100 (weighted average), "feedback": "one sentence suggestion"}. No explanation, just JSON.`;

    const result = await callGemini(system, user, true);

    if (!result) {
      return res.json({
        score: null,
        fallback: true,
        message: 'AI scoring unavailable — DNA score could not be computed',
      });
    }

    // Persist to goal if goal_id provided
    if (req.body.goal_id) {
      const { supabase } = require('../config/supabase');
      await supabase
        .from('goals')
        .update({ dna_score: result })
        .eq('id', req.body.goal_id);
    }

    res.json({ score: result, fallback: false });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/ai/predict
// ============================================================
async function predictOutcome(req, res, next) {
  try {
    const { target, uom_direction, q1, q2, q3, current_quarter } = req.body;

    if (target === undefined || !uom_direction) {
      return res.status(400).json({ error: 'target and uom_direction are required' });
    }

    const system = `You are a performance analyst predicting employee goal outcomes based on quarterly check-in trends.`;
    const user = `Predict this employee's Q4 outcome:
Target: ${target}
UoM Direction: ${uom_direction}
Q1 Score: ${q1 !== undefined ? q1 : 'null'}
Q2 Score: ${q2 !== undefined ? q2 : 'null'}
Q3 Score: ${q3 !== undefined ? q3 : 'null'}
Current Quarter: ${current_quarter || 'unknown'}

Return ONLY valid JSON: {"projected_q4": number 0-100, "risk_level": "low|medium|high", "recommendation": "one actionable sentence", "confidence": number 0-1}. No explanation, just JSON.`;

    const result = await callGemini(system, user, true);

    if (!result) {
      return res.json({
        prediction: null,
        fallback: true,
        message: 'AI prediction unavailable',
      });
    }

    res.json({ prediction: result, fallback: false });
  } catch (err) {
    next(err);
  }
}

// ============================================================
// POST /api/ai/draft-comment
// ============================================================
async function draftComment(req, res, next) {
  try {
    const { employee_name, goal_title, planned, actual, status, score, trend } = req.body;

    if (!employee_name || !goal_title) {
      return res.status(400).json({ error: 'employee_name and goal_title are required' });
    }

    const system = `You are an experienced HR manager helping write structured quarterly check-in comments for performance reviews. Write professionally and constructively.`;
    const user = `Write a quarterly check-in comment for:
Employee: ${employee_name}
Goal: ${goal_title}
Planned: ${planned !== undefined ? planned : 'N/A'}
Actual: ${actual !== undefined ? actual : 'N/A'}
Status: ${status || 'N/A'}
Score: ${score !== undefined ? score + '%' : 'N/A'}
Historical Trend: ${trend || 'No prior quarters available'}

Write a professional, constructive check-in comment in 3-4 sentences covering: observed progress, strengths, areas of concern or encouragement, and next steps. Return only the comment text, no JSON, no labels.`;

    const result = await callGemini(system, user, false);

    if (!result) {
      return res.json({
        comment: null,
        fallback: true,
        message: 'AI comment drafting unavailable',
      });
    }

    res.json({ comment: result, fallback: false });
  } catch (err) {
    next(err);
  }
}

module.exports = { parseGoal, getDnaScore, predictOutcome, draftComment };

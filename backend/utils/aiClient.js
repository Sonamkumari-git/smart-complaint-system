const axios = require('axios');

const AI_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const TIMEOUT = parseInt(process.env.AI_SERVICE_TIMEOUT || '15000', 10);

async function predict(text) {
  try {
    const t0 = Date.now();
    const res = await axios.post(
      `${AI_URL}/predict`,
      { text },
      { timeout: TIMEOUT }
    );
    const latency = Date.now() - t0;
    return { ...res.data, latency_ms: latency };
  } catch (err) {
    console.error('[AI] predict error:', err.message);
    // graceful fallback so the system still works if AI service is down
    return {
      category: 'Other',
      priority: 'Medium',
      department: 'HR / Administration',
      sentiment: 'Neutral',
      confidence: 0.0,
      fallback: true,
      error: err.message
    };
  }
}

async function checkDuplicate(text, existingTexts) {
  try {
    const res = await axios.post(
      `${AI_URL}/duplicate-check`,
      { text, candidates: existingTexts },
      { timeout: TIMEOUT }
    );
    return res.data;
  } catch (err) {
    console.error('[AI] duplicate-check error:', err.message);
    return { is_duplicate: false, best_score: 0, best_index: -1 };
  }
}

async function health() {
  try {
    const res = await axios.get(`${AI_URL}/health`, { timeout: 3000 });
    return res.data;
  } catch (err) {
    return { status: 'down', error: err.message };
  }
}

module.exports = { predict, checkDuplicate, health };

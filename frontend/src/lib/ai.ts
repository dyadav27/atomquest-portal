import api from './api';

export async function parseGoal(text: string) {
  try {
    const { data } = await api.post('/api/ai/parse-goal', { text });
    return data;
  } catch (err: any) {
    return { fallback: true, error: err.message };
  }
}

export async function getDnaScore(goalParams: any) {
  try {
    const { data } = await api.post('/api/ai/dna-score', goalParams);
    return data;
  } catch (err: any) {
    return { fallback: true, error: err.message };
  }
}

export async function draftComment(checkinParams: any) {
  try {
    const { data } = await api.post('/api/ai/draft-comment', checkinParams);
    return data;
  } catch (err: any) {
    return { fallback: true, error: err.message };
  }
}

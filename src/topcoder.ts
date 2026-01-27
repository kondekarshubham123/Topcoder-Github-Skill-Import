import axios from 'axios';

const BASE = 'https://api.topcoder-dev.com/v5/standardized-skills';

export interface TopcoderSkill {
  id: string;
  name: string;
  description?: string;
}

// List all skills
export async function fetchAllSkills(): Promise<TopcoderSkill[]> {
  const resp = await axios.get(`${BASE}/skills`);
  return resp.data;
}

// Autocomplete skills by name
export async function autocompleteSkills(query: string): Promise<TopcoderSkill[]> {
  const resp = await axios.get(`${BASE}/skills/autocomplete`, { params: { query } });
  return resp.data;
}

// Fuzzy match skills by name
export async function fuzzyMatchSkills(term: string, size: number = 10): Promise<TopcoderSkill[]> {
  const resp = await axios.get(`${BASE}/skills/fuzzymatch`, { params: { term, size } });
  return resp.data;
}

// Semantic search for skills by text
export async function semanticSearchSkills(text: string): Promise<any> {
  const resp = await axios.post(`${BASE}/skills/semantic-search`, { text });
  return resp.data;
}

// Get skill by ID
export async function getSkillById(skillId: string): Promise<TopcoderSkill> {
  const resp = await axios.get(`${BASE}/skills/${skillId}`);
  return resp.data;
}

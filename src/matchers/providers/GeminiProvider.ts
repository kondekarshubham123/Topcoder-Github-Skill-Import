import axios from 'axios';
import { ISemanticProvider } from './OpenAIProvider';

export class GeminiProvider implements ISemanticProvider {
  name = 'Google Gemini';
  supportsLLM = true;
  private apiKey: string;
  private cache: Map<string, number[]> = new Map();
  private llmCache: Map<string, any> = new Map();
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  // LLM-based skill matching using Gemini Pro
  async matchSkillsWithLLM(profileText: string, skills: Array<{ id: string; name: string; description?: string }>): Promise<Array<{ skillId: string; confidence: number; reasoning: string }>> {
    const cacheKey = `${profileText.substring(0, 100)}_${skills.length}`;
    if (this.llmCache.has(cacheKey)) {
      return this.llmCache.get(cacheKey);
    }
    
    const skillsList = skills.map(s => `- ${s.name}: ${s.description || 'N/A'}`).join('\n');
    
    const prompt = `You are a technical skill assessor. Analyze the developer profile and match relevant skills.

Developer Profile:
${profileText}

Available Skills:
${skillsList}

For each relevant skill, provide:
1. Skill name (exact match from list)
2. Confidence score (0-100)
3. Brief reasoning

Return ONLY valid JSON array format:
[{"skillName": "JavaScript", "confidence": 95, "reasoning": "Extensive JS repos and contributions"}]

Focus on skills with strong evidence. Minimum confidence: 40. Maximum: 15 skills.`;

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      const content = response.data.candidates[0].content.parts[0].text.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const matches = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      
      const results = matches
        .map((m: any) => {
          const skill = skills.find(s => s.name.toLowerCase() === m.skillName.toLowerCase());
          return skill ? {
            skillId: skill.id,
            confidence: Math.min(Math.max(m.confidence, 0), 100),
            reasoning: m.reasoning || 'Gemini LLM analysis'
          } : null;
        })
        .filter((r: any) => r !== null);
      
      this.llmCache.set(cacheKey, results);
      return results;
    } catch (error: any) {
      console.error('Gemini LLM matching error:', error.message);
      return [];
    }
  }
  
  // Embedding-based similarity using Gemini Embeddings
  private async getEmbedding(text: string): Promise<number[]> {
    if (this.cache.has(text)) {
      return this.cache.get(text)!;
    }
    
    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/embedding-001:embedContent?key=${this.apiKey}`,
        {
          content: {
            parts: [{
              text: text
            }]
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );
      
      const embedding = response.data.embedding.values;
      this.cache.set(text, embedding);
      return embedding;
    } catch (error: any) {
      console.error('Gemini embedding error:', error.message);
      // Fallback to LLM-based matching if embeddings fail
      throw error;
    }
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (normA * normB);
  }
  
  async computeSimilarity(text1: string, text2: string): Promise<number> {
    try {
      const [emb1, emb2] = await Promise.all([
        this.getEmbedding(text1),
        this.getEmbedding(text2)
      ]);
      return this.cosineSimilarity(emb1, emb2);
    } catch (error) {
      // If embeddings fail, return moderate similarity to allow LLM matching
      return 0.5;
    }
  }
}

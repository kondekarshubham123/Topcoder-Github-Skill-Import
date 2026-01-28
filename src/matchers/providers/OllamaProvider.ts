import axios from 'axios';
import { ISemanticProvider } from './OpenAIProvider';

export class OllamaProvider implements ISemanticProvider {
  name = 'Ollama';
  supportsLLM = true;
  private baseUrl: string;
  private model: string;
  private timeout: number;
  private cache: Map<string, number[]> = new Map();
  private llmCache: Map<string, any> = new Map();
  
  constructor(baseUrl: string = 'http://localhost:11434', model: string = 'llama3.2', timeout: number = 180000) {
    this.baseUrl = baseUrl;
    this.timeout = timeout; // 3 minutes default for local llm processing
    this.model = model;
  }
  
  // LLM-based skill matching using Ollama
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

Focus on skills with strong evidence. Minimum confidence: 40. Maximum: 15 skills.

IMPORTANT: Return ONLY the JSON array, no other text.`;

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/generate`,
        {
          model: this.model,
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 1000, // Reduced for faster processing
            top_p: 0.6
          }
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: this.timeout,
          onDownloadProgress: () => { 
            /* no-op to prevent timeout */ 
          }
        }
      );
      
      const content = response.data.response.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const matches = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
      
      const results = matches
        .map((m: any) => {
          const skill = skills.find(s => s.name.toLowerCase() === m.skillName.toLowerCase());
          return skill ? {
            skillId: skill.id,
            confidence: Math.min(Math.max(m.confidence, 0), 100),
            reasoning: m.reasoning || 'Ollama LLM analysis'
          } : null;
        })
        .filter((r: any) => r !== null);
      
      this.llmCache.set(cacheKey, results);
      return results;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        console.error('Ollama connection error: Is Ollama running? Start with: ollama serve');
      } else if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) { 
        console.error(`Timeout after ${this.timeout / 1000}s. Try`);
        console.error('  - Increasing timeout with --ollama-timeout');
        console.error('  - Using a smaller/faster model: --ollama-model lamma3.2:1b');
        console.error('  - Use fewer repos: --max-repos 10');
      } else {
        console.error('Ollama LLM matching error:', error.message);
      }
      return [];
    }
  }
  
  // Embedding-based similarity using Ollama embeddings
  private async getEmbedding(text: string): Promise<number[]> {
    if (this.cache.has(text)) {
      return this.cache.get(text)!;
    }
    
    try {
      const response = await axios.post(
        `${this.baseUrl}/api/embeddings`,
        {
          model: this.model,
          prompt: text
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );
      
      const embedding = response.data.embedding;
      this.cache.set(text, embedding);
      return embedding;
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Ollama not running. Start with: ollama serve');
      }
      console.error('Ollama embedding error:', error.message);
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
      // If embeddings fail, return moderate similarity
      return 0.5;
    }
  }
  
  // Helper method to check if Ollama is available
  async isAvailable(): Promise<boolean> {
    try {
      await axios.get(`${this.baseUrl}/api/tags`, { timeout: 2000 });
      return true;
    } catch {
      return false;
    }
  }
  
  // Helper method to list available models
  async listModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      return response.data.models.map((m: any) => m.name);
    } catch {
      return [];
    }
  }
}

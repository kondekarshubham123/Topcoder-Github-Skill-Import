import axios from 'axios';

// Moved interface here since it's no longer exported from SemanticMatcher
export interface ISemanticProvider {
  name: string;
  computeSimilarity(text1: string, text2: string): Promise<number>;
}

export class OpenAIProvider implements ISemanticProvider {
  name = 'OpenAI';
  private apiKey: string;
  private cache: Map<string, number[]> = new Map();
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }
  
  private async getEmbedding(text: string): Promise<number[]> {
    if (this.cache.has(text)) {
      return this.cache.get(text)!;
    }
    
    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        model: 'text-embedding-3-small',
        input: text
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const embedding = response.data.data[0].embedding;
    this.cache.set(text, embedding);
    return embedding;
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
    const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
    const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
    return dot / (normA * normB);
  }
  
  async computeSimilarity(text1: string, text2: string): Promise<number> {
    const [emb1, emb2] = await Promise.all([
      this.getEmbedding(text1),
      this.getEmbedding(text2)
    ]);
    return this.cosineSimilarity(emb1, emb2);
  }
}


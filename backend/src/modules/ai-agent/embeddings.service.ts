import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger('EmbeddingsService');
  private readonly openrouterApiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.openrouterApiKey = this.config.get<string>('OPENROUTER_API_KEY') || '';
  }

  /**
   * Generate an embedding vector for a given text using OpenRouter
   * Falls back to a simple keyword-based approach if the API call fails
   */
  async embed(text: string): Promise<number[] | null> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openrouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://syncropos.com',
          'X-Title': 'Syncro POS AI Agent',
        },
        body: JSON.stringify({
          model: 'openai/text-embedding-3-small',
          input: text,
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Embedding API failed: ${response.status} — using keyword fallback`);
        return null;
      }

      const data = await response.json();
      return data?.data?.[0]?.embedding ?? null;
    } catch (err) {
      this.logger.warn(`Embedding error: ${err.message} — using keyword fallback`);
      return null;
    }
  }

  /**
   * Cosine similarity between two vectors
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
  }

  /**
   * Find the top-K most relevant knowledge chunks for a query
   * Uses vector cosine similarity if embeddings are available,
   * falls back to keyword matching otherwise.
   */
  async searchRelevantChunks(query: string, topK = 3): Promise<{ content: string; topic: string }[]> {
    const allChunks = await this.prisma.knowledgeChunk.findMany();

    if (allChunks.length === 0) return [];

    // Try vector search first
    const queryEmbedding = await this.embed(query);

    if (queryEmbedding) {
      // Score each chunk by cosine similarity
      const scored = allChunks
        .filter(c => c.embedding)
        .map(chunk => {
          try {
            const chunkVec = JSON.parse(chunk.embedding!) as number[];
            return { chunk, score: this.cosineSimilarity(queryEmbedding, chunkVec) };
          } catch {
            return { chunk, score: 0 };
          }
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      if (scored.length > 0) {
        return scored.map(s => ({ content: s.chunk.content, topic: s.chunk.topic }));
      }
    }

    // Keyword fallback: score by how many query words appear in the chunk
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scored = allChunks.map(chunk => {
      const text = chunk.content.toLowerCase();
      const score = queryWords.reduce((acc, word) => acc + (text.includes(word) ? 1 : 0), 0);
      return { chunk, score };
    });

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map(s => ({ content: s.chunk.content, topic: s.chunk.topic }));
  }
}

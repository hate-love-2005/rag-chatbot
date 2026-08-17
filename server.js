import express from 'express';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { PineconeClient } from '@pinecone-database/pinecone';

dotenv.config();

const app = express();
app.use(express.json({ limit: '1mb' }));

// Validate env
const { OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_ENVIRONMENT, PINECONE_INDEX_NAME, PORT } = process.env;
if (!OPENAI_API_KEY || !PINECONE_API_KEY || !PINECONE_ENVIRONMENT || !PINECONE_INDEX_NAME) {
  console.error('Missing required env vars. See .env.example');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const pinecone = new PineconeClient();
await pinecone.init({ apiKey: PINECONE_API_KEY, environment: PINECONE_ENVIRONMENT });
const index = pinecone.Index(PINECONE_INDEX_NAME);

// Helper: embed text
async function embedText(text) {
  const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
  return resp.data[0].embedding;
}

// POST /api/ask { query: string, topK?: number }
app.post('/api/ask', async (req, res) => {
  try {
    const { query, topK = 4 } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });

    // 1) Create embedding for the query
    const qEmbedding = await embedText(query);

    // 2) Query Pinecone
    const queryRequest = {
      vector: qEmbedding,
      topK: topK,
      includeMetadata: true,
      includeValues: false
    };
    const queryResponse = await index.query({ queryRequest });

    const matches = queryResponse.matches || [];

    // 3) Build context from matches
    const contextTexts = matches.map((m, i) => `SOURCE ${m.id} (score=${m.score.toFixed(3)}): ${m.metadata?.text ?? m.metadata?.content ?? ''}`);
    const context = contextTexts.join('\n\n');

    // 4) Call OpenAI Chat Completion with context
    const systemPrompt = `You are an assistant that answers user questions using the provided context. If the answer is not contained in the context, say you don't know and suggest how to find it.`;
    const userPrompt = `Context:\n${context}\n\nUser question: ${query}\n\nAnswer concisely, cite the relevant sources by SOURCE id if used.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 512,
      temperature: 0.2
    });

    const answer = completion.choices?.[0]?.message?.content ?? '';

    return res.json({ answer, sources: matches.map(m => ({ id: m.id, score: m.score, metadata: m.metadata })) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: String(err) });
  }
});

const port = PORT || 3000;
app.listen(port, () => console.log(`RAG chatbot server listening on port ${port}`));

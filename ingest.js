import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { PineconeClient } from '@pinecone-database/pinecone';

dotenv.config();

const DATA_DIR = path.resolve(process.cwd(), 'data'); // put source .txt/.md files here
const CHUNK_SIZE = 1000; // characters
const CHUNK_OVERLAP = 200;

const { OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_ENVIRONMENT, PINECONE_INDEX_NAME } = process.env;
if (!OPENAI_API_KEY || !PINECONE_API_KEY || !PINECONE_ENVIRONMENT || !PINECONE_INDEX_NAME) {
  console.error('Missing required env vars. See .env.example');
  process.exit(1);
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const pinecone = new PineconeClient();
await pinecone.init({ apiKey: PINECONE_API_KEY, environment: PINECONE_ENVIRONMENT });
const index = pinecone.Index(PINECONE_INDEX_NAME);

function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

async function embedText(text) {
  const resp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: text });
  return resp.data[0].embedding;
}

async function ingestFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const chunks = chunkText(content);
  const vectors = [];
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await embedText(chunk);
    const id = `${path.basename(filePath)}_${i}`;
    vectors.push({ id, values: embedding, metadata: { source: path.basename(filePath), chunk_index: i, text: chunk.slice(0, 1000) } });

    // Batch upserts every 100 vectors
    if (vectors.length >= 100) {
      await upsertVectors(vectors.splice(0));
    }
  }
  if (vectors.length > 0) {
    await upsertVectors(vectors);
  }
}

async function upsertVectors(vectors) {
  const upsertRequest = { vectors };
  await index.upsert({ upsertRequest });
  console.log(`Upserted ${vectors.length} vectors`);
}

async function main() {
  if (!fs.existsSync(DATA_DIR)) {
    console.error(`Data directory not found at ${DATA_DIR}. Create a 'data' directory and add .txt or .md files to ingest.`);
    process.exit(1);
  }
  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
  if (files.length === 0) {
    console.error('No .txt or .md files found in data/');
    process.exit(1);
  }

  for (const file of files) {
    console.log('Ingesting', file);
    await ingestFile(path.join(DATA_DIR, file));
  }
  console.log('Ingestion complete');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

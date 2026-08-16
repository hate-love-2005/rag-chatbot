RAG Chatbot (Node.js) — OpenAI embeddings + Pinecone

Overview
- Node.js example implementing Retrieval-Augmented Generation (RAG)
- Uses OpenAI embeddings (text-embedding-3-small) to vectorize text
- Uses Pinecone as the vector store for retrieval

Architecture diagram: [architecture.svg]

Contents
- package.json — project manifest
- server.js — Express-based API: POST /api/ask { query, topK }
- ingest.js — ingestion script: reads text/markdown files from data/ and uploads chunked embeddings to Pinecone
- .env.example — environment variable template
- Dockerfile — simple container image

Quickstart
1) Clone repository and install dependencies
   npm install

2) Copy .env.example to .env and set values:
   OPENAI_API_KEY, PINECONE_API_KEY, PINECONE_ENVIRONMENT, PINECONE_INDEX_NAME

3) Create a data/ directory in the project root and add .txt or .md files to ingest

4) Run ingestion (this will compute embeddings and upsert into Pinecone index):
   node ingest.js

5) Start server
   node server.js

6) Example request
   POST http://localhost:3000/api/ask
   Body: { "query": "How do I reset my password?", "topK": 4 }

Security & Costs
- Keep API keys out of source control (.env is in .gitignore). Use a secrets manager for production.
- Embedding and LLM calls cost money. Monitor usage and use caching where possible.




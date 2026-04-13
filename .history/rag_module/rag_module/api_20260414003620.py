"""
FastAPI interface for RAG module.

Endpoint:
POST /chat

Input:
{
  "query": "string"
}

Flow:
- Retrieve relevant context
- Generate answer

Output:
{
  "answer": "...",
  "sources": ["..."]
}

Constraints:
- Load models once at startup
- Fast response (<3 seconds)
- Handle errors properly
"""
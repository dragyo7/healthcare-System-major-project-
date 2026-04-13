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

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from retriever import retrieve
from generator import generate_answer

app = FastAPI(title="Healthcare RAG API")

class QueryRequest(BaseModel):
    query: str
    
    
@app.post("/chat")
def chat(request: QueryRequest):
    try:
        query = request.query.strip()

        if not query:
            raise HTTPException(status_code=400, detail="Query cannot be empty")

        # 🔍 Retrieve context
        context, sources = retrieve(query)

        # 🧠 Generate answer
        answer = generate_answer(query, context)

        return {
            "answer": answer,
            "sources": sources
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
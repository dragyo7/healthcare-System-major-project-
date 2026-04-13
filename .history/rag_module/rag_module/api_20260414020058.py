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
    
    
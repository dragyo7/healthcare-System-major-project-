"""
Healthcare RAG Module - API

Task:
- FastAPI endpoint POST /chat

Flow:
query → retrieve → generate

Return:
answer + sources
"""
from fastapi import FastAPI

app = FastAPI()     

# PowerShell RAG Forensic Execution Trace CLI
param (
    [string]$Query = "What does the official labeling say about metformin in patients with severe renal impairment?",
    [int]$TopK = 3
)

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "HEALTHCARE RAG FORENSIC TRACE CLI (POWERSHELL)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

python (Join-Path $PSScriptRoot "trace_rag.py") --query $Query --top_k $TopK

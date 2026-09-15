# PowerShell Smoke Test for Healthcare RAG Backend
Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "HEALTHCARE RAG SYSTEM END-TO-END SMOKE TEST (POWERSHELL)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

python (Join-Path $PSScriptRoot "smoke_test_rag.py")

# =====================================================================
# stop_demo.ps1 — Safely stop CDS Platform Demo Processes
# =====================================================================
$ErrorActionPreference = "SilentlyContinue"

$repoRoot = $PSScriptRoot
if (-not $repoRoot) {
    $repoRoot = (Get-Location).Path
}

$runtimeDir = Join-Path $repoRoot ".runtime"
$pidsFile = Join-Path $runtimeDir "pids.json"

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "   Stopping Healthcare CDS Platform Processes...                          " -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Terminate tracked PIDs from .runtime/pids.json
if (Test-Path $pidsFile) {
    try {
        $pidsData = Get-Content $pidsFile -Raw | ConvertFrom-Json
        foreach ($prop in $pidsData.PSObject.Properties) {
            $serviceName = $prop.Name
            $pidToStop = $prop.Value
            if ($pidToStop) {
                $proc = Get-Process -Id $pidToStop -ErrorAction SilentlyContinue
                if ($proc) {
                    Write-Host "  Stopping tracked $serviceName (PID $pidToStop)..." -ForegroundColor Yellow
                    Stop-Process -Id $pidToStop -Force -ErrorAction SilentlyContinue
                }
            }
        }
        Remove-Item -Path $pidsFile -Force -ErrorAction SilentlyContinue
    } catch {
        Write-Host "  Error reading $pidsFile: $_" -ForegroundColor Gray
    }
}

# 2. Targeted fallback for lingering Vite or uvicorn dev processes matching this repository
$projectProcesses = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
    ($_.CommandLine -like "*Portal Major P*" -or $_.CommandLine -like "*rag_module.api:app*") -and
    ($_.Name -match "node|python")
}

foreach ($p in $projectProcesses) {
    Write-Host "  Stopping lingering project process $($p.Name) (PID $($p.ProcessId))..." -ForegroundColor Yellow
    Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 1
Write-Host ""
Write-Host "All CDS Platform demo services stopped cleanly." -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host ""

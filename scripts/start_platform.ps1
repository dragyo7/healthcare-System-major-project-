<#
.SYNOPSIS
  start_platform.ps1 - Production Orchestrator for the Clinical Decision Support System (CDSS)
  Launches and health-checks all backend and frontend services, reporting the unified application URL.
#>

$ErrorActionPreference = "Continue"

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "       MODULAR AI CLINICAL DECISION SUPPORT SYSTEM (CDSS) LAUNCHER        " -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan

$RepoRoot = Split-Path -Parent $PSScriptRoot
$MysqlPort = 3306
$FastApiPort = 8000
$ExpressPort = 5000
$FrontendPort = 5173

function Test-PortOpen ($Port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect("127.0.0.1", $Port, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne(800)
        if ($wait) {
            $tcp.EndConnect($iar)
            $tcp.Close()
            return $true
        }
        $tcp.Close()
        return $false
    } catch {
        return $false
    }
}

# 1. Check / Launch MySQL Server (Port 3306)
Write-Host "`n[1/4] Verifying MySQL EHR Database (Port $MysqlPort)..." -ForegroundColor Yellow
if (Test-PortOpen $MysqlPort) {
    Write-Host "  -> MySQL Database is already active on port $MysqlPort." -ForegroundColor Green
} else {
    Write-Host "  -> Launching local MySQL Server instance..." -ForegroundColor Gray
    $mysqldPath = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe"
    $dataDir = Join-Path $RepoRoot "scratch\mysql_data"
    if (Test-Path $mysqldPath) {
        Start-Process -FilePath $mysqldPath -ArgumentList "--datadir=`"$dataDir`"", "--port=$MysqlPort", "--console" -WindowStyle Minimized
        Start-Sleep -Seconds 3
        if (Test-PortOpen $MysqlPort) {
            Write-Host "  -> MySQL successfully started on port $MysqlPort." -ForegroundColor Green
        } else {
            Write-Host "  [WARN] MySQL did not respond immediately on port $MysqlPort. Ensure MySQL service is running." -ForegroundColor Red
        }
    } else {
        Write-Host "  [WARN] mysqld.exe not found at standard path. Ensure MySQL 8.0 is running on port 3306." -ForegroundColor Yellow
    }
}

# 2. Check / Launch FastAPI CDS Gateway & Frozen RAG V2.10 (Port 8000)
Write-Host "`n[2/4] Verifying FastAPI CDS Gateway & Frozen RAG Engine (Port $FastApiPort)..." -ForegroundColor Yellow
if (Test-PortOpen $FastApiPort) {
    Write-Host "  -> FastAPI CDS Gateway is already active on port $FastApiPort." -ForegroundColor Green
} else {
    Write-Host "  -> Launching FastAPI CDS Gateway (rag_module.api:app)..." -ForegroundColor Gray
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd `"$RepoRoot`"; python -m uvicorn rag_module.api:app --host 127.0.0.1 --port $FastApiPort" -WindowStyle Minimized
    $ready = $false
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        if (Test-PortOpen $FastApiPort) { $ready = $true; break }
    }
    if ($ready) {
        Write-Host "  -> FastAPI CDS Gateway online on port $FastApiPort." -ForegroundColor Green
    } else {
        Write-Host "  [WARN] FastAPI Gateway took longer than expected. Check Python environment." -ForegroundColor Yellow
    }
}

# 3. Check / Launch Express EHR Backend with OCR (Port 5000)
Write-Host "`n[3/4] Verifying Express EHR Clinical Backend (Port $ExpressPort)..." -ForegroundColor Yellow
if (Test-PortOpen $ExpressPort) {
    Write-Host "  -> Express EHR Backend is already active on port $ExpressPort." -ForegroundColor Green
} else {
    $backendDir = Join-Path $RepoRoot "Portal Major P\Bhumi\Doctor portal\backend"
    Write-Host "  -> Launching Express EHR Backend..." -ForegroundColor Gray
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd `"$backendDir`"; node server.js" -WindowStyle Minimized
    $ready = $false
    for ($i = 0; $i -lt 10; $i++) {
        Start-Sleep -Seconds 1
        if (Test-PortOpen $ExpressPort) { $ready = $true; break }
    }
    if ($ready) {
        Write-Host "  -> Express EHR Backend online on port $ExpressPort." -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Express Backend took longer than expected to initialize." -ForegroundColor Yellow
    }
}

# 4. Check / Launch Unified Frontend (Port 5173)
Write-Host "`n[4/4] Verifying Unified CDSS Frontend (Port $FrontendPort)..." -ForegroundColor Yellow
if (Test-PortOpen $FrontendPort) {
    Write-Host "  -> Unified CDSS Frontend is already active on port $FrontendPort." -ForegroundColor Green
} else {
    $frontendDir = Join-Path $RepoRoot "frontend"
    Write-Host "  -> Launching Vite Dev Server for Unified Frontend..." -ForegroundColor Gray
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd `"$frontendDir`"; npm run dev" -WindowStyle Minimized
    $ready = $false
    for ($i = 0; $i -lt 10; $i++) {
        Start-Sleep -Seconds 1
        if (Test-PortOpen $FrontendPort) { $ready = $true; break }
    }
    if ($ready) {
        Write-Host "  -> Unified Frontend online on port $FrontendPort." -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Frontend server took longer than expected." -ForegroundColor Yellow
    }
}

Write-Host "`n==========================================================================" -ForegroundColor Cyan
Write-Host "                  CDSS PLATFORM OPERATIONAL SUMMARY                       " -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "  PRIMARY APPLICATION URL : http://localhost:$FrontendPort" -ForegroundColor Green
Write-Host "  EXPRESS EHR API GATEWAY : http://localhost:$ExpressPort/api" -ForegroundColor White
Write-Host "  FASTAPI CDS INTERACTIVE : http://127.0.0.1:$FastApiPort/docs" -ForegroundColor White
Write-Host "  MYSQL EHR DATABASE      : localhost:$MysqlPort (cdss_db)" -ForegroundColor White
Write-Host "--------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "  SYNTHETIC DEMO CREDENTIALS:" -ForegroundColor Cyan
Write-Host "  1. CLINICIAN (Doctor)   : doctor@gmail.com       | password: doctor123" -ForegroundColor White
Write-Host "  2. FRONT DESK (Admin)   : receptionist@gmail.com | password: receptionist123" -ForegroundColor White
Write-Host "  3. PATIENT (Care)       : aarav@gmail.com        | password: patient123" -ForegroundColor White
Write-Host "  4. ACCOUNT ACTIVATION   : http://localhost:$FrontendPort/activate" -ForegroundColor White
Write-Host "==========================================================================`n" -ForegroundColor Cyan

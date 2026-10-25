<#
.SYNOPSIS
  start_platform.ps1 - Orchestrator for the Clinical Decision Support System (CDSS)
  Launches and verifies actual dependency readiness for all services in either Demo or Production mode.

.PARAMETER Mode
  "Demo" (default): Runs against isolated test database 'rag_healthcare_test' on port 5001.
  "Production": Runs against primary database 'rag_healthcare' on port 5000.
#>

param(
    [ValidateSet("Demo", "Production")]
    [string]$Mode = "Demo"
)

$ErrorActionPreference = "Continue"

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "       MODULAR AI CLINICAL DECISION SUPPORT SYSTEM (CDSS) LAUNCHER        " -ForegroundColor Cyan
Write-Host "       Mode: $Mode | Primary DB is protected and untouched in Demo mode   " -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan

$RepoRoot = Split-Path -Parent $PSScriptRoot
$MysqlPort = 3306
$FastApiPort = 8000
$FrontendPort = 5173

if ($Mode -eq "Demo") {
    $ExpressPort = 5001
    $TargetDb = "rag_healthcare_test"
} else {
    $ExpressPort = 5000
    $TargetDb = "rag_healthcare"
}

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

function Test-HttpEndpoint ($Url) {
    try {
        $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 3 -ErrorAction Stop
        return $response
    } catch {
        return $null
    }
}

# 1. Check / Launch MySQL Server (Port 3306)
Write-Host "`n[1/4] Verifying MySQL EHR Database (Port $MysqlPort)..." -ForegroundColor Yellow
if (Test-PortOpen $MysqlPort) {
    Write-Host "  -> MySQL Database is active on port $MysqlPort." -ForegroundColor Green
} else {
    Write-Host "  -> Attempting dynamic discovery of local MySQL Server..." -ForegroundColor Gray

    # Check if a Windows MySQL Service exists and can be started
    $svc = Get-Service -Name "MySQL*", "MySQL80" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($svc -and $svc.Status -ne "Running") {
        Write-Host "  -> Starting Windows service $($svc.Name)..." -ForegroundColor Gray
        Start-Service -Name $svc.Name -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3
    }

    if (-not (Test-PortOpen $MysqlPort)) {
        $dataDir = Join-Path $RepoRoot "scratch\mysql_data"
        $mysqldCandidates = @(
            (Get-Command mysqld -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue),
            "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe",
            "C:\Program Files\MySQL\MySQL Server 8.1\bin\mysqld.exe",
            "C:\Program Files\MySQL\MySQL Server 8.4\bin\mysqld.exe",
            "C:\xampp\mysql\bin\mysqld.exe"
        ) | Where-Object { $_ -and (Test-Path $_) }

        $mysqldPath = $mysqldCandidates | Select-Object -First 1
        if ($mysqldPath) {
            Write-Host "  -> Launching discovered mysqld binary: $mysqldPath" -ForegroundColor Gray
            Start-Process -FilePath $mysqldPath -ArgumentList "--datadir=`"$dataDir`"", "--port=$MysqlPort", "--console" -WindowStyle Minimized
            Start-Sleep -Seconds 3
        }
    }

    if (Test-PortOpen $MysqlPort) {
        Write-Host "  -> MySQL successfully active on port $MysqlPort." -ForegroundColor Green
    } else {
        Write-Host "  [WARN] MySQL did not respond on port $MysqlPort. Ensure MySQL 8.0 is running on port 3306." -ForegroundColor Yellow
    }
}

# 2. Check / Launch FastAPI CDS Gateway & Frozen RAG V2.10 (Port 8000)
Write-Host "`n[2/4] Verifying FastAPI CDS Gateway & Frozen RAG Engine (Port $FastApiPort)..." -ForegroundColor Yellow
$fastApiHealth = Test-HttpEndpoint "http://127.0.0.1:$FastApiPort/health"
if ($fastApiHealth -and $fastApiHealth.status -eq "healthy") {
    Write-Host "  -> FastAPI CDS Gateway is verified healthy on port $FastApiPort (Index ready: $($fastApiHealth.index_ready))." -ForegroundColor Green
} else {
    Write-Host "  -> Launching FastAPI CDS Gateway (rag_module.api:app)..." -ForegroundColor Gray
    Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd `"$RepoRoot`"; python -m uvicorn rag_module.api:app --host 127.0.0.1 --port $FastApiPort" -WindowStyle Minimized
    $ready = $false
    for ($i = 0; $i -lt 15; $i++) {
        Start-Sleep -Seconds 1
        $h = Test-HttpEndpoint "http://127.0.0.1:$FastApiPort/health"
        if ($h -and $h.status -eq "healthy") { $ready = $true; break }
    }
    if ($ready) {
        Write-Host "  -> FastAPI CDS Gateway online and verified healthy on port $FastApiPort." -ForegroundColor Green
    } else {
        Write-Host "  [WARN] FastAPI Gateway took longer than expected. Check Python environment." -ForegroundColor Yellow
    }
}

# 3. Check / Launch Express EHR Backend (Port 5001 in Demo, Port 5000 in Production)
Write-Host "`n[3/4] Verifying Express EHR Clinical Backend (Port $ExpressPort, Database: $TargetDb)..." -ForegroundColor Yellow
$expressHealth = Test-HttpEndpoint "http://127.0.0.1:$ExpressPort/api/health"
if ($expressHealth -and $expressHealth.status -eq "healthy") {
    Write-Host "  -> Express EHR Backend is verified healthy on port $ExpressPort (DB: $($expressHealth.services.database_name))." -ForegroundColor Green
} else {
    if ($Mode -eq "Demo") {
        Write-Host "  -> Launching isolated test Express EHR Backend on port $ExpressPort..." -ForegroundColor Gray
        Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd `"$RepoRoot`"; node scripts/start_test_backend.js" -WindowStyle Minimized
    } else {
        $backendDir = Join-Path $RepoRoot "Portal Major P\Bhumi\Doctor portal\backend"
        Write-Host "  -> Launching production Express EHR Backend on port $ExpressPort..." -ForegroundColor Gray
        Start-Process -FilePath "powershell.exe" -ArgumentList "-NoExit", "-Command", "cd `"$backendDir`"; node server.js" -WindowStyle Minimized
    }
    $ready = $false
    for ($i = 0; $i -lt 12; $i++) {
        Start-Sleep -Seconds 1
        $h = Test-HttpEndpoint "http://127.0.0.1:$ExpressPort/api/health"
        if ($h -and $h.status -eq "healthy") { $ready = $true; break }
    }
    if ($ready) {
        Write-Host "  -> Express EHR Backend online and verified healthy on port $ExpressPort." -ForegroundColor Green
    } else {
        Write-Host "  [WARN] Express Backend took longer than expected to initialize. Check database connectivity." -ForegroundColor Yellow
    }
}

# 4. Check / Launch Unified Frontend (Port 5173)
Write-Host "`n[4/4] Verifying Unified CDSS Frontend (Port $FrontendPort)..." -ForegroundColor Yellow
if (Test-PortOpen $FrontendPort) {
    Write-Host "  -> Unified CDSS Frontend is active on port $FrontendPort." -ForegroundColor Green
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
Write-Host "  OPERATING MODE          : $Mode" -ForegroundColor Green
Write-Host "  PRIMARY APPLICATION URL : http://localhost:$FrontendPort" -ForegroundColor Green
Write-Host "  EXPRESS EHR API GATEWAY : http://127.0.0.1:$ExpressPort/api" -ForegroundColor White
Write-Host "  FASTAPI CDS INTERACTIVE : http://127.0.0.1:$FastApiPort/docs" -ForegroundColor White
Write-Host "  MYSQL EHR DATABASE      : localhost:$MysqlPort ($TargetDb)" -ForegroundColor White
Write-Host "--------------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "  VERIFIED DEMO CREDENTIALS (Demo Mode):" -ForegroundColor Cyan
Write-Host "  1. CLINICIAN (Doctor)   : doctor@gmail.com       | password: Doctor@123" -ForegroundColor White
Write-Host "  2. FRONT DESK (Admin)   : receptionist@gmail.com | password: Reception@123" -ForegroundColor White
Write-Host "  3. PATIENT (Care)       : aarav@gmail.com        | password: Patient@123" -ForegroundColor White
Write-Host "==========================================================================`n" -ForegroundColor Cyan

# =====================================================================
# start_demo.ps1 — One-Command Startup for Full Healthcare CDS Platform
# =====================================================================
$ErrorActionPreference = "Stop"

$repoRoot = $PSScriptRoot
if (-not $repoRoot) {
    $repoRoot = (Get-Location).Path
}

$runtimeDir = Join-Path $repoRoot ".runtime"
$logsDir = Join-Path $runtimeDir "logs"
$pidsFile = Join-Path $runtimeDir "pids.json"

if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir -Force | Out-Null
}

Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "   Clinical Decision Support (CDS) System — Unified Platform Launcher     " -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host ""

# ---------------------------------------------------------------------
# Phase 1: Prerequisites Validation
# ---------------------------------------------------------------------
Write-Host "[1/6] Validating Prerequisites..." -ForegroundColor Yellow

# Node.js & npm
$nodeCmd = (Get-Command node -ErrorAction SilentlyContinue).Source
$npmCmd = (Get-Command npm.cmd -ErrorAction SilentlyContinue).Source
if (-not $npmCmd) { $npmCmd = (Get-Command npm -ErrorAction SilentlyContinue).Source }

if (-not $nodeCmd -or -not $npmCmd) {
    Write-Error "Node.js or npm not found in system PATH. Please install Node.js."
    exit 1
}
$nodeVersion = & node -v
Write-Host "      ✓ Node.js: $nodeVersion" -ForegroundColor Gray

# Python executable (.venv or system)
$pythonExe = Join-Path $repoRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $pythonExe)) {
    $pythonExe = (Get-Command python -ErrorAction SilentlyContinue).Source
    if (-not $pythonExe) {
        Write-Error "Python executable not found in .venv or system PATH."
        exit 1
    }
}
$pyVersion = & $pythonExe -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}')"
Write-Host "      ✓ Python: $pyVersion ($pythonExe)" -ForegroundColor Gray

# MySQL Database check (Port 3306)
$mysqlConn = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue
if (-not $mysqlConn) {
    Write-Host "      ⚠ MySQL not detected on port 3306. Checking default mysqld..." -ForegroundColor Yellow
    $mysqldExe = "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe"
    $mysqlData = Join-Path $repoRoot "scratch\mysql_data"
    if ((Test-Path $mysqldExe) -and (Test-Path $mysqlData)) {
        Write-Host "      Starting local MySQL daemon on port 3306..." -ForegroundColor Gray
        Start-Process -FilePath $mysqldExe -ArgumentList "--datadir=`"$mysqlData`" --port=3306" -WindowStyle Hidden
        Start-Sleep -Seconds 3
    }
}
$mysqlConn = Get-NetTCPConnection -LocalPort 3306 -State Listen -ErrorAction SilentlyContinue
if ($mysqlConn) {
    Write-Host "      ✓ MySQL: Port 3306 is active" -ForegroundColor Green
} else {
    Write-Host "      ⚠ Warning: MySQL port 3306 is not listening. Database features may fail." -ForegroundColor Yellow
}

# ---------------------------------------------------------------------
# Phase 2: Track Spawned Processes
# ---------------------------------------------------------------------
$trackedPids = @{}
if (Test-Path $pidsFile) {
    try {
        $existing = Get-Content $pidsFile -Raw | ConvertFrom-Json
        foreach ($prop in $existing.PSObject.Properties) {
            $trackedPids[$prop.Name] = $prop.Value
        }
    } catch {}
}

function Save-Pids {
    $trackedPids | ConvertTo-Json -Depth 3 | Set-Content -Path $pidsFile -Force
}

function Wait-HttpReady($url, $timeoutSec, $expectedKeyword = "") {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        try {
            $resp = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 2 -ErrorAction SilentlyContinue
            if ($resp) {
                if ($expectedKeyword -eq "" -or ($resp | ConvertTo-Json -Compress) -like "*$expectedKeyword*") {
                    return $resp
                }
            }
        } catch {}
        Start-Sleep -Milliseconds 600
    }
    return $null
}

function Wait-TcpPort($port, $timeoutSec) {
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    while ($sw.Elapsed.TotalSeconds -lt $timeoutSec) {
        $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
        if ($conn) { return $true }
        Start-Sleep -Milliseconds 500
    }
    return $false
}

# ---------------------------------------------------------------------
# Step 1: FastAPI CDS / Frozen RAG Gateway (Port 8000)
# ---------------------------------------------------------------------
Write-Host "[2/6] Checking FastAPI CDS Gateway (Port 8000)..." -ForegroundColor Yellow
$fastapiConn = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
if ($fastapiConn) {
    $health = Wait-HttpReady "http://127.0.0.1:8000/health" 3 "healthy"
    if ($health) {
        Write-Host "      ✓ Port 8000 already running & healthy (PID $($fastapiConn[0].OwningProcess))" -ForegroundColor Green
    } else {
        Write-Host "      ⚠ Port 8000 occupied by PID $($fastapiConn[0].OwningProcess)" -ForegroundColor Gray
    }
} else {
    Write-Host "      Launching FastAPI CDS Gateway on port 8000..." -ForegroundColor Gray
    $logPath = Join-Path $logsDir "fastapi_8000.log"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $pythonExe
    $psi.Arguments = "-m uvicorn rag_module.api:app --host 127.0.0.1 --port 8000"
    $psi.WorkingDirectory = $repoRoot
    $psi.UseShellExecute = $false
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.CreateNoWindow = $true

    $proc = [System.Diagnostics.Process]::Start($psi)
    $trackedPids["fastapi_8000"] = $proc.Id
    Save-Pids

    Write-Host "      Waiting for FastAPI initialization (FAISS index + embeddings)..." -NoNewline -ForegroundColor Gray
    $health = Wait-HttpReady "http://127.0.0.1:8000/health" 45 "healthy"
    Write-Host ""
    if (-not $health) {
        Write-Error "FastAPI failed to become healthy on port 8000 within 45 seconds. Inspect $logPath"
        exit 1
    }
    Write-Host "      ✓ FastAPI CDS Gateway healthy (PID $($proc.Id))" -ForegroundColor Green
}

# ---------------------------------------------------------------------
# Step 2: Express EHR / CDS Gateway Backend (Port 5000)
# ---------------------------------------------------------------------
Write-Host "[3/6] Checking Express EHR & CDS Gateway (Port 5000)..." -ForegroundColor Yellow
$expressDir = Join-Path $repoRoot "Portal Major P\Bhumi\Doctor portal\backend"
$expressConn = Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue
if ($expressConn) {
    $health = Wait-HttpReady "http://localhost:5000/api/health" 3 "healthy"
    if ($health) {
        Write-Host "      ✓ Port 5000 already running & healthy (PID $($expressConn[0].OwningProcess))" -ForegroundColor Green
    } else {
        Write-Host "      ⚠ Port 5000 occupied by PID $($expressConn[0].OwningProcess)" -ForegroundColor Gray
    }
} else {
    Write-Host "      Launching Express Backend on port 5000..." -ForegroundColor Gray
    $logPath = Join-Path $logsDir "express_5000.log"
    $proc = Start-Process -FilePath $nodeCmd -ArgumentList "server.js" -WorkingDirectory $expressDir -PassThru -WindowStyle Hidden
    $trackedPids["express_5000"] = $proc.Id
    Save-Pids

    $health = Wait-HttpReady "http://localhost:5000/api/health" 20 "healthy"
    if (-not $health) {
        Write-Error "Express backend failed to become healthy on port 5000 within 20 seconds."
        exit 1
    }
    Write-Host "      ✓ Express EHR Gateway healthy (PID $($proc.Id))" -ForegroundColor Green
}

# ---------------------------------------------------------------------
# Step 3: Doctor Frontend (Port 5173)
# ---------------------------------------------------------------------
Write-Host "[4/6] Checking Doctor Frontend (Port 5173)..." -ForegroundColor Yellow
$doctorDir = Join-Path $repoRoot "Portal Major P\Bhumi\Doctor portal\frontend"
$docConn = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($docConn) {
    Write-Host "      ✓ Doctor Frontend already listening on port 5173 (PID $($docConn[0].OwningProcess))" -ForegroundColor Green
} else {
    Write-Host "      Launching Doctor Frontend on port 5173..." -ForegroundColor Gray
    $proc = Start-Process -FilePath $npmCmd -ArgumentList "run dev" -WorkingDirectory $doctorDir -PassThru -WindowStyle Hidden
    $trackedPids["doctor_frontend_5173"] = $proc.Id
    Save-Pids
    $ready = Wait-TcpPort 5173 20
    if ($ready) {
        Write-Host "      ✓ Doctor Frontend listening on port 5173 (PID $($proc.Id))" -ForegroundColor Green
    } else {
        Write-Host "      ⚠ Doctor Frontend starting up..." -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------
# Step 4: Receptionist Frontend (Port 5174)
# ---------------------------------------------------------------------
Write-Host "[5/6] Checking Receptionist Frontend (Port 5174)..." -ForegroundColor Yellow
$receptionistDir = Join-Path $repoRoot "Portal Major P\Ketki\receptionist_frontend"
$recConn = Get-NetTCPConnection -LocalPort 5174 -State Listen -ErrorAction SilentlyContinue
if ($recConn) {
    Write-Host "      ✓ Receptionist Frontend already listening on port 5174 (PID $($recConn[0].OwningProcess))" -ForegroundColor Green
} else {
    Write-Host "      Launching Receptionist Frontend on port 5174..." -ForegroundColor Gray
    $proc = Start-Process -FilePath $npmCmd -ArgumentList "run dev" -WorkingDirectory $receptionistDir -PassThru -WindowStyle Hidden
    $trackedPids["receptionist_frontend_5174"] = $proc.Id
    Save-Pids
    $ready = Wait-TcpPort 5174 20
    if ($ready) {
        Write-Host "      ✓ Receptionist Frontend listening on port 5174 (PID $($proc.Id))" -ForegroundColor Green
    } else {
        Write-Host "      ⚠ Receptionist Frontend starting up..." -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------
# Step 5: Patient Frontend (Port 5175)
# ---------------------------------------------------------------------
Write-Host "[6/6] Checking Patient Frontend (Port 5175)..." -ForegroundColor Yellow
$patientDir = Join-Path $repoRoot "Portal Major P\patient_frontend"
$patConn = Get-NetTCPConnection -LocalPort 5175 -State Listen -ErrorAction SilentlyContinue
if ($patConn) {
    Write-Host "      ✓ Patient Frontend already listening on port 5175 (PID $($patConn[0].OwningProcess))" -ForegroundColor Green
} else {
    Write-Host "      Launching Patient Frontend on port 5175..." -ForegroundColor Gray
    $proc = Start-Process -FilePath $npmCmd -ArgumentList "run dev" -WorkingDirectory $patientDir -PassThru -WindowStyle Hidden
    $trackedPids["patient_frontend_5175"] = $proc.Id
    Save-Pids
    $ready = Wait-TcpPort 5175 20
    if ($ready) {
        Write-Host "      ✓ Patient Frontend listening on port 5175 (PID $($proc.Id))" -ForegroundColor Green
    } else {
        Write-Host "      ⚠ Patient Frontend starting up..." -ForegroundColor Yellow
    }
}

# ---------------------------------------------------------------------
# Service Summary Banner & Canonical Hub Link
# ---------------------------------------------------------------------
Write-Host ""
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host "       HEALTHCARE CDS PLATFORM SUCCESSFULLY STARTED & INTEGRATED!         " -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  ⭐ CANONICAL ENTRY HUB:   http://localhost:5000/ " -ForegroundColor Cyan
Write-Host ""
Write-Host "  Role Workstations:" -ForegroundColor White
Write-Host "    🩺 Doctor Portal:       http://localhost:5173" -ForegroundColor White
Write-Host "    📋 Receptionist Portal: http://localhost:5174" -ForegroundColor White
Write-Host "    🏥 Patient Portal:      http://localhost:5175" -ForegroundColor White
Write-Host "    🔑 Account Activation:  http://localhost:5175/activate" -ForegroundColor White
Write-Host ""
Write-Host "  Internal Gateways:" -ForegroundColor Gray
Write-Host "    🌐 Express EHR Gateway: http://localhost:5000/api/health" -ForegroundColor Gray
Write-Host "    🤖 FastAPI CDS/RAG:     http://127.0.0.1:8000/docs" -ForegroundColor Gray
Write-Host "    🗄️ MySQL Database:      127.0.0.1:3306 (rag_healthcare)" -ForegroundColor Gray
Write-Host "    🗣️ Multilingual:        en, hi, mr, gu" -ForegroundColor Gray
Write-Host ""
Write-Host "  Runtime Data:" -ForegroundColor Gray
Write-Host "    PID Tracker:           $pidsFile" -ForegroundColor Gray
Write-Host "    Logs Directory:        $logsDir" -ForegroundColor Gray
Write-Host ""
Write-Host "  To Stop the System:      Run .\stop_demo.ps1" -ForegroundColor Yellow
Write-Host "==========================================================================" -ForegroundColor Green
Write-Host ""

# Optional: Open Hub in default browser
try {
    Start-Process "http://localhost:5000/"
} catch {}

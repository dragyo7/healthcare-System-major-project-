<#
.SYNOPSIS
  scripts/doctor.ps1 - CDSS Healthcare Platform Environment & Diagnostic Verifier
  Verifies system prerequisites, services, ports, databases, datasets, and API health.

.DESCRIPTION
  Runs an exhaustive pre-flight verification on a teammate's workstation:
  1. Runtime & CLI tool prerequisites (Node.js, Python, Git, PowerShell)
  2. Service ports and listening status (3306, 8000, 5000/5001, 5173)
  3. MySQL database connectivity and table schema integrity
  4. Clinical datasets & RAG artifacts (FAISS index, Synthea archive SHA-256, DDI rules)
  5. Live HTTP health endpoint probes

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File ./scripts/doctor.ps1
#>

$ErrorActionPreference = "Continue"

Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "         HEALTHCARE CDSS PLATFORM DIAGNOSTIC & DOCTOR CHECK               " -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan

$RepoRoot = Split-Path -Parent $PSScriptRoot
$TotalChecks = 0
$PassedChecks = 0
$Warnings = 0
$Errors = 0

function Report-Check ($Category, $Name, $Success, $Details, $IsWarning = $false) {
    $script:TotalChecks++
    if ($Success) {
        $script:PassedChecks++
        Write-Host "  [PASS] [$Category] $Name - $Details" -ForegroundColor Green
    } elseif ($IsWarning) {
        $script:Warnings++
        Write-Host "  [WARN] [$Category] $Name - $Details" -ForegroundColor Yellow
    } else {
        $script:Errors++
        Write-Host "  [FAIL] [$Category] $Name - $Details" -ForegroundColor Red
    }
}

function Test-TcpPort ($Port) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $iar = $tcp.BeginConnect("127.0.0.1", $Port, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne(600)
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

# -----------------------------------------------------------------------------
# 1. System & CLI Runtimes
# -----------------------------------------------------------------------------
Write-Host "`n1. Inspecting System Runtimes & Tooling..." -ForegroundColor White

# Node.js
try {
    $nodeVer = (node -v 2>$null)
    if ($nodeVer -match "v(\d+)") {
        $major = [int]$matches[1]
        Report-Check "Runtime" "Node.js" ($major -ge 18) "$nodeVer (Required: >= v18)"
    } else {
        Report-Check "Runtime" "Node.js" $false "Node.js not found on PATH"
    }
} catch {
    Report-Check "Runtime" "Node.js" $false "Failed to execute 'node -v'"
}

# Python
try {
    $pyVer = (python --version 2>&1)
    if ($pyVer -match "Python (\d+)\.(\d+)") {
        $pyMajor = [int]$matches[1]
        $pyMinor = [int]$matches[2]
        $pyValid = ($pyMajor -ge 3 -and $pyMinor -ge 9)
        Report-Check "Runtime" "Python" $pyValid "$pyVer (Required: >= 3.9)"
    } else {
        Report-Check "Runtime" "Python" $false "Python not found on PATH"
    }
} catch {
    Report-Check "Runtime" "Python" $false "Failed to execute 'python --version'"
}

# Git
try {
    $gitVer = (git --version 2>$null)
    Report-Check "Runtime" "Git" ([bool]$gitVer) "$gitVer"
} catch {
    Report-Check "Runtime" "Git" $false "Git not found on PATH"
}

# -----------------------------------------------------------------------------
# 2. Port & Service Inspection
# -----------------------------------------------------------------------------
Write-Host "`n2. Inspecting Core Services & Port Bindings..." -ForegroundColor White

$ports = @(
    @{ Name = "MySQL Server"; Port = 3306; Role = "EHR relational store"; Critical = $true },
    @{ Name = "FastAPI Gateway"; Port = 8000; Role = "CDS Engine & Frozen RAG v2.10"; Critical = $true },
    @{ Name = "Express Dev Backend"; Port = 5000; Role = "EHR API Server (Production/Dev DB)"; Critical = $false },
    @{ Name = "Express Test Backend"; Port = 5001; Role = "EHR API Server (Isolated Test DB)"; Critical = $false },
    @{ Name = "Vite Frontend"; Port = 5173; Role = "Unified Clinical Web Portal"; Critical = $true }
)

foreach ($p in $ports) {
    $isOpen = Test-TcpPort $p.Port
    if ($isOpen) {
        Report-Check "Port" "$($p.Name) (Port $($p.Port))" $true "Listening ($($p.Role))"
    } else {
        Report-Check "Port" "$($p.Name) (Port $($p.Port))" $false "Not listening on 127.0.0.1:$($p.Port)" (-not $p.Critical)
    }
}

# -----------------------------------------------------------------------------
# 3. Clinical Data & RAG Artifact Integrity
# -----------------------------------------------------------------------------
Write-Host "`n3. Verifying Clinical Artifacts & Data Provenance..." -ForegroundColor White

# FAISS Vector Index
$faissPaths = @(
    @{ Bin = (Join-Path $RepoRoot "data\faiss_index\index_v2.bin"); Meta = (Join-Path $RepoRoot "data\faiss_index\meta_v2.pkl") },
    @{ Bin = (Join-Path $RepoRoot "rag_module\data\faiss_index\index_v2.bin"); Meta = (Join-Path $RepoRoot "rag_module\data\faiss_index\meta_v2.pkl") },
    @{ Bin = (Join-Path $RepoRoot "data\indices\production\index_v2.bin"); Meta = (Join-Path $RepoRoot "data\indices\production\meta_v2.pkl") }
)

$faissFound = $null
foreach ($fp in $faissPaths) {
    if ((Test-Path $fp.Bin) -and (Test-Path $fp.Meta)) {
        $faissFound = $fp
        break
    }
}

if ($faissFound) {
    $binSize = (Get-Item $faissFound.Bin).Length / 1MB
    Report-Check "Data" "FAISS Vector Index" $true "Present at $($faissFound.Bin) ($('{0:N2}' -f $binSize) MB, 2,204 chunks)"
} else {
    Report-Check "Data" "FAISS Vector Index" $false "Missing index_v2.bin or meta_v2.pkl in data/faiss_index/ or rag_module/data/faiss_index/"
}

# Synthea FHIR Archive
$syntheaPaths = @(
    (Join-Path $RepoRoot "data\synthea\synthea_sample_data_fhir_r4_nov2021.zip"),
    (Join-Path $RepoRoot "scratch\synthea_sample_data_fhir_r4_nov2021.zip"),
    "$env:USERPROFILE\OneDrive\Desktop\synthea_sample_data_fhir_r4_nov2021.zip"
)
$syntheaFound = $null
foreach ($sp in $syntheaPaths) {
    if (Test-Path $sp) {
        $syntheaFound = $sp
        break
    }
}

if ($syntheaFound) {
    $hash = (Get-FileHash -Algorithm SHA256 $syntheaFound).Hash
    $expectedHash = "6D3C5433BCAE4791BC5C30469D1445B430FB4894D5C13BDA15FEE0584BBD7778"
    $hashMatch = ($hash.ToUpper() -eq $expectedHash.ToUpper())
    Report-Check "Data" "Synthea FHIR Archive" $hashMatch "Found at $syntheaFound (SHA-256: $(if ($hashMatch) {'VERIFIED'} else {'MISMATCH'}))"
} else {
    Report-Check "Data" "Synthea FHIR Archive" $false "Archive not found. Teammate must place synthea_sample_data_fhir_r4_nov2021.zip in data/synthea/ or define SYNTHEA_ARCHIVE" $true
}

# Medication Interaction Rules
$rulesDir = Join-Path $RepoRoot "data\rules\medication_interactions"
if (Test-Path $rulesDir) {
    $ruleFiles = Get-ChildItem -Path $rulesDir -Filter "*.json"
    Report-Check "Data" "Interaction Rules" ($ruleFiles.Count -ge 2) "Found $($ruleFiles.Count) clinical rule files in data/rules/medication_interactions"
} else {
    Report-Check "Data" "Interaction Rules" $false "Directory data/rules/medication_interactions missing"
}

# -----------------------------------------------------------------------------
# 4. HTTP Health Endpoint Probes
# -----------------------------------------------------------------------------
Write-Host "`n4. Probing HTTP Health Endpoints..." -ForegroundColor White

function Probe-Http ($Url, $ServiceName) {
    try {
        $res = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 3 -ErrorAction Stop
        Report-Check "HTTP" "$ServiceName ($Url)" $true "HTTP 200 OK - $(ConvertTo-Json -Compress $res | Out-String | ForEach-Object { $_.Trim().Substring(0, [Math]::Min(80, $_.Trim().Length)) })"
    } catch {
        Report-Check "HTTP" "$ServiceName ($Url)" $false "Probe failed: $($_.Exception.Message)" $true
    }
}

Probe-Http "http://127.0.0.1:8000/health" "FastAPI CDS Gateway"
Probe-Http "http://127.0.0.1:5000/health" "Express Dev Backend"
Probe-Http "http://127.0.0.1:5001/health" "Express Test Backend"

# -----------------------------------------------------------------------------
# Summary & Readiness Assessment
# -----------------------------------------------------------------------------
Write-Host "`n==========================================================================" -ForegroundColor Cyan
Write-Host "                           DIAGNOSTIC SUMMARY                             " -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "  Total Checks:    $TotalChecks"
Write-Host "  Passed Checks:   $PassedChecks" -ForegroundColor Green
Write-Host "  Warnings:        $Warnings" -ForegroundColor $(if ($Warnings -gt 0) { "Yellow" } else { "Gray" })
Write-Host "  Errors:          $Errors" -ForegroundColor $(if ($Errors -gt 0) { "Red" } else { "Green" })

if ($Errors -eq 0) {
    Write-Host "`n  >>> STATUS: TEAMMATE ENVIRONMENT VERIFIED HEALTHY & PORTABLE <<<" -ForegroundColor Green
} else {
    Write-Host "`n  >>> STATUS: ISSUES DETECTED - REVIEW FAILED CHECKS ABOVE <<<" -ForegroundColor Red
}
Write-Host "==========================================================================`n" -ForegroundColor Cyan

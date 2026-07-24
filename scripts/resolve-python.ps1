param(
    [Version]$MinimumVersion = [Version]"3.11"
)

$ErrorActionPreference = "Stop"
$candidates = [System.Collections.Generic.List[string]]::new()

function Add-PythonCandidate {
    param([string]$Path)
    if (-not [string]::IsNullOrWhiteSpace($Path) -and -not $candidates.Contains($Path)) {
        $candidates.Add($Path)
    }
}

Add-PythonCandidate $env:PYTHON

$pathPython = Get-Command python.exe -ErrorAction SilentlyContinue
if ($null -ne $pathPython) {
    Add-PythonCandidate $pathPython.Source
}

if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    $pythonInstallRoot = Join-Path $env:LOCALAPPDATA "Programs\Python"
    if (Test-Path -LiteralPath $pythonInstallRoot -PathType Container) {
        Get-ChildItem -LiteralPath $pythonInstallRoot -Directory -Filter "Python*" |
            Sort-Object Name -Descending |
            ForEach-Object { Add-PythonCandidate (Join-Path $_.FullName "python.exe") }
    }
    Add-PythonCandidate (Join-Path $env:LOCALAPPDATA "miniconda3\python.exe")
}

if (-not [string]::IsNullOrWhiteSpace($env:ProgramData)) {
    Add-PythonCandidate (Join-Path $env:ProgramData "miniconda3\python.exe")
}

foreach ($candidate in $candidates) {
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
        continue
    }
    try {
        $details = & $candidate -c "import struct,sys; print(f'{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}|{struct.calcsize(chr(80))*8}|{sys.executable}')"
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($details)) {
            continue
        }
        $parts = $details.Trim() -split '\|', 3
        $version = [Version]$parts[0]
        $bits = [int]$parts[1]
        $resolvedPath = $parts[2]
        if ($version -ge $MinimumVersion -and $bits -eq 64) {
            Write-Host "Using Python $version ($bits-bit): $resolvedPath"
            Write-Output $resolvedPath
            return
        }
    }
    catch {
        Write-Verbose "Rejected Python candidate $candidate`: $($_.Exception.Message)"
    }
}

throw "Python $MinimumVersion or newer (64-bit) is required. Install it on the Windows runner or set the PYTHON environment variable."

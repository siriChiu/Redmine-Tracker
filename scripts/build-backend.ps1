param(
    [switch]$Console
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$pythonExecutable = Join-Path $repositoryRoot ".venv\Scripts\python.exe"

if (-not (Test-Path -LiteralPath $pythonExecutable -PathType Leaf)) {
    throw "Python virtual environment not found: $pythonExecutable"
}

$basePrefix = (& $pythonExecutable -c "import sys; print(sys.base_prefix)").Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($basePrefix)) {
    throw "Unable to resolve Python base prefix."
}

$runtimeDirectories = @(
    (Join-Path $basePrefix "Library\bin"),
    (Join-Path $basePrefix "DLLs"),
    $basePrefix
) | Where-Object { Test-Path -LiteralPath $_ -PathType Container }

$previousPath = $env:PATH
$env:PATH = (@($runtimeDirectories) + @($previousPath)) -join [IO.Path]::PathSeparator

$hiddenImports = @(
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.asyncio",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "h11",
    "starlette",
    "email",
    "http",
    "wsgiref",
    "xml",
    "pythoncom",
    "pywintypes",
    "win32com",
    "win32com.client"
)

$arguments = @(
    "-m", "PyInstaller",
    "--clean",
    "--name", "backend",
    "--onefile",
    "--distpath", "backend/dist",
    "--workpath", "backend/build",
    "--specpath", "backend",
    "--additional-hooks-dir", "backend/hooks"
)
if (-not $Console) {
    $arguments += "--noconsole"
}
foreach ($module in $hiddenImports) {
    $arguments += "--hidden-import=$module"
}
$arguments += "backend/main.py"

Push-Location $repositoryRoot
try {
    Write-Host "Python base runtime: $basePrefix"
    Write-Host "Native DLL search directories: $($runtimeDirectories -join ', ')"
    & $pythonExecutable @arguments
    if ($LASTEXITCODE -ne 0) {
        throw "PyInstaller failed with exit code $LASTEXITCODE"
    }

    $warningPath = "backend/build/backend/warn-backend.txt"
    $unresolvedLibraries = @(
        Select-String -LiteralPath $warningPath -Pattern "Library not found:" -ErrorAction SilentlyContinue
    )
    if ($unresolvedLibraries.Count -gt 0) {
        $details = $unresolvedLibraries | ForEach-Object { $_.Line.Trim() }
        throw "PyInstaller left unresolved native libraries: $($details -join '; ')"
    }
    Write-Host "PyInstaller completed with no unresolved native libraries."
}
finally {
    $env:PATH = $previousPath
    Pop-Location
}

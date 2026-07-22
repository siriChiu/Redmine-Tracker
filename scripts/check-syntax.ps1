param(
    [string]$PythonExecutable = ".\.venv\Scripts\python.exe"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot

Push-Location $repositoryRoot
try {
    $powerShellFiles = Get-ChildItem -LiteralPath "scripts" -Filter "*.ps1" -File
    foreach ($file in $powerShellFiles) {
        $tokens = $null
        $parseErrors = $null
        [void][System.Management.Automation.Language.Parser]::ParseFile(
            $file.FullName,
            [ref]$tokens,
            [ref]$parseErrors
        )
        if ($parseErrors.Count -gt 0) {
            $details = $parseErrors | ForEach-Object { $_.Message }
            throw "PowerShell syntax error in $($file.FullName): $($details -join '; ')"
        }
        Write-Host "Validated PowerShell syntax: $($file.FullName)"
    }

    $javaScriptFiles = @(
        Get-ChildItem -LiteralPath "electron" -Filter "*.js" -File
        Get-ChildItem -LiteralPath "bin" -Filter "*.js" -File
    )
    foreach ($file in $javaScriptFiles) {
        & node --check $file.FullName
        if ($LASTEXITCODE -ne 0) {
            throw "JavaScript syntax validation failed: $($file.FullName)"
        }
        Write-Host "Validated JavaScript syntax: $($file.FullName)"
    }

    & $PythonExecutable -m compileall -q backend scripts
    if ($LASTEXITCODE -ne 0) {
        throw "Python syntax validation failed."
    }
    Write-Host "Validated Python syntax: backend and scripts"
}
finally {
    Pop-Location
}

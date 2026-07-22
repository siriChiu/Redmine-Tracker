param(
    [string]$PythonExecutable = ".\.venv\Scripts\python.exe"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot

Push-Location $repositoryRoot
try {
    $jsonFiles = @("package.json", "package-lock.json")
    foreach ($jsonFile in $jsonFiles) {
        if (-not (Test-Path -LiteralPath $jsonFile -PathType Leaf)) {
            throw "Required JSON file is missing: $jsonFile"
        }

        & node -e "JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))" $jsonFile
        if ($LASTEXITCODE -ne 0) {
            throw "JSON validation failed: $jsonFile"
        }
        Write-Host "Validated JSON: $jsonFile"
    }

    if (-not (Test-Path -LiteralPath $PythonExecutable -PathType Leaf)) {
        throw "Python executable not found: $PythonExecutable"
    }

    & $PythonExecutable scripts/validate_yaml.py
    if ($LASTEXITCODE -ne 0) {
        throw "YAML validation failed with exit code $LASTEXITCODE"
    }

    Write-Host "Configuration validation completed. TypeScript JSON-with-comments files are validated by npm run build."
}
finally {
    Pop-Location
}

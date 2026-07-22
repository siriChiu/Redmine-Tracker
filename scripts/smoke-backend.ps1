param(
    [string]$BackendPath = "backend/dist/backend.exe",
    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$resolvedBackendPath = Join-Path $repositoryRoot $BackendPath

if (-not (Test-Path -LiteralPath $resolvedBackendPath -PathType Leaf)) {
    throw "Backend executable not found: $resolvedBackendPath"
}

$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$listener.Start()
$port = ([System.Net.IPEndPoint]$listener.LocalEndpoint).Port
$listener.Stop()

$previousPort = $env:REDMINE_TRACKER_PORT
$env:REDMINE_TRACKER_PORT = $port.ToString()
$process = $null

try {
    $process = Start-Process `
        -FilePath $resolvedBackendPath `
        -WorkingDirectory (Split-Path -Parent $resolvedBackendPath) `
        -WindowStyle Hidden `
        -PassThru

    $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
    $response = $null
    while ([DateTime]::UtcNow -lt $deadline) {
        if ($process.HasExited) {
            throw "Backend exited before the smoke test completed (exit code $($process.ExitCode))."
        }
        try {
            $response = Invoke-RestMethod -Uri "http://127.0.0.1:$port/api/debug" -TimeoutSec 2
            break
        }
        catch {
            Start-Sleep -Milliseconds 250
        }
    }

    if ($null -eq $response) {
        throw "Backend did not become ready on dynamic port $port within $TimeoutSeconds seconds."
    }
    Write-Host "Backend smoke test passed on dynamic port $port."
}
finally {
    if ($null -ne $process -and -not $process.HasExited) {
        & taskkill.exe /PID $process.Id /T /F | Out-Null
    }

    if ($null -eq $previousPort) {
        Remove-Item Env:REDMINE_TRACKER_PORT -ErrorAction SilentlyContinue
    }
    else {
        $env:REDMINE_TRACKER_PORT = $previousPort
    }
}

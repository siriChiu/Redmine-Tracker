param(
    [Parameter(Mandatory = $true)]
    [string]$Tag,
    [string]$PackageName = "redmine-tracker",
    [string]$ReleaseDirectory = "release",
    [string]$OutputDirectory = "release-bundle"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot

if ($Tag -notmatch '^[A-Za-z0-9._+-]+$') {
    throw "Tag contains characters that are unsafe for package paths: $Tag"
}
if ($PackageName -notmatch '^[a-z0-9][a-z0-9._-]*$') {
    throw "PackageName must contain only lowercase letters, numbers, dots, underscores, or hyphens."
}

$resolvedReleaseDirectory = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $ReleaseDirectory))
$resolvedOutputDirectory = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $OutputDirectory))

if (-not (Test-Path -LiteralPath $resolvedReleaseDirectory -PathType Container)) {
    throw "Release directory not found: $resolvedReleaseDirectory"
}
if (Test-Path -LiteralPath $resolvedOutputDirectory) {
    throw "Output directory already exists. Use a new path or remove it explicitly: $resolvedOutputDirectory"
}

$installers = @(Get-ChildItem -LiteralPath $resolvedReleaseDirectory -Filter "*.exe" -File | Sort-Object LastWriteTimeUtc -Descending)
if ($installers.Count -eq 0) {
    throw "No Windows installer was found in $resolvedReleaseDirectory"
}

$sourceInstaller = $installers[0]
$versionedBaseName = "$PackageName-$Tag-windows-x64"
$versionedInstallerName = "$versionedBaseName.exe"
$versionedArchiveName = "$versionedBaseName.tar.gz"
$latestInstallerName = "$PackageName-windows-x64.exe"
$latestArchiveName = "$PackageName-windows-x64.tar.gz"

New-Item -ItemType Directory -Path $resolvedOutputDirectory | Out-Null
$latestDirectory = New-Item -ItemType Directory -Path (Join-Path $resolvedOutputDirectory "latest")
$stagingParent = Join-Path $resolvedOutputDirectory (".staging-" + [Guid]::NewGuid().ToString("N"))
$stagingRoot = Join-Path $stagingParent $versionedBaseName

try {
    New-Item -ItemType Directory -Path $stagingRoot | Out-Null
    New-Item -ItemType Directory -Path (Join-Path $stagingRoot "config") | Out-Null

    $versionedInstallerPath = Join-Path $resolvedOutputDirectory $versionedInstallerName
    Copy-Item -LiteralPath $sourceInstaller.FullName -Destination $versionedInstallerPath
    Copy-Item -LiteralPath $versionedInstallerPath -Destination (Join-Path $stagingRoot $versionedInstallerName)
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "README.md") -Destination (Join-Path $stagingRoot "README.md")
    Copy-Item -LiteralPath (Join-Path $repositoryRoot "config/settings.example.yaml") -Destination (Join-Path $stagingRoot "config/settings.example.yaml")
    Set-Content -LiteralPath (Join-Path $stagingRoot "VERSION") -Value $Tag -Encoding ascii -NoNewline

    $versionedArchivePath = Join-Path $resolvedOutputDirectory $versionedArchiveName
    & tar.exe -czf $versionedArchivePath -C $stagingParent $versionedBaseName
    if ($LASTEXITCODE -ne 0) {
        throw "tar.exe failed with exit code $LASTEXITCODE"
    }

    $versionFile = Join-Path $resolvedOutputDirectory "VERSION"
    Set-Content -LiteralPath $versionFile -Value $Tag -Encoding ascii -NoNewline

    $sumTargets = @($versionedInstallerPath, $versionedArchivePath, $versionFile)
    $sumLines = foreach ($target in $sumTargets) {
        $hash = Get-FileHash -LiteralPath $target -Algorithm SHA256
        "$($hash.Hash.ToLowerInvariant())  $([IO.Path]::GetFileName($target))"
    }
    Set-Content -LiteralPath (Join-Path $resolvedOutputDirectory "SHA256SUMS") -Value $sumLines -Encoding ascii

    Copy-Item -LiteralPath $versionedInstallerPath -Destination (Join-Path $latestDirectory.FullName $latestInstallerName)
    Copy-Item -LiteralPath $versionedArchivePath -Destination (Join-Path $latestDirectory.FullName $latestArchiveName)
    Set-Content -LiteralPath (Join-Path $latestDirectory.FullName "VERSION") -Value $Tag -Encoding ascii -NoNewline

    $latestSumTargets = @(
        (Join-Path $latestDirectory.FullName $latestInstallerName),
        (Join-Path $latestDirectory.FullName $latestArchiveName),
        (Join-Path $latestDirectory.FullName "VERSION")
    )
    $latestSumLines = foreach ($target in $latestSumTargets) {
        $hash = Get-FileHash -LiteralPath $target -Algorithm SHA256
        "$($hash.Hash.ToLowerInvariant())  $([IO.Path]::GetFileName($target))"
    }
    Set-Content -LiteralPath (Join-Path $latestDirectory.FullName "SHA256SUMS") -Value $latestSumLines -Encoding ascii

    Write-Host "Created release package at $resolvedOutputDirectory"
    Get-ChildItem -LiteralPath $resolvedOutputDirectory -Recurse -File |
        Where-Object { -not $_.FullName.StartsWith($stagingParent, [StringComparison]::OrdinalIgnoreCase) } |
        ForEach-Object {
        Write-Host "  $($_.FullName)"
    }
}
finally {
    if (Test-Path -LiteralPath $stagingParent) {
        Remove-Item -LiteralPath $stagingParent -Recurse -Force
    }
}

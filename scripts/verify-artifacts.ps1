param(
    [ValidateSet("CI", "Release", "Package")]
    [string]$Mode = "CI",
    [string]$PackageDirectory = "release-bundle"
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot

function Assert-FileExists {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [long]$MinimumBytes = 1
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "Expected artifact is missing: $Path"
    }
    $file = Get-Item -LiteralPath $Path
    if ($file.Length -lt $MinimumBytes) {
        throw "Artifact is unexpectedly small ($($file.Length) bytes): $Path"
    }
    Write-Host "Verified artifact: $Path ($($file.Length) bytes)"
}

function Assert-Checksums {
    param([Parameter(Mandatory = $true)][string]$Directory)

    $checksumPath = Join-Path $Directory "SHA256SUMS"
    Assert-FileExists $checksumPath
    $lines = @(Get-Content -LiteralPath $checksumPath | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($lines.Count -eq 0) {
        throw "Checksum file is empty: $checksumPath"
    }
    foreach ($line in $lines) {
        if ($line -notmatch '^([a-f0-9]{64})  (.+)$') {
            throw "Invalid SHA256SUMS line: $line"
        }
        $expectedHash = $Matches[1]
        $fileName = $Matches[2]
        $target = Join-Path $Directory $fileName
        Assert-FileExists $target
        $actualHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actualHash -ne $expectedHash) {
            throw "SHA256 mismatch for $target"
        }
        Write-Host "Verified SHA256: $target"
    }
}

Push-Location $repositoryRoot
try {
    switch ($Mode) {
        "CI" {
            Assert-FileExists "dist/index.html"
            Assert-FileExists "backend/dist/backend.exe" 1MB
            $assets = Get-ChildItem -LiteralPath "dist/assets" -File -ErrorAction Stop
            if ($assets.Count -eq 0) {
                throw "No frontend assets were generated in dist/assets."
            }
            Write-Host "Verified frontend asset count: $($assets.Count)"
        }
        "Release" {
            $installers = Get-ChildItem -LiteralPath "release" -Filter "*.exe" -File -ErrorAction Stop
            if ($installers.Count -eq 0) {
                throw "No Windows installer was generated in release."
            }
            foreach ($installer in $installers) {
                Assert-FileExists $installer.FullName 1MB
            }
        }
        "Package" {
            foreach ($name in @("VERSION", "SHA256SUMS")) {
                Assert-FileExists (Join-Path $PackageDirectory $name)
            }

            $versionedExecutables = @(Get-ChildItem -LiteralPath $PackageDirectory -Filter "*-windows-x64.exe" -File)
            $versionedArchives = @(Get-ChildItem -LiteralPath $PackageDirectory -Filter "*-windows-x64.tar.gz" -File)
            if ($versionedExecutables.Count -ne 1 -or $versionedArchives.Count -ne 1) {
                throw "Package directory must contain exactly one versioned exe and one versioned tar.gz."
            }
            Assert-FileExists $versionedExecutables[0].FullName 1MB
            Assert-FileExists $versionedArchives[0].FullName 1MB
            Assert-Checksums $PackageDirectory

            $latestDirectory = Join-Path $PackageDirectory "latest"
            foreach ($name in @("redmine-tracker-windows-x64.exe", "redmine-tracker-windows-x64.tar.gz", "SHA256SUMS", "VERSION")) {
                Assert-FileExists (Join-Path $latestDirectory $name)
            }
            Assert-Checksums $latestDirectory

            $versionedTag = (Get-Content -LiteralPath (Join-Path $PackageDirectory "VERSION") -Raw).Trim()
            $latestTag = (Get-Content -LiteralPath (Join-Path $latestDirectory "VERSION") -Raw).Trim()
            if ($versionedTag -ne $latestTag) {
                throw "latest/VERSION ($latestTag) does not match versioned VERSION ($versionedTag)."
            }

            $archiveEntries = @(& tar.exe -tzf $versionedArchives[0].FullName)
            if ($LASTEXITCODE -ne 0) {
                throw "Unable to read package archive: $($versionedArchives[0].FullName)"
            }
            foreach ($requiredSuffix in @("/README.md", "/VERSION", "/config/settings.example.yaml", ".exe")) {
                if (-not ($archiveEntries | Where-Object { $_.EndsWith($requiredSuffix, [StringComparison]::OrdinalIgnoreCase) })) {
                    throw "Package archive is missing an entry ending with: $requiredSuffix"
                }
            }
            Write-Host "Verified archive contents and latest VERSION=$latestTag"
        }
    }
}
finally {
    Pop-Location
}

param(
    [Parameter(Mandatory = $true)]
    [string]$ServerUrl,
    [Parameter(Mandatory = $true)]
    [string]$Owner,
    [Parameter(Mandatory = $true)]
    [string]$Repository,
    [Parameter(Mandatory = $true)]
    [string]$PackageName,
    [Parameter(Mandatory = $true)]
    [string]$Tag,
    [string]$ArtifactDirectory = "release-bundle",
    [string]$PackageToken,
    [string]$GiteaToken,
    [string]$ReleaseToken
)

$ErrorActionPreference = "Stop"
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$resolvedArtifactDirectory = [IO.Path]::GetFullPath((Join-Path $repositoryRoot $ArtifactDirectory))

if (-not (Test-Path -LiteralPath $resolvedArtifactDirectory -PathType Container)) {
    throw "Artifact directory not found: $resolvedArtifactDirectory"
}
if ($null -eq (Get-Command curl.exe -ErrorAction SilentlyContinue)) {
    throw "curl.exe is required to publish packages and release assets."
}

$selectedPackageToken = if (-not [string]::IsNullOrWhiteSpace($PackageToken)) { $PackageToken } else { $GiteaToken }
$selectedReleaseToken = if (-not [string]::IsNullOrWhiteSpace($ReleaseToken)) {
    $ReleaseToken
} elseif (-not [string]::IsNullOrWhiteSpace($GiteaToken)) {
    $GiteaToken
} else {
    $PackageToken
}

if ([string]::IsNullOrWhiteSpace($selectedPackageToken)) {
    throw "No package token is available. Configure PACKAGE_TOKEN or GITEA_TOKEN."
}
if ([string]::IsNullOrWhiteSpace($selectedReleaseToken)) {
    throw "No release token is available. Configure RELEASE_TOKEN, GITEA_TOKEN, or PACKAGE_TOKEN."
}

function ConvertTo-UrlSegment {
    param([Parameter(Mandatory = $true)][string]$Value)
    return [Uri]::EscapeDataString($Value)
}

function Invoke-CurlRequest {
    param([Parameter(Mandatory = $true)][string[]]$Arguments)

    $responseFile = Join-Path ([IO.Path]::GetTempPath()) ("gitea-response-" + [Guid]::NewGuid().ToString("N") + ".txt")
    try {
        $curlArguments = @(
            "--silent",
            "--show-error",
            "--output", $responseFile,
            "--write-out", "%{http_code}"
        ) + $Arguments
        $statusText = (& curl.exe @curlArguments | Out-String).Trim()
        if ($LASTEXITCODE -ne 0) {
            throw "curl.exe failed with exit code $LASTEXITCODE"
        }
        $status = 0
        if (-not [int]::TryParse($statusText, [ref]$status)) {
            throw "curl.exe returned an invalid HTTP status: $statusText"
        }
        $content = if (Test-Path -LiteralPath $responseFile) {
            Get-Content -LiteralPath $responseFile -Raw -ErrorAction SilentlyContinue
        } else {
            ""
        }
        return [pscustomobject]@{ StatusCode = $status; Content = $content }
    }
    finally {
        if (Test-Path -LiteralPath $responseFile) {
            Remove-Item -LiteralPath $responseFile -Force
        }
    }
}

function Assert-Status {
    param(
        [Parameter(Mandatory = $true)]$Response,
        [Parameter(Mandatory = $true)][int[]]$Allowed,
        [Parameter(Mandatory = $true)][string]$Operation
    )
    if ($Allowed -notcontains $Response.StatusCode) {
        throw "$Operation failed with HTTP $($Response.StatusCode). $($Response.Content)"
    }
}

$server = $ServerUrl.TrimEnd('/')
$encodedOwner = ConvertTo-UrlSegment $Owner
$encodedRepository = ConvertTo-UrlSegment $Repository
$encodedPackage = ConvertTo-UrlSegment $PackageName
$encodedTag = ConvertTo-UrlSegment $Tag
$packageAuthorization = "Authorization: token $selectedPackageToken"
$releaseAuthorization = "Authorization: token $selectedReleaseToken"

function Publish-GenericFile {
    param(
        [Parameter(Mandatory = $true)][string]$Version,
        [Parameter(Mandatory = $true)][IO.FileInfo]$File,
        [Parameter(Mandatory = $true)][bool]$AllowConflict
    )
    $uri = "$server/api/packages/$encodedOwner/generic/$encodedPackage/$(ConvertTo-UrlSegment $Version)/$(ConvertTo-UrlSegment $File.Name)"
    $response = Invoke-CurlRequest @(
        "--request", "PUT",
        "--header", $packageAuthorization,
        "--header", "Content-Type: application/octet-stream",
        "--upload-file", $File.FullName,
        $uri
    )

    if ($response.StatusCode -eq 201) {
        Write-Host "Uploaded generic package: $Version/$($File.Name)"
    } elseif ($AllowConflict -and $response.StatusCode -eq 409) {
        Write-Host "Generic package already exists; skipped: $Version/$($File.Name)"
    } else {
        throw "Uploading generic package $Version/$($File.Name) failed with HTTP $($response.StatusCode). $($response.Content)"
    }
}

$versionedFiles = @(Get-ChildItem -LiteralPath $resolvedArtifactDirectory -File)
if ($versionedFiles.Count -eq 0) {
    throw "No versioned package files found in $resolvedArtifactDirectory"
}
foreach ($file in $versionedFiles) {
    Publish-GenericFile -Version $Tag -File $file -AllowConflict $true
}

$latestDeleteUri = "$server/api/packages/$encodedOwner/generic/$encodedPackage/latest"
$latestDeleteResponse = Invoke-CurlRequest @(
    "--request", "DELETE",
    "--header", $packageAuthorization,
    $latestDeleteUri
)
Assert-Status -Response $latestDeleteResponse -Allowed @(204, 404) -Operation "Deleting previous latest package"
Write-Host "Previous latest package removed or did not exist."

$latestDirectory = Join-Path $resolvedArtifactDirectory "latest"
$latestFiles = @(Get-ChildItem -LiteralPath $latestDirectory -File -ErrorAction Stop)
foreach ($file in $latestFiles) {
    Publish-GenericFile -Version "latest" -File $file -AllowConflict $false
}

$releaseBaseUri = "$server/api/v1/repos/$encodedOwner/$encodedRepository/releases"
$releaseByTagUri = "$releaseBaseUri/tags/$encodedTag"
$releaseResponse = Invoke-CurlRequest @(
    "--request", "GET",
    "--header", $releaseAuthorization,
    "--header", "Accept: application/json",
    $releaseByTagUri
)
$release = $null

if ($releaseResponse.StatusCode -eq 200) {
    $release = $releaseResponse.Content | ConvertFrom-Json
    Write-Host "Using existing Gitea release for $Tag."
} elseif ($releaseResponse.StatusCode -eq 404) {
    $releaseBody = @{
        tag_name = $Tag
        name = $Tag
        body = "Automated release for $Tag. See README.md in the package archive for installation and usage details."
        draft = $false
        prerelease = $Tag.Contains('-')
    } | ConvertTo-Json
    $releaseBodyFile = Join-Path ([IO.Path]::GetTempPath()) ("gitea-release-" + [Guid]::NewGuid().ToString("N") + ".json")
    try {
        [IO.File]::WriteAllText($releaseBodyFile, $releaseBody, [Text.UTF8Encoding]::new($false))
        $createResponse = Invoke-CurlRequest @(
            "--request", "POST",
            "--header", $releaseAuthorization,
            "--header", "Content-Type: application/json",
            "--data-binary", "@$releaseBodyFile",
            $releaseBaseUri
        )
    }
    finally {
        if (Test-Path -LiteralPath $releaseBodyFile) {
            Remove-Item -LiteralPath $releaseBodyFile -Force
        }
    }

    if ($createResponse.StatusCode -eq 201) {
        $release = $createResponse.Content | ConvertFrom-Json
        Write-Host "Created Gitea release for $Tag."
    } elseif ($createResponse.StatusCode -eq 409) {
        Write-Host "Release creation returned 409; retrieving the existing release."
        $releaseResponse = Invoke-CurlRequest @(
            "--request", "GET",
            "--header", $releaseAuthorization,
            "--header", "Accept: application/json",
            $releaseByTagUri
        )
        Assert-Status -Response $releaseResponse -Allowed @(200) -Operation "Retrieving release after conflict"
        $release = $releaseResponse.Content | ConvertFrom-Json
    } else {
        throw "Creating Gitea release failed with HTTP $($createResponse.StatusCode). $($createResponse.Content)"
    }
} else {
    throw "Retrieving Gitea release failed with HTTP $($releaseResponse.StatusCode). $($releaseResponse.Content)"
}

if ($null -eq $release.id) {
    throw "Gitea release response did not contain an id."
}

foreach ($file in $versionedFiles) {
    $assetUri = "$releaseBaseUri/$($release.id)/assets?name=$(ConvertTo-UrlSegment $file.Name)"
    $assetResponse = Invoke-CurlRequest @(
        "--request", "POST",
        "--header", $releaseAuthorization,
        "--form", "attachment=@$($file.FullName);filename=$($file.Name)",
        $assetUri
    )
    if ($assetResponse.StatusCode -eq 201) {
        Write-Host "Uploaded release asset: $($file.Name)"
    } elseif ($assetResponse.StatusCode -eq 409) {
        Write-Host "Release asset already exists; skipped: $($file.Name)"
    } else {
        throw "Uploading release asset $($file.Name) failed with HTTP $($assetResponse.StatusCode). $($assetResponse.Content)"
    }
}

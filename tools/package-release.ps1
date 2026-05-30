param(
    [string]$Version = "1.0.0"
)

$ErrorActionPreference = "Stop"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$Dist = Join-Path $Root "dist"
$PackageName = "rawgrim-toll-of-survival"
$ZipPath = Join-Path $Dist "$PackageName.zip"

if (Test-Path $Dist) {
    Remove-Item -LiteralPath $Dist -Recurse -Force
}

New-Item -ItemType Directory -Path $Dist | Out-Null

$Include = @(
    "module.json",
    "README.md",
    "CHANGELOG.md",
    "LICENSE",
    "scripts",
    "styles",
    "lang",
    "templates"
)

$Staging = Join-Path $Dist $PackageName
New-Item -ItemType Directory -Path $Staging | Out-Null

foreach ($Entry in $Include) {
    $Source = Join-Path $Root $Entry
    if (Test-Path $Source) {
        Copy-Item -LiteralPath $Source -Destination $Staging -Recurse
    }
}

Compress-Archive -Path (Join-Path $Staging "*") -DestinationPath $ZipPath -Force
Copy-Item -LiteralPath (Join-Path $Root "module.json") -Destination (Join-Path $Dist "module.json") -Force

Write-Host "Packaged $PackageName $Version"
Write-Host "ZIP: $ZipPath"
Write-Host "Manifest: $(Join-Path $Dist "module.json")"

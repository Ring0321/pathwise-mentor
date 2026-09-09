param(
  [string]$OutputDir = "..\outputs"
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$CloudAppRoot = Split-Path -Parent $PSScriptRoot
$WorkspaceRoot = Split-Path -Parent $CloudAppRoot
$FrontendRoot = Join-Path $WorkspaceRoot "sepath-yudao-teacher-console"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ResolvedOutputDir = Join-Path $WorkspaceRoot $OutputDir
$ReleaseName = "sepath-tencent-release-$Stamp"
$ReleaseRoot = Join-Path $ResolvedOutputDir $ReleaseName
$ArchivePath = Join-Path $ResolvedOutputDir "$ReleaseName.zip"

function Resolve-FullPath {
  param([string]$Path)
  return [System.IO.Path]::GetFullPath($Path)
}

$ResolvedOutputDirFull = Resolve-FullPath $ResolvedOutputDir
$ReleaseRootFull = Resolve-FullPath $ReleaseRoot
$ArchivePathFull = Resolve-FullPath $ArchivePath
if (-not $ReleaseRootFull.StartsWith($ResolvedOutputDirFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Release root is outside the intended output directory: $ReleaseRootFull"
}
if (-not $ArchivePathFull.StartsWith($ResolvedOutputDirFull + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "Archive path is outside the intended output directory: $ArchivePathFull"
}

function Copy-Tree {
  param(
    [string]$Source,
    [string]$Destination
  )

  New-Item -ItemType Directory -Force -Path $Destination | Out-Null
  Get-ChildItem -LiteralPath $Source -Force | Copy-Item -Destination $Destination -Recurse -Force
}

Push-Location $FrontendRoot
try {
  npm run build
} finally {
  Pop-Location
}

Push-Location $CloudAppRoot
try {
  npm run cloud:smoke
  npm run cloud:smoke:llm
} finally {
  Pop-Location
}

if (Test-Path $ReleaseRoot) {
  Remove-Item -LiteralPath $ReleaseRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $ReleaseRoot | Out-Null

Copy-Tree -Source (Join-Path $FrontendRoot "dist") -Destination (Join-Path $ReleaseRoot "web")

$apiCloudDir = Join-Path $ReleaseRoot "api\cloud"
New-Item -ItemType Directory -Force -Path $apiCloudDir | Out-Null
$apiFiles = @(
  "edge-api-auth.mjs",
  "edge-api-store.mjs",
  "edge-api-worker.mjs",
  "llm-gateway-worker.mjs",
  "work-order-agent.mjs",
  "serve_edge_api_worker.mjs",
  "workbench-domain.mjs"
)
foreach ($file in $apiFiles) {
  Copy-Item -LiteralPath (Join-Path $CloudAppRoot "cloud\$file") -Destination $apiCloudDir -Force
}

$apiPackageJson = @{
  type = "module"
  scripts = @{
    start = "node ./cloud/serve_edge_api_worker.mjs --port 8787"
  }
}
$apiPackageJson | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 (Join-Path $ReleaseRoot "api\package.json")

Copy-Tree -Source (Join-Path $CloudAppRoot "deploy") -Destination (Join-Path $ReleaseRoot "deploy")

$manifest = @{
  runtime = "sepath-tencent-release.v1"
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  frontend = "sepath-yudao-teacher-console"
  api = "sepath-cloud-app/cloud/serve_edge_api_worker.mjs"
  publicIp = "212.129.243.63"
  secretsIncluded = $false
  requiredRemotePorts = @(22, 80, 443)
  healthPaths = @("/", "/api/health", "/api/ai/generate-scaffold", "/api/agent/conversation", "/api/agent/conversation/draft")
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -Encoding UTF8 (Join-Path $ReleaseRoot "RELEASE_MANIFEST.json")

if (Test-Path $ArchivePath) {
  Remove-Item -LiteralPath $ArchivePath -Force
}
$releaseItems = Get-ChildItem -LiteralPath $ReleaseRoot -Force
Compress-Archive -Path $releaseItems.FullName -DestinationPath $ArchivePath -Force

Write-Host "releaseRoot=$ReleaseRoot"
Write-Host "archive=$ArchivePath"

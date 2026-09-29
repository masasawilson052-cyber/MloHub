param([string]$ProjectRoot = (Get-Location).Path)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path -LiteralPath $ProjectRoot).Path
$manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'patch-files.json') -Raw | ConvertFrom-Json
if (!(Test-Path -LiteralPath (Join-Path $root 'package.json'))) { throw 'Not a MloHub project root: package.json missing.' }
$package = Get-Content -LiteralPath (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
if ($package.name -ne 'mlohub-mobile' -or $package.main -ne 'expo-router/entry') { throw 'Wrong project. Expected mlohub-mobile / expo-router/entry.' }
foreach ($required in @('app','repositories','supabase/migrations')) {
  if (!(Test-Path -LiteralPath (Join-Path $root $required))) { throw "Wrong project layout: $required missing." }
}
function SafePath([string]$base,[string]$relative) {
  if ([IO.Path]::IsPathRooted($relative) -or $relative -match '(^|[\\/])\.\.([\\/]|$)' -or $relative -match '(^|[\\/])(\.env[^\\/]*|node_modules|\.git|\.expo|dist[^\\/]*|build|coverage|secrets?)([\\/]|$)') { throw "Unsafe patch path: $relative" }
  $full=[IO.Path]::GetFullPath((Join-Path $base $relative))
  if (!$full.StartsWith($base.TrimEnd('\')+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Patch path escapes project.' }
  $probe=$full
  while ($probe -and $probe.Length -ge $base.Length) {
    if (Test-Path -LiteralPath $probe) { if ((Get-Item -LiteralPath $probe -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refusing linked path: $probe" } }
    $probe=Split-Path -Parent $probe
  }
  return $full
}
# Validate every source and baseline before any project writes.
foreach ($entry in $manifest) {
  $source=SafePath $PSScriptRoot $entry.path
  $target=SafePath $root $entry.path
  if (!(Test-Path -LiteralPath $source) -or (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $entry.sha256) { throw "Patch integrity failure: $($entry.path)" }
  if ($entry.originalSha256) {
    if (!(Test-Path -LiteralPath $target) -or (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $entry.originalSha256) { throw "Baseline differs: $($entry.path). No files changed; reconcile your newer edits first." }
  } elseif (Test-Path -LiteralPath $target) { throw "New patch file already exists: $($entry.path)" }
}
$backup=Join-Path $root ('mlohub-patch-backup-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'-'+[guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $backup | Out-Null
foreach ($entry in $manifest) {
  $target=SafePath $root $entry.path
  if (Test-Path -LiteralPath $target) {
    $saved=Join-Path $backup $entry.path
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $saved) | Out-Null
    Copy-Item -LiteralPath $target -Destination $saved
  }
}
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $backup 'applied-files.json')
foreach ($entry in $manifest) {
  $target=SafePath $root $entry.path
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent $target) | Out-Null
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $entry.path) -Destination $target -Force
  if ((Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash -ne $entry.sha256) { throw "Copy verification failed: $($entry.path). Backup: $backup" }
}
Write-Host "Patch applied. Backup: $backup"
Write-Host 'Database migration and server deployment are separate; see the closure report.'
Push-Location $root
try {
  if (!(Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm missing. Patch applied; verification blocked.' }
  if (!(Test-Path -LiteralPath 'node_modules')) { throw 'Dependencies missing. Patch applied; verification blocked. No dependencies were installed.' }
  foreach ($check in @('typecheck','test','security:test','production:check','export:web','export:android')) {
    if ($package.scripts.PSObject.Properties.Name -contains $check) {
      # Export output goes into a new verification directory; existing build outputs are untouched.
      if ($check -like 'export:*') {
        $exportPath=Join-Path $backup ('verification-'+$check.Replace(':','-'))
        & npm.cmd run $check -- --output-dir $exportPath
      } else { & npm.cmd run $check }
      if ($LASTEXITCODE -ne 0) { throw "$check failed with exit $LASTEXITCODE. Patch remains applied. Backup: $backup" }
    } else { Write-Warning "$check unavailable in this project." }
  }
} finally { Pop-Location }

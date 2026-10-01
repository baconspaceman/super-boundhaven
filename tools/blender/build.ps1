#requires -Version 7
<#
  One-command rebuild of the Blender-rendered 2D art (backgrounds + sprites). Deterministic (fixed seeds), idempotent.
  Usage: pwsh tools/blender/build.ps1 [-Tods sunset,day] [-SkipSprites] [-Blender <path>] [-Python <path>]
  Raw hi-res renders go to tools/blender/_work/ (gitignored); shipped PNGs land in packages/art/assets/blender/.
#>
param(
  [string[]]$Tods = @('dawn', 'day', 'sunset', 'night'),
  [switch]$SkipSprites,
  [string]$Blender = 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe',
  [string]$Python = 'C:\Program Files\Python311\python.exe'
)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$work = Join-Path $here '_work'
$out = Join-Path $here '..\..\packages\art\assets\blender' | ForEach-Object { [IO.Path]::GetFullPath($_) }
New-Item -ItemType Directory -Force $work, $out | Out-Null
$sw = [Diagnostics.Stopwatch]::StartNew()

foreach ($t in $Tods) {
  & $Blender --background --factory-startup --python (Join-Path $here 'scenes\golden_hour.py') -- --tod $t --out $work | Where-Object { $_ -match 'LAYER|Error|Traceback' }
  if ($LASTEXITCODE -ne 0) { throw "Blender failed for $t" }
}
& $Python (Join-Path $here 'pixelize.py') --work $work --out $out --tods ($Tods -join ',')
if ($LASTEXITCODE -ne 0) { throw 'pixelize failed' }

if (-not $SkipSprites) {
  & $Blender --background --factory-startup --python (Join-Path $here 'scenes\sprites.py') -- --out $work | Where-Object { $_ -match 'SPRITE|Error|Traceback' }
  if ($LASTEXITCODE -ne 0) { throw 'Blender sprites failed' }
  & $Python (Join-Path $here 'pack_sprites.py') --work $work --out $out
  if ($LASTEXITCODE -ne 0) { throw 'pack_sprites failed' }
  & $Python (Join-Path $here 'preview.py') --assets $out --sprites --tods none
}
& $Python (Join-Path $here 'preview.py') --assets $out --work $work --wide
& $Python (Join-Path $here 'gen_manifest.py')
& $Python (Join-Path $here 'check.py')
if ($LASTEXITCODE -ne 0) { throw 'check.py failed' }
Write-Host ("Blender art rebuilt in {0:n0}s -> {1}" -f $sw.Elapsed.TotalSeconds, $out)

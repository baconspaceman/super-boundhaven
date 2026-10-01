# Regenerate the spike. Absolute paths are required: Blender resolves relative --out against its own cwd.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$raw = Join-Path $root '_raw'
if (Test-Path $raw) { Remove-Item -Recurse -Force $raw }
New-Item -ItemType Directory $raw | Out-Null
& 'C:\Program Files\Blender Foundation\Blender 5.1\blender.exe' --background --factory-startup --python (Join-Path $root 'build_render.py') -- --out $raw --scale 4
& 'C:\Program Files\Python311\python.exe' (Join-Path $root 'pixelize.py') --raw $raw --out (Join-Path $root '..\..\packages\art\assets\blender-characters')

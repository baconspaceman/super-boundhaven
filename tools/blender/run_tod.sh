#!/bin/bash
# dev helper: run_tod.sh <tod> [layers]
D="$(cd "$(dirname "$0")" && pwd)"
"C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" --background --factory-startup --python "$D/scenes/golden_hour.py" -- --tod $1 --out "$D/_work" ${2:+--layers $2} 2>&1 | grep -E "LAYER|Error|Traceback|line " 
"C:/Program Files/Python311/python.exe" "$D/pixelize.py" --work "$D/_work" --out "$D/../../packages/art/assets/blender" --tods $1 ${2:+--layers $2} | tail -1
"C:/Program Files/Python311/python.exe" "$D/preview.py" --assets "$D/../../packages/art/assets/blender" --work "$D/_work" --wide --tods $1

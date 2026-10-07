#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$project_root"
export NO_PROXY="127.0.0.1,localhost,::1${NO_PROXY:+,$NO_PROXY}"
export no_proxy="$NO_PROXY"
score_python="${PYTHON:-python3}"
ffmpeg_binary="${FFMPEG_PATH:-ffmpeg}"
mkdir -p renders
node film/render.mjs --out="$project_root/renders/picture-4k.mp4" "$@"
"$score_python" audio/score.py "$project_root/renders/score-clean.wav"
"$ffmpeg_binary" -y -hide_banner -loglevel warning \
  -i renders/picture-4k.mp4 -i renders/score-clean.wav \
  -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 320k -ar 48000 \
  -shortest -movflags +faststart \
  -metadata title="神经之光 · 光，成了大脑的开关" renders/neural-light-4k.mp4
echo "Written $project_root/renders/neural-light-4k.mp4"

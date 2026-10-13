#!/usr/bin/env bash
# Build the technical demo from a recording in out/demo/raw (see record.mjs):
# timeline -> Remotion render -> procedural music -> mux -> thumbnail.
set -euo pipefail
cd "$(dirname "$0")/../.."
BE=$(ls -d ~/Library/Caches/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell | tail -1)
node src/demo/edit.mjs
cp assets/app/inbox.png out/demo/thumb-app.png
npx remotion render remotion/index.ts Demo out/demo/demo-video.mp4 --public-dir=out/demo --browser-executable="$BE" --concurrency=8 --crf=17 --log=error
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 out/demo/demo-video.mp4)
KICK=$(node -e "const t=require('./remotion/timeline.json');const c=t.segs.find(s=>s.id==='b_create')||t.segs.find(s=>s.type==='chapter');console.log((c.from/t.fps).toFixed(2))")
DROP=$(node -e "const t=require('./remotion/timeline.json');const c=t.segs.find(s=>s.type==='outro');console.log((c.from/t.fps-1.7).toFixed(2))")
node src/music/make.mjs "$(node -e "console.log(Math.ceil($DUR)+1)")" out/demo/music.wav --build=3.4 --kick="$KICK" --drop="$DROP"
FO=$(node -e "console.log(($DUR-3).toFixed(2))")
ffmpeg -y -loglevel error -i out/demo/demo-video.mp4 -i out/demo/music.wav \
  -map 0:v -map 1:a -c:v libx264 -preset slow -crf 18 -vf scale=in_range=pc:out_range=tv,format=yuv420p -color_range tv -profile:v high -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:a aac -b:a 192k -ar 48000 \
  -af "loudnorm=I=-19:TP=-1.5:LRA=11,afade=t=in:d=1.2,afade=t=out:st=$FO:d=3" \
  -t "$DUR" -movflags +faststart monadow-demo.mp4
npx remotion still remotion/index.ts DemoThumb out/demo/thumb-1080.png --public-dir=out/demo --browser-executable="$BE" --log=error
ffmpeg -y -loglevel error -i out/demo/thumb-1080.png -vf scale=1280:720:flags=lanczos thumbnail-demo.png
ffprobe -v error -show_entries format=duration:stream=codec_name,pix_fmt,width,height -of compact monadow-demo.mp4

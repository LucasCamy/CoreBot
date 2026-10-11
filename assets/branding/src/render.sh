#!/usr/bin/env bash
# Renderiza as artes do Uganda Knuckles (PNG) e o vídeo de prévia (MP4).
# Requer: Google Chrome instalado e ffmpeg-static (já em node_modules).
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
OUT="$(dirname "$SRC")"
ROOT="$(cd "$OUT/../.." && pwd)"
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
FFMPEG="$ROOT/node_modules/ffmpeg-static/ffmpeg.exe"
URL="file:///$(cygpath -m "$SRC/art.html" 2>/dev/null || echo "$SRC/art.html")"
TMP="$SRC/.frames"
mkdir -p "$TMP"

shot() { # nome largura altura destino
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$2,$3" --virtual-time-budget=8000 --screenshot="$(cygpath -w "$4" 2>/dev/null || echo "$4")" \
    "$URL?v=$1" >/dev/null 2>&1
  echo "ok  $4"
}

shot banner 1500 600   "$OUT/banner-perfil-1500x600.png"
shot cover  1920 1080  "$OUT/capa-1920x1080.png"
shot thumb  1280 720   "$OUT/thumbnail-video-1280x720.png"
shot avatar 1024 1024  "$OUT/avatar-1024.png"
for s in s1 s2 s3 s4 s5 s6; do shot "$s" 1920 1080 "$TMP/$s.png"; done

[ "${STILLS_ONLY:-0}" = 1 ] && exit 0

# Vídeo: 6 cenas de 3s com zoom suave + transições, e vine boom na abertura/final
D=3; X=0.5
inputs=(); filters=""
for i in 1 2 3 4 5 6; do
  inputs+=(-loop 1 -t $D -framerate 30 -i "$TMP/s$i.png")
  filters+="[$((i-1)):v]scale=2880:1620,zoompan=z='min(1+0.0009*on,1.08)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=$((D*30)):s=1920x1080:fps=30,format=yuv420p[v$i];"
done
filters+="[v1][v2]xfade=transition=slideleft:duration=$X:offset=2.5[a1];"
filters+="[a1][v3]xfade=transition=slideup:duration=$X:offset=5[a2];"
filters+="[a2][v4]xfade=transition=slideleft:duration=$X:offset=7.5[a3];"
filters+="[a3][v5]xfade=transition=circleopen:duration=$X:offset=10[a4];"
filters+="[a4][v6]xfade=transition=fadeblack:duration=$X:offset=12.5[vout];"
filters+="[6:a]adelay=150|150,volume=0.8[b1];[7:a]adelay=13000|13000,volume=0.8[b2];[b1][b2]amix=inputs=2:normalize=0,apad[aout]"

"$FFMPEG" -y -loglevel error "${inputs[@]}" \
  -i "$ROOT/assets/sounds/vine-boom.wav" -i "$ROOT/assets/sounds/vine-boom.wav" \
  -filter_complex "$filters" -map "[vout]" -map "[aout]" -t 15.5 \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k -movflags +faststart \
  "$OUT/previa-video-1920x1080.mp4"
echo "ok  $OUT/previa-video-1920x1080.mp4"

#!/bin/bash
cd "$(dirname "$0")"

PORT=8765
PYTHON=$(which python3 2>/dev/null || which python)
URL="http://localhost:$PORT"

# 이미 떠 있으면 서버를 새로 띄우지 않고 브라우저만 연다
if curl -s -o /dev/null --max-time 1 "$URL"; then
  open "$URL"
  osascript -e 'tell application "Terminal" to close front window' 2>/dev/null &
  exit 0
fi

cd web
nohup "$PYTHON" -m http.server "$PORT" >/dev/null 2>&1 &
disown

sleep 1
open "$URL"

echo "book-radar 실행 중 — $URL"
echo "같은 와이파이의 폰에서 보려면: http://$(ipconfig getifaddr en0 2>/dev/null || echo '맥-IP'):$PORT"
echo "종료하려면 종료.command 를 더블클릭하세요."

osascript -e 'tell application "Terminal" to close front window' 2>/dev/null &

#!/bin/bash
# 개발용 로컬 서버. push 전에 수정 사항을 확인할 때만 쓴다.
# 주의: http://localhost:8765 는 배포 주소와 다른 출처라 설정·서재를 공유하지 않는다.
cd "$(dirname "$0")"

PORT=8765
PYTHON=$(which python3 2>/dev/null || which python)
URL="http://localhost:$PORT"

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

echo "개발 서버 실행 중 — $URL"
echo "종료하려면 종료.command 를 더블클릭하세요."

osascript -e 'tell application "Terminal" to close front window' 2>/dev/null &

#!/bin/bash
cd "$(dirname "$0")"

PORT=8765

# -sTCP:LISTEN 이 없으면 이 포트에 접속 중인 브라우저 PID까지 잡혀 브라우저가 종료된다.
PIDS=$(lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null)

if [ -z "$PIDS" ]; then
  echo "실행 중인 book-radar 서버가 없습니다."
else
  echo "$PIDS" | xargs kill
  echo "book-radar 서버를 종료했습니다."
fi

sleep 1
osascript -e 'tell application "Terminal" to close front window' 2>/dev/null &

#!/bin/bash
# 배포된 앱을 연다. 로컬 서버는 띄우지 않는다.
#
# localStorage 는 출처(origin)별로 분리되므로, 로컬 서버(http://localhost:8765)와
# 배포 주소는 설정·서재를 공유하지 않는다. 저장소를 한 곳으로 모으려고 배포 주소만 쓴다.
# 코드 수정 후 push 전에 확인하려면 개발서버.command 를 쓸 것.

open "https://horengii.github.io/book-radar-/"

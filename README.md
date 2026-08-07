# book-radar

베스트셀러 순위를 보고, 책을 고르면 **살지 말지 판단할 수 있는 형태의 요약**을 보여주고,
재밌게 읽은 책을 기준으로 유사 도서를 추천하는 개인용 도구.

차별점은 순위 조회가 아니라 요약의 형태다. `건너뛰어도 되는 사람`까지 알려줘서 읽지 않아도 될 책을 걸러낸다.

설계 규칙과 구현 태스크는 [CLAUDE.md](CLAUDE.md)에 있다.

---

## 구조

```
web/      정적 프론트엔드 (Vanilla JS, ES Modules, 빌드 스텝 없음)
worker/   Cloudflare Worker 프록시 (알라딘 CORS 우회 + Claude 중계)
tests/    node:test 게이트 테스트
```

## 준비

1. **알라딘 TTB 키** — aladin.co.kr 우측 하단 `제휴안내 > 알라딘 API`
2. **Anthropic API 키 + 크레딧** — console.anthropic.com (2단계 요약 기능에만 필요)
3. **Cloudflare 계정**(무료)
4. **GitHub 저장소** + Pages 활성화

## 프록시 배포

알라딘 Open API는 CORS 헤더를 주지 않아 브라우저에서 직접 호출할 수 없다. 그래서 프록시가 필요하고,
어차피 필요하므로 Claude 호출도 같은 곳을 경유시킨다. **Claude API 키는 프록시에 저장하지 않는다** —
설정 화면에서 입력해 브라우저에 두고 요청마다 헤더로 전달한다(BYOK).

```bash
cd worker
npx wrangler secret put ALADIN_TTB_KEY
npx wrangler deploy
```

배포 전 `worker/wrangler.toml`의 `ALLOWED_ORIGIN`을 실제 Pages 주소로 바꾼다.
로컬에서 붙일 때는 `worker/.dev.vars`에 `ALADIN_TTB_KEY`를 넣고:

```bash
npx wrangler dev --var ALLOWED_ORIGIN:http://localhost:8765
```

## GitHub Pages 배포

저장소 `Settings > Pages`에서 소스를 `main` 브랜치 `/web` 폴더로 지정한다.
배포 후 앱 `설정` 화면에서 Worker 주소와 (2단계부터) Claude API 키를 입력한다.

## 로컬 실행

**`실행.command` 더블클릭.** 서버가 뜨고 브라우저가 열린다. 끌 때는 `종료.command`.

이미 떠 있으면 서버를 새로 띄우지 않고 브라우저만 연다. 터미널 창을 닫아도 서버는 계속 돈다.

같은 와이파이의 폰에서 보려면 실행 시 표시되는 `http://<맥-IP>:8765` 주소로 접속한다.

직접 띄우려면:

```bash
cd web && python3 -m http.server 8765
```

`http://localhost:8765` 접속. ES Modules라 `file://`로 열면 동작하지 않는다.

## 테스트

```bash
node --test "tests/*.test.js"
```

> Node 26부터 `node --test tests/`(디렉터리 인자)는 동작하지 않는다. 위 글로브 형태를 쓸 것.

## 비용 통제

- 요약·태그는 ISBN13 키로 **영구 캐시**. 같은 책을 두 번 열어도 API를 부르지 않는다.
- 순위 20권을 미리 생성하지 않는다. 탭한 책만 그 시점에 생성한다.
- 근거 텍스트가 100자 미만이면 **API를 호출하지 않고** `요약 정보 없음`을 표시한다. (원안은 200자였으나, 알라딘 기본 TTB 키가 짧은 `description`만 주고 `fullDescription`/`Toc`를 안 줘서 100으로 조정 — [config.js](web/js/config.js)의 `MIN_SOURCE_CHARS` 참고)
- 월간 생성 상한(기본 100회)에 도달하면 신규 생성을 중단하고 캐시만 제공한다.
- 추천 결과는 서재 상태 해시로 캐시. 서재가 안 바뀌면 재호출하지 않는다.

## 화면

| 화면 | 하는 일 |
|---|---|
| 순위 | 분야별 베스트셀러 20위. Claude 호출 없음 |
| 검색 | 순위 밖의 책을 제목·저자로 찾아 담거나 요약 확인. Claude 호출 없음 |
| 서재 | 읽음 / 읽는중 / 찜 3단계 관리 |
| 설정 | 프록시 주소, API 키, 월간 상한, 캐시 통계, 내보내기/가져오기 |

책을 탭하면 상세 화면에서 요약 카드가 생성된다 — 탭한 책만, 그 시점에.

## 근거 게이트

AI 생성 결과는 `web/js/gates.js`의 3단 게이트를 통과해야 화면에 들어간다.

| 게이트 | 하는 일 |
|---|---|
| `gate1_canGenerate` | 근거 텍스트 100자 미만이면 API 호출 자체를 하지 않음 |
| `gate2_verifyOutput` | 근거에 없는 숫자·고유명사가 든 필드를 폐기(null) |
| `gate3_verifyExists` | 추천 도서는 알라딘 조회 성공 + 저자 일치 건만 통과 |

게이트 실패는 에러가 아니라 정상 상태다. 재시도하지 않고 해당 필드만 비운다.

## 데이터

localStorage 단일 키(`book-radar/v1`)에 저장한다. 설정 화면에서 JSON 내보내기/가져오기로 기기 간 이동.
저장 공간이 부족하면 오래된 요약 캐시부터 정리하고 한 번 더 시도한다.

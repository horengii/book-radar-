// 정보나루는 KDC(한국십진분류) 로만 거를 수 있다. 알라딘의 '자기계발'은 대응하는 KDC 가
// 없고 '소설'과 '에세이'는 둘 다 KDC 8(문학) 이라 분리되지 않아, 분야를 KDC 기준으로
// 다시 짰다(2026-11-02). 라벨을 바꾸고 싶으면 이 배열만 고치면 된다.
export const CATEGORIES = [
  { id: 'all', label: '전체', kdc: null },
  { id: 'literature', label: '문학', kdc: '8' },
  { id: 'social', label: '사회과학', kdc: '3' },
  { id: 'philosophy', label: '철학', kdc: '1' },
  { id: 'history', label: '역사', kdc: '9' },
  { id: 'science', label: '자연과학', kdc: '4' },
  { id: 'tech', label: '기술과학', kdc: '5' },
  { id: 'art', label: '예술', kdc: '6' },
];

export const LIBRARY_STATUS = [
  { id: 'read', label: '읽음' },
  { id: 'reading', label: '읽는중' },
  { id: 'wish', label: '찜' },
];

export const EXCLUSION_REASONS = [
  { id: 'too_hard', label: '너무 어려움' },
  { id: 'off_topic', label: '주제 안 맞음' },
  { id: 'already_read', label: '이미 읽음' },
];

export const STORAGE_KEY = 'book-radar/v1';
export const SCHEMA_VERSION = 1;
export const RANKING_SIZE = 20;
export const RANKING_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7일(7.1)
// 정보나루 인기대출 조회 기간. 대출 집계는 반영까지 시차가 있어 창을 좁게 잡으면
// 빈 결과가 온다. 실제 지연 폭을 확인하면 줄일 수 있다.
export const RANKING_WINDOW_DAYS = 90;
// Claude 는 프록시를 거치지 않고 브라우저에서 직접 부른다. Cloudflare Worker 에서
// 나가는 요청을 Anthropic 이 403 "Request not allowed" 로 차단하기 때문(2026-08-08 확인).
// 4장이 애초에 허용한 경로이고, 키는 브라우저에만 있으므로 노출도 늘지 않는다.
export const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

export const FETCH_TIMEOUT_MS = 15000;
// 생성 호출은 15초를 넘길 수 있다. 재시도가 금지라 중간에 끊으면 과금만 남는다.
export const CLAUDE_TIMEOUT_MS = 60000;
export const DEFAULT_MONTHLY_LIMIT = 100;

// 게이트 임계값 — 2장 규칙 1. 원안은 200자였으나, 알라딘 기본 TTB 키는
// fullDescription/Toc/Story 확장 필드를 제공하지 않고 짧은 description(대개
// 100~200자)만 준다는 사실이 실사용 중 드러나 100으로 낮췄다(2026-08-07 합의).
export const MIN_SOURCE_CHARS = 100;
export const TITLE_MATCH_THRESHOLD = 0.8;

// 근거 텍스트 전송량 상한 — T2.3.
export const MAX_DESCRIPTION_CHARS = 1200;

// recommend 만 Sonnet 5. 실존 도서를 지식에서 꺼내오는 작업이라 모델 성능이
// gate3 생존율로 직결된다. taste 는 주어진 목록에서 고르기만 하고, summary 는
// 150자 소개글이 천장이라 둘 다 올릴 이유가 없다(2026-08-08 판단).
export const MODELS = {
  summary: 'claude-haiku-4-5-20251001',
  recommend: 'claude-sonnet-5',
  taste: 'claude-sonnet-4-6',
};

export const MAX_TOKENS = { summary: 500, recommend: 600, taste: 400 };

// 태그 4축(7.2). topic만 자유 서술이고 나머지는 고정 어휘여야 축 매칭이 성립한다.
export const TAG_AXES = {
  tone: ['실용매뉴얼', '이론설명', '에세이', '서사', '비평'],
  density: ['가벼움', '보통', '밀도높음'],
  angle: ['경험담', '데이터분석', '이론정리', '인터뷰', '사례모음'],
};


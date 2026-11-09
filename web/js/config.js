// yes24Id 는 예스24 분류 ID 다. 2026-11-09 /v1/category/list 실제 응답(1,361개)의 국내도서
// 대분류에서 골랐고, 8개 모두 20권 · ISBN13 · 페이지 수가 빠짐없이 오는 것을 확인했다.
// loanKdc 는 예스24 가 실패할 때 정보나루 대출 순위로 대신 보여줄 KDC 다. 대응이 깨끗한
// 분야만 둔다 — 'all' 은 분류 없이 전체, null 은 대체하지 않음(자기계발 등은 KDC 대응이 없다).
export const CATEGORIES = [
  { id: 'all', label: '전체', yes24Id: '001', loanKdc: 'all' },
  { id: 'novel', label: '소설', yes24Id: '001001046', loanKdc: '8' },
  { id: 'economy', label: '경제경영', yes24Id: '001001025', loanKdc: null },
  { id: 'self', label: '자기계발', yes24Id: '001001026', loanKdc: null },
  { id: 'humanities', label: '인문', yes24Id: '001001019', loanKdc: '1' },
  { id: 'essay', label: '에세이', yes24Id: '001001047', loanKdc: null },
  { id: 'science', label: '과학', yes24Id: '001001002', loanKdc: '4' },
  { id: 'hobby', label: '건강/취미', yes24Id: '001001011', loanKdc: null },
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
// 정보나루 인기대출 조회 기간(예스24 실패 시 대체 경로 전용). 2026-11-09 실측으로 14일
// 창도 어제까지 집계가 차 있어 시차는 작았다. 응답 시간은 창 길이와 무관하게 11~15초다.
export const RANKING_WINDOW_DAYS = 30;
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


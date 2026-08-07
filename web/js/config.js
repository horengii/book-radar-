// 알라딘 CategoryId. 알라딘 공개 분류표 기준이며, TTB 키 발급 후 실제 응답으로 한 번 확인할 것.
export const CATEGORIES = [
  { id: 'all', label: '전체', cid: 0 },
  { id: 'novel', label: '소설', cid: 1 },
  { id: 'economy', label: '경제경영', cid: 170 },
  { id: 'self', label: '자기계발', cid: 336 },
  { id: 'humanities', label: '인문', cid: 656 },
  { id: 'essay', label: '에세이', cid: 55889 },
  { id: 'science', label: '과학', cid: 987 },
  { id: 'practical', label: '실용', cid: 55890 },
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
export const FETCH_TIMEOUT_MS = 15000;
// 생성 호출은 15초를 넘길 수 있다. 재시도가 금지라 중간에 끊으면 과금만 남는다.
export const CLAUDE_TIMEOUT_MS = 60000;
export const DEFAULT_MONTHLY_LIMIT = 100;

// 게이트 임계값 — 2장 규칙 1.
export const MIN_SOURCE_CHARS = 200;
export const TITLE_MATCH_THRESHOLD = 0.8;

// 근거 텍스트 전송량 상한 — T2.3.
export const MAX_DESCRIPTION_CHARS = 1200;

export const MODELS = {
  summary: 'claude-haiku-4-5-20251001',
  recommend: 'claude-sonnet-4-6',
  taste: 'claude-sonnet-4-6',
};

export const MAX_TOKENS = { summary: 500, recommend: 600, taste: 400 };

// 태그 4축(7.2). topic만 자유 서술이고 나머지는 고정 어휘여야 축 매칭이 성립한다.
export const TAG_AXES = {
  tone: ['실용매뉴얼', '이론설명', '에세이', '서사', '비평'],
  density: ['가벼움', '보통', '밀도높음'],
  angle: ['경험담', '데이터분석', '이론정리', '인터뷰', '사례모음'],
};

export const ALADIN_ITEM_URL = 'https://www.aladin.co.kr/shop/wproduct.aspx?ItemId=';

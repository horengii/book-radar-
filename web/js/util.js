// 순수 함수만. DOM 접근 금지(9장).

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

// 순위 캐시 키에 쓰는 주차. 목요일 기준 ISO 주차라 연말연시에도 키가 겹치지 않는다.
export function weekKey(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function hashString(input) {
  let h = 5381;
  for (let i = 0; i < input.length; i += 1) h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function truncate(text, max) {
  if (typeof text !== 'string') return '';
  return text.length <= max ? text : text.slice(0, max);
}

// HTML 태그가 섞여 올 수 있는 소개글을 근거 텍스트로 쓰기 전 정리한다.
export function stripTags(html) {
  if (typeof html !== 'string') return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// 목차 전체는 길고 대부분 소제목이다. 대제목만 남겨 전송량을 줄인다(T2.3).
export function tocHeadings(toc, max = 12) {
  const lines = stripTags(toc)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const chapters = lines.filter((line) => /^(제?\s*\d+\s*[장부편]|[0-9]+\s*[.)]|[IVX]+\s*[.)]|프롤로그|에필로그|들어가며|나가며)/.test(line));
  return (chapters.length > 0 ? chapters : lines).slice(0, max).join('\n');
}

export function normalizeTitle(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    .replace(/[^0-9a-z가-힣]/g, '');
}

// 제목 비교용 Dice 계수. 부제·판본 표기 차이에 편집거리보다 덜 민감하다.
export function similarity(a, b) {
  const x = normalizeTitle(a);
  const y = normalizeTitle(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;

  const pairs = new Map();
  for (let i = 0; i < x.length - 1; i += 1) {
    const bigram = x.slice(i, i + 2);
    pairs.set(bigram, (pairs.get(bigram) ?? 0) + 1);
  }
  let hits = 0;
  for (let i = 0; i < y.length - 1; i += 1) {
    const bigram = y.slice(i, i + 2);
    const left = pairs.get(bigram) ?? 0;
    if (left > 0) {
      pairs.set(bigram, left - 1);
      hits += 1;
    }
  }
  return (2 * hits) / (x.length - 1 + (y.length - 1));
}

// 저자 필드는 "홍길동, 김철수" 또는 "홍길동 (지은이)" 형태로 온다. 첫 저자만 남긴다.
export function primaryAuthor(author) {
  const first = String(author ?? '').split(',')[0] ?? '';
  return first.replace(/\([^)]*\)/g, '').trim();
}

export function sameAuthor(a, b) {
  const x = primaryAuthor(a).replace(/\s/g, '');
  const y = primaryAuthor(b).replace(/\s/g, '');
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x);
}

// 페이지 기반 추정. API 호출이 아니다(7.2).
export function readingTime(pages) {
  const n = Number(pages);
  if (!Number.isFinite(n) || n <= 0) return null;
  const minutes = Math.round(n * 1.5); // 단행본 한 쪽 1.5분 가정
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `약 ${rest}분`;
  return rest === 0 ? `약 ${hours}시간` : `약 ${hours}시간 ${rest}분`;
}

// 이 앱의 핵심(규칙 1). 게이트 실패는 에러가 아니라 정상 상태다 — 재시도하지 않고 필드를 비운다.
import { MIN_SOURCE_CHARS, TITLE_MATCH_THRESHOLD } from './config.js';
import { primaryAuthor, sameAuthor, similarity } from './util.js';

function normalizeSpace(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

/* gate1 — 근거가 얇으면 API 호출 자체를 하지 않는다 */

export function gate1_canGenerate(description, toc) {
  return normalizeSpace(description).length + normalizeSpace(toc).length >= MIN_SOURCE_CHARS;
}

/* gate2 — 근거에 없는 숫자·고유명사가 있으면 그 필드를 버린다 */

// 자릿수 경계를 지킨다. 원문 "2026"이 요약의 "20"을 정당화하면 안 된다.
function digitRuns(text) {
  return new Set(String(text).replace(/,/g, '').match(/\d+(?:\.\d+)?/g) ?? []);
}

// 고유명사 판정은 휴리스틱이다. 놓치는 쪽보다 버리는 쪽으로 기운다.
const PROPER_NOUN_PATTERNS = [
  /\b[A-Z][A-Za-z][A-Za-z.&-]*\b/g,
  /([가-힣]{2,4})\s?(?:교수|박사|씨|님|대표|회장|사장|기자|작가|저자|의원|장관|감독|선수|소장)/g,
  /[가-힣A-Za-z]{2,10}(?:전자|은행|그룹|대학교|대학|연구소|공단|공사|재단|협회|위원회|증권|보험|카드|자동차|화학|바이오|제약|호텔|항공)/g,
  /[『「《<"']([^』」》>"']{2,30})[』」》>"']/g,
];

function properNouns(text) {
  const found = new Set();
  for (const pattern of PROPER_NOUN_PATTERNS) {
    for (const match of text.matchAll(pattern)) found.add(match[1] ?? match[0]);
  }
  return [...found];
}

function isGrounded(field, source) {
  if (typeof field !== 'string' || !field.trim()) return false;

  const sourceDigits = digitRuns(source);
  for (const number of digitRuns(field)) {
    if (!sourceDigits.has(number)) return false;
  }
  for (const noun of properNouns(field)) {
    if (!source.includes(noun)) return false;
  }
  return true;
}

export function gate2_verifyOutput(field, sourceText) {
  const source = String(sourceText ?? '');
  if (!source.trim()) return null;

  if (Array.isArray(field)) {
    const kept = field.filter((item) => isGrounded(item, source));
    return kept.length > 0 ? kept : null;
  }
  return isGrounded(field, source) ? field : null;
}

/* gate3 — 추천 도서는 공급원에 실제로 있고 저자가 일치해야 한다 */

export async function gate3_verifyExists(candidates, bookClient) {
  const verified = [];

  for (const candidate of candidates ?? []) {
    if (!candidate?.title) continue;

    let results;
    try {
      results = await bookClient.searchBooks(`${candidate.title} ${primaryAuthor(candidate.author)}`.trim());
    } catch {
      continue; // 조회 실패는 "확인되지 않음"이다. 통과시키지 않는다.
    }

    const match = (results ?? []).find(
      (book) =>
        similarity(book.title, candidate.title) >= TITLE_MATCH_THRESHOLD && sameAuthor(book.author, candidate.author),
    );
    if (match) verified.push({ ...match, why: candidate.why ?? null, axes: candidate.axes ?? [] });
  }

  return verified;
}

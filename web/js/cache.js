import { RANKING_TTL_MS } from './config.js';
import { getState, persist } from './state.js';
import { hashString, weekKey } from './util.js';

/* 요약·태그 — ISBN13 키로 영구 캐시(규칙 2). TTL 없음. */

export function getBook(isbn13) {
  return getState().books[isbn13] ?? null;
}

export function putBook(book) {
  if (!book?.isbn13) return false;
  getState().books[book.isbn13] = book;
  return persist();
}

// 순위·검색에서 얻은 서지 정보만 덧씌운다. 이미 만든 요약을 지우지 않기 위해 병합한다.
export function mergeBook(partial) {
  if (!partial?.isbn13) return false;
  const books = getState().books;
  books[partial.isbn13] = { ...(books[partial.isbn13] ?? {}), ...partial };
  return persist();
}

export function hasSummary(isbn13) {
  return Boolean(getBook(isbn13)?.summary);
}

/* 순위 — 분야코드 + 주차 키로 7일 캐시(7.1) */

export function rankingKey(cid, date = new Date()) {
  return `${cid}:${weekKey(date)}`;
}

export function getRanking(cid) {
  const hit = getState().rankings[rankingKey(cid)];
  if (!hit) return null;
  if (Date.now() - new Date(hit.savedAt).getTime() > RANKING_TTL_MS) return null;
  return hit.items;
}

export function putRanking(cid, items) {
  getState().rankings[rankingKey(cid)] = { items, savedAt: new Date().toISOString() };
  return persist();
}

/* 추천 — 서재 상태가 그대로면 다시 부르지 않는다(규칙 2) */

// 제외 목록도 키에 넣는다. "이건 아니었다"를 누른 직후엔 결과가 바뀌어야 하므로.
export function libraryHash(library, exclusions, extra = '') {
  const shelf = [...library]
    .map((x) => `${x.isbn13}:${x.status}`)
    .sort()
    .join('|');
  const skipped = [...exclusions]
    .map((x) => `${x.isbn13}:${x.reason}`)
    .sort()
    .join('|');
  return hashString(`${shelf}#${skipped}#${extra}`);
}

export function getRecs(key) {
  return getState().recs[key] ?? null;
}

export function putRecs(key, payload) {
  getState().recs[key] = { ...payload, savedAt: new Date().toISOString() };
  return persist();
}

export function cacheStats() {
  const state = getState();
  const books = Object.values(state.books);
  return {
    books: books.length,
    summaries: books.filter((b) => b.summary).length,
    rankings: Object.keys(state.rankings).length,
    recs: Object.keys(state.recs).length,
    bytes: JSON.stringify(state).length,
  };
}

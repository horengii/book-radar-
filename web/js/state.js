import { STORAGE_KEY, SCHEMA_VERSION, DEFAULT_MONTHLY_LIMIT } from './config.js';
import { monthKey } from './util.js';

function emptyState() {
  return {
    version: SCHEMA_VERSION,
    settings: { proxyUrl: '', apiKey: '', monthlyLimit: DEFAULT_MONTHLY_LIMIT },
    books: {},
    rankings: {},
    recs: {},
    library: {},
    exclusions: [],
    usage: { month: monthKey(), count: 0, limit: DEFAULT_MONTHLY_LIMIT },
  };
}

function merge(saved) {
  const base = emptyState();
  if (!saved || typeof saved !== 'object') return base;
  return {
    ...base,
    ...saved,
    settings: { ...base.settings, ...(saved.settings ?? {}) },
    usage: { ...base.usage, ...(saved.usage ?? {}) },
    books: saved.books ?? {},
    rankings: saved.rankings ?? {},
    recs: saved.recs ?? {},
    library: saved.library ?? {},
    exclusions: Array.isArray(saved.exclusions) ? saved.exclusions : [],
  };
}

let state = emptyState();
let lastError = null;

export function load() {
  try {
    state = merge(JSON.parse(localStorage.getItem(STORAGE_KEY)));
  } catch {
    state = emptyState(); // 손상된 저장본은 버린다. 복구 시도는 과하다.
  }
  rollUsageMonth();
  return state;
}

export function getState() {
  return state;
}

export function getLastError() {
  return lastError;
}

// 용량 초과 시 오래된 요약 캐시부터 버리고 한 번만 다시 시도한다.
export function persist() {
  lastError = null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    if (evictOldestBooks()) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        return true;
      } catch {
        /* 아래 공통 처리 */
      }
    }
    lastError = '저장 공간이 부족합니다. 설정에서 캐시를 비워 주세요.';
    return false;
  }
}

function evictOldestBooks() {
  const entries = Object.entries(state.books);
  if (entries.length === 0) {
    state.rankings = {};
    return true;
  }
  entries.sort((a, b) => String(a[1].generatedAt ?? '').localeCompare(String(b[1].generatedAt ?? '')));
  for (const [isbn13] of entries.slice(0, Math.ceil(entries.length / 2))) delete state.books[isbn13];
  state.rankings = {};
  return true;
}

export function getSettings() {
  return { ...state.settings };
}

export function saveSettings(patch) {
  state.settings = { ...state.settings, ...patch };
  if (typeof patch.monthlyLimit === 'number') state.usage.limit = patch.monthlyLimit;
  return persist();
}

/* 서재 */

export function getLibrary() {
  return Object.values(state.library);
}

export function getLibraryEntry(isbn13) {
  return state.library[isbn13] ?? null;
}

export function setLibraryStatus(isbn13, status) {
  const existing = state.library[isbn13];
  state.library[isbn13] = {
    isbn13,
    status,
    addedAt: existing?.addedAt ?? new Date().toISOString(),
  };
  return persist();
}

export function removeFromLibrary(isbn13) {
  delete state.library[isbn13];
  return persist();
}

/* 제외 학습 — 부정 신호만 모은다(7.3) */

export function addExclusion(isbn13, reason) {
  state.exclusions = state.exclusions.filter((x) => x.isbn13 !== isbn13);
  state.exclusions.push({ isbn13, reason });
  return persist();
}

export function getExclusions() {
  return [...state.exclusions];
}

/* 사용량 — 월이 바뀌면 자동 리셋 */

function rollUsageMonth() {
  const now = monthKey();
  if (state.usage.month !== now) state.usage = { month: now, count: 0, limit: state.usage.limit };
}

export function getUsage() {
  rollUsageMonth();
  return { ...state.usage };
}

export function isUnderLimit() {
  const usage = getUsage();
  return usage.count < usage.limit;
}

export function bumpUsage() {
  rollUsageMonth();
  state.usage.count += 1;
  return persist();
}

/* 내보내기 / 가져오기 */

export function exportData() {
  return JSON.stringify(state, null, 2);
}

export function importData(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, message: '읽을 수 없는 파일입니다.' };
  }
  if (!parsed || typeof parsed !== 'object' || !parsed.version) {
    return { ok: false, message: 'book-radar 백업 파일이 아닙니다.' };
  }
  state = merge(parsed);
  rollUsageMonth();
  return persist()
    ? { ok: true, message: '가져오기를 완료했습니다.' }
    : { ok: false, message: lastError };
}

export function clearCaches() {
  state.books = {};
  state.rankings = {};
  state.recs = {};
  return persist();
}

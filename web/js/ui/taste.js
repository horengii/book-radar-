import { filterByTaste } from '../claude.js';
import { getBook, getRecs, libraryHash, putRecs } from '../cache.js';
import { getExclusions, getLibrary } from '../state.js';
import { weekKey } from '../util.js';
import { currentCategory, currentItems, setTasteBadges } from './ranking.js';

const button = document.getElementById('taste-btn');
const status = document.getElementById('taste-status');

function tasteProfile() {
  return getLibrary()
    .map((entry) => getBook(entry.isbn13)?.tags)
    .filter(Boolean);
}

function excludedTitles() {
  return getExclusions()
    .map((item) => getBook(item.isbn13)?.title)
    .filter(Boolean);
}

// 주차 + 서재 해시로 캐시한다. 서재가 그대로면 다시 부르지 않는다(규칙 2).
function tasteKey(categoryId) {
  return `taste:${categoryId}:${weekKey()}:${libraryHash(getLibrary(), getExclusions())}`;
}

function show(picks) {
  setTasteBadges(new Map(picks.map((pick) => [pick.isbn13, pick.why ?? '취향 일치'])));
  status.textContent = picks.length > 0 ? `${picks.length}권 표시` : '맞는 책을 찾지 못했습니다.';
}

async function run() {
  const profile = tasteProfile();
  if (profile.length === 0) {
    status.textContent = '서재에 태그가 있는 책이 없습니다.';
    return;
  }

  const candidates = currentItems();
  if (candidates.length === 0) {
    status.textContent = '순위를 먼저 불러와 주세요.';
    return;
  }

  const key = tasteKey(currentCategory().id);
  const cached = getRecs(key);
  if (cached) {
    show(cached.items);
    return;
  }

  status.textContent = '취향 맞춰 보는 중…';
  const result = await filterByTaste(profile, candidates, excludedTitles());
  if (!result.ok) {
    status.textContent = result.reason;
    return;
  }

  // 목록 밖의 책을 지어냈을 경우를 대비해 현재 순위에 있는 ISBN만 남긴다.
  const allowed = new Set(candidates.map((book) => book.isbn13));
  const picks = (result.data?.picks ?? []).filter((pick) => allowed.has(pick.isbn13));
  putRecs(key, { items: picks });
  show(picks);
}

export function init() {
  button.addEventListener('click', run);
}

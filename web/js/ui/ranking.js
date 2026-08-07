import { CATEGORIES } from '../config.js';
import { fetchRanking } from '../aladin.js';
import { getRanking, putRanking } from '../cache.js';
import { bookRow } from './booklist.js';
import { el, clear, notice } from './dom.js';

const chipsRoot = document.getElementById('category-chips');
const listRoot = document.getElementById('ranking-list');

let current = CATEGORIES[0];
let tasteBadges = new Map(); // isbn13 -> 사유 (T3.3에서 채운다)

export function setTasteBadges(map) {
  tasteBadges = map ?? new Map();
  const items = getRanking(current.cid);
  if (items) renderList(items);
}

export function currentCategory() {
  return current;
}

export function currentItems() {
  return getRanking(current.cid) ?? [];
}

function renderChips() {
  clear(chipsRoot);
  for (const category of CATEGORIES) {
    chipsRoot.append(
      el('button', {
        class: 'chip',
        type: 'button',
        text: category.label,
        'aria-pressed': String(category.id === current.id),
        onClick: () => select(category),
      }),
    );
  }
}

function renderList(items) {
  clear(listRoot);
  if (items.length === 0) {
    listRoot.append(notice('순위를 불러오지 못했습니다.'));
    return;
  }
  for (const book of items) {
    const why = tasteBadges.get(book.isbn13);
    listRoot.append(bookRow(book, { rank: book.rank ?? '', badge: why ? `취향 적합 · ${why}` : null }));
  }
}

async function select(category) {
  current = category;
  renderChips();

  const cached = getRanking(category.cid);
  if (cached) {
    renderList(cached);
    return;
  }

  clear(listRoot).append(notice('순위 불러오는 중…'));
  try {
    const items = await fetchRanking(category.cid);
    putRanking(category.cid, items);
    renderList(items);
  } catch (error) {
    clear(listRoot).append(notice(error.message, true));
  }
}

export function refresh() {
  const cached = getRanking(current.cid);
  if (cached) renderList(cached);
}

export function init() {
  renderChips();
  select(current);
}

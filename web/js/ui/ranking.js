import { CATEGORIES } from '../config.js';
import { fetchRanking } from '../books.js';
import { getRanking, putRanking } from '../cache.js';
import { bookRow } from './booklist.js';
import { el, clear, notice } from './dom.js';

const chipsRoot = document.getElementById('category-chips');
const listRoot = document.getElementById('ranking-list');

let current = CATEGORIES[0];
let shown = []; // 대체 경로 결과는 캐시하지 않으므로 화면에 뜬 목록을 따로 들고 있는다
let tasteBadges = new Map(); // isbn13 -> 사유 (T3.3에서 채운다)

// 공급원이 바뀔 때마다 키를 갈아야 이전 공급원의 목록이 7일 캐시에 남지 않는다.
const cacheId = (category) => `yes24:${category.id}`;

// 예스24 약관상 예스24 데이터를 보여주는 화면에는 출처를 표기해야 한다(제6조③4).
const SOURCE_LABEL = {
  yes24: '출처: 예스24 판매 베스트셀러',
  library: '출처: 도서관 정보나루 대출 순위 — 예스24 조회가 안 돼 대신 표시',
};

export function setTasteBadges(map) {
  tasteBadges = map ?? new Map();
  if (shown.length > 0) renderList(shown);
}

export function currentCategory() {
  return current;
}

export function currentItems() {
  return shown;
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
  shown = items;
  clear(listRoot);
  if (items.length === 0) {
    listRoot.append(notice('순위를 불러오지 못했습니다.'));
    return;
  }
  const source = SOURCE_LABEL[items[0].source];
  if (source) listRoot.append(el('li', { class: 'field__hint', text: source }));
  for (const book of items) {
    const why = tasteBadges.get(book.isbn13);
    listRoot.append(bookRow(book, { rank: book.rank ?? '', badge: why ? `취향 적합 · ${why}` : null }));
  }
}

async function select(category) {
  current = category;
  renderChips();

  const cached = getRanking(cacheId(category));
  if (cached) {
    renderList(cached);
    return;
  }

  clear(listRoot).append(notice('순위 불러오는 중…'));
  // 정보나루 대체 경로는 10초 넘게 걸린다. 그사이 다른 칩을 누르면 늦게 온 응답이
  // 지금 칩의 목록을 덮어쓰므로, 응답이 왔을 때 여전히 같은 칩인지 확인한다.
  try {
    const items = await fetchRanking(category);
    // 대체 결과는 캐시하지 않는다 — 예스24 가 돌아오면 바로 판매 순위로 바뀌어야 한다.
    if (items.every((book) => book.source === 'yes24')) putRanking(cacheId(category), items);
    if (current === category) renderList(items);
  } catch (error) {
    if (current === category) clear(listRoot).append(notice(error.message, true));
  }
}

export function refresh() {
  const cached = getRanking(cacheId(current));
  if (cached) renderList(cached);
}

export function init() {
  renderChips();
  select(current);
}

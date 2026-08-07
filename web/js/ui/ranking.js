import { CATEGORIES } from '../config.js';
import { fetchRanking } from '../aladin.js';
import { getRanking, putRanking, mergeBook } from '../cache.js';
import { getLibraryEntry, setLibraryStatus } from '../state.js';
import { primaryAuthor } from '../util.js';
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

function openDetail(book) {
  mergeBook({
    isbn13: book.isbn13,
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    pages: book.pages,
    cover: book.cover,
    itemId: book.itemId,
  });
  window.location.hash = `detail/${book.isbn13}`;
}

function addButton(book) {
  const saved = getLibraryEntry(book.isbn13);
  const button = el('button', {
    class: 'btn btn--slim',
    type: 'button',
    text: saved ? '담김' : '담기',
    disabled: Boolean(saved),
  });
  button.addEventListener('click', (event) => {
    event.stopPropagation();
    mergeBook({
      isbn13: book.isbn13,
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      pages: book.pages,
      cover: book.cover,
    });
    setLibraryStatus(book.isbn13, 'wish');
    button.textContent = '담김';
    button.disabled = true;
  });
  return button;
}

function row(book) {
  const meta = [primaryAuthor(book.author), book.publisher].filter(Boolean).join(' · ');
  const body = el('div', { class: 'list__body' }, [
    el('div', { class: 'list__title', text: book.title }),
    el('div', { class: 'list__meta', text: meta }),
    tasteBadges.has(book.isbn13)
      ? el('span', { class: 'badge badge--taste', text: `취향 적합 · ${tasteBadges.get(book.isbn13)}` })
      : null,
  ]);

  const item = el('li', { class: 'list__item' }, [
    el('span', { class: 'list__rank', text: String(book.rank ?? '') }),
    body,
    addButton(book),
  ]);
  body.addEventListener('click', () => openDetail(book));
  return item;
}

function renderList(items) {
  clear(listRoot);
  if (items.length === 0) {
    listRoot.append(notice('순위를 불러오지 못했습니다.'));
    return;
  }
  for (const book of items) listRoot.append(row(book));
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

import { LIBRARY_STATUS } from '../config.js';
import { getBook } from '../cache.js';
import { getLibrary, removeFromLibrary, setLibraryStatus } from '../state.js';
import { primaryAuthor } from '../util.js';
import { el, clear, notice } from './dom.js';

const filterRoot = document.getElementById('library-filters');
const listRoot = document.getElementById('library-list');

const FILTERS = [{ id: 'all', label: '전체' }, ...LIBRARY_STATUS];
let filter = 'all';

function renderFilters() {
  clear(filterRoot);
  for (const option of FILTERS) {
    filterRoot.append(
      el('button', {
        class: 'chip',
        type: 'button',
        text: option.label,
        'aria-pressed': String(option.id === filter),
        onClick: () => {
          filter = option.id;
          render();
        },
      }),
    );
  }
}

function statusControl(entry) {
  const group = el('div', { class: 'status' });
  for (const status of LIBRARY_STATUS) {
    group.append(
      el('button', {
        class: 'chip chip--slim',
        type: 'button',
        text: status.label,
        'aria-pressed': String(entry.status === status.id),
        onClick: (event) => {
          event.stopPropagation();
          setLibraryStatus(entry.isbn13, status.id);
          render();
        },
      }),
    );
  }
  return group;
}

function row(entry) {
  const book = getBook(entry.isbn13) ?? {};
  const body = el('div', { class: 'list__body' }, [
    el('div', { class: 'list__title', text: book.title || entry.isbn13 }),
    el('div', { class: 'list__meta', text: [primaryAuthor(book.author), book.publisher].filter(Boolean).join(' · ') }),
    statusControl(entry),
  ]);
  body.addEventListener('click', (event) => {
    if (event.target.closest('.status')) return;
    window.location.hash = `detail/${entry.isbn13}`;
  });

  return el('li', { class: 'list__item' }, [
    body,
    el('button', {
      class: 'btn btn--slim',
      type: 'button',
      text: '삭제',
      onClick: (event) => {
        event.stopPropagation();
        removeFromLibrary(entry.isbn13);
        render();
      },
    }),
  ]);
}

export function render() {
  renderFilters();
  clear(listRoot);

  const entries = getLibrary()
    .filter((entry) => filter === 'all' || entry.status === filter)
    .sort((a, b) => String(b.addedAt).localeCompare(String(a.addedAt)));

  if (entries.length === 0) {
    listRoot.append(notice('아직 담은 책이 없습니다. 순위에서 담아 보세요.'));
    return;
  }
  for (const entry of entries) listRoot.append(row(entry));
}

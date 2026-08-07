// 순위와 검색이 같은 행 UI를 쓴다. 담기·상세진입 동작을 한 곳에 모아
// 한쪽만 고치는 실수를 막는다.
import { mergeBook } from '../cache.js';
import { getLibraryEntry, setLibraryStatus } from '../state.js';
import { primaryAuthor } from '../util.js';
import { el } from './dom.js';

// 서지 정보만 추린다. description/toc 같은 큰 필드는 캐시에 남기지 않는다.
function bibliographic(book) {
  return {
    isbn13: book.isbn13,
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    pages: book.pages,
    cover: book.cover,
    itemId: book.itemId,
  };
}

export function openDetail(book) {
  mergeBook(bibliographic(book));
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
    mergeBook(bibliographic(book));
    setLibraryStatus(book.isbn13, 'wish');
    button.textContent = '담김';
    button.disabled = true;
  });
  return button;
}

export function bookRow(book, { rank = null, badge = null } = {}) {
  const meta = [primaryAuthor(book.author), book.publisher].filter(Boolean).join(' · ');
  const body = el('div', { class: 'list__body' }, [
    el('div', { class: 'list__title', text: book.title }),
    el('div', { class: 'list__meta', text: meta }),
    badge ? el('span', { class: 'badge badge--taste', text: badge }) : null,
  ]);

  const item = el('li', { class: 'list__item' }, [
    rank === null ? null : el('span', { class: 'list__rank', text: String(rank) }),
    body,
    addButton(book),
  ]);
  body.addEventListener('click', () => openDetail(book));
  return item;
}

// 순위에 없는 책을 제목·저자로 찾는다. 이 화면에서 Claude 호출은 발생하지 않는다 —
// 요약은 사용자가 책을 탭한 시점에만 생성된다(규칙 2, 지연 생성).
import { searchBooks } from '../aladin.js';
import { bookRow } from './booklist.js';
import { el, clear, notice } from './dom.js';

const SEARCH_SIZE = 20;

const input = document.getElementById('search-input');
const button = document.getElementById('search-btn');
const listRoot = document.getElementById('search-list');

async function run() {
  const query = input.value.trim();
  if (!query) {
    clear(listRoot).append(notice('검색어를 입력해 주세요.'));
    return;
  }

  clear(listRoot).append(notice('검색 중…'));

  let items;
  try {
    items = await searchBooks(query, SEARCH_SIZE);
  } catch (error) {
    clear(listRoot).append(notice(error.message, true));
    return;
  }

  clear(listRoot);
  if (items.length === 0) {
    listRoot.append(notice('검색 결과가 없습니다.'));
    return;
  }
  // ISBN13 이 없는 항목(전자책 일부 등)은 캐시 키를 만들 수 없어 제외한다.
  for (const book of items.filter((b) => b.isbn13)) listRoot.append(bookRow(book));
}

export function init() {
  button.addEventListener('click', run);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') run();
  });
}

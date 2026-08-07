import { EXCLUSION_REASONS } from '../config.js';
import * as aladin from '../aladin.js';
import { recommendSimilar } from '../claude.js';
import { getBook, getRecs, libraryHash, mergeBook, putRecs } from '../cache.js';
import { gate3_verifyExists } from '../gates.js';
import { addExclusion, getExclusions, getLibrary } from '../state.js';
import { primaryAuthor } from '../util.js';
import { el, clear, notice } from './dom.js';

function excludedTitles() {
  return getExclusions()
    .map((item) => getBook(item.isbn13)?.title)
    .filter(Boolean);
}

function recKey(book) {
  return `book:${book.isbn13}:${libraryHash(getLibrary(), getExclusions())}`;
}

// 부정 신호만 모은다. 좋아요 버튼은 만들지 않는다(7.3).
function excludeControls(candidate, onDone) {
  const wrap = el('div', { class: 'status' });
  const ask = el('button', {
    class: 'btn btn--slim',
    type: 'button',
    text: '이건 아니었다',
    onClick: () => {
      clear(wrap);
      for (const reason of EXCLUSION_REASONS) {
        wrap.append(
          el('button', {
            class: 'chip chip--slim',
            type: 'button',
            text: reason.label,
            onClick: () => {
              mergeBook({ isbn13: candidate.isbn13, title: candidate.title, author: candidate.author });
              addExclusion(candidate.isbn13, reason.id);
              onDone();
            },
          }),
        );
      }
    },
  });
  wrap.append(ask);
  return wrap;
}

function candidateCard(candidate, onDone) {
  const axes = el('div', { class: 'tags' });
  for (const axis of candidate.axes ?? []) axes.append(el('span', { class: 'badge badge--axis', text: `${axis} 일치` }));

  return el('div', { class: 'card' }, [
    el('div', { class: 'list__title', text: candidate.title }),
    el('div', { class: 'list__meta', text: primaryAuthor(candidate.author) }),
    candidate.why ? el('p', { class: 'field__hint', text: candidate.why }) : null,
    axes,
    excludeControls(candidate, onDone),
  ]);
}

function paint(container, book, verified) {
  clear(container);
  if (verified.length === 0) {
    container.append(notice('실존이 확인된 추천 도서가 없습니다.'));
    return;
  }
  for (const candidate of verified.slice(0, 3)) {
    container.append(candidateCard(candidate, () => run(container, book, true)));
  }
}

async function run(container, book, force = false) {
  const key = recKey(book);
  if (!force) {
    const hit = getRecs(key);
    if (hit) {
      paint(container, book, hit.items);
      return;
    }
  }

  clear(container).append(notice('비슷한 책 찾는 중…'));
  const result = await recommendSimilar(book, excludedTitles());
  if (!result.ok) {
    clear(container).append(notice(result.reason, true));
    return;
  }

  // gate3 — 알라딘 조회 성공 + 저자 일치 건만 통과시킨다(규칙 1).
  const verified = await gate3_verifyExists(result.data?.candidates ?? [], aladin);
  putRecs(key, { items: verified });
  paint(container, book, verified);
}

export function renderRecommendations(root, book) {
  if (!book?.tags) return; // 태그가 없으면 축 매칭 자체가 불가능하다

  const container = el('div');
  const button = el('button', {
    class: 'btn',
    type: 'button',
    text: '비슷한 책 찾기',
    onClick: () => run(container, book),
  });

  root.append(el('div', { class: 'card__section' }, [button, container]));

  const cached = getRecs(recKey(book));
  if (cached) paint(container, book, cached.items);
}

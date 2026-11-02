import { LIBRARY_STATUS } from '../config.js';
import { fetchDetail } from '../books.js';
import { buildSourceText, generateSummary } from '../claude.js';
import { getBook, mergeBook, putBook } from '../cache.js';
import { gate1_canGenerate, gate2_verifyOutput } from '../gates.js';
import { getLibraryEntry, setLibraryStatus } from '../state.js';
import { primaryAuthor, readingTime } from '../util.js';
import { el, clear, notice } from './dom.js';
import { renderRecommendations } from './recommend.js';

const root = document.getElementById('detail-root');

const EMPTY_SUMMARY = { oneLine: null, keyPoints: null, forWhom: null, notForWhom: null, source: 'none' };

function header(book) {
  const cover = book.cover ? el('img', { class: 'cover', src: book.cover, alt: '' }) : null;
  return el('div', { class: 'card__head' }, [
    cover,
    el('div', {}, [
      el('h2', { class: 'card__title', text: book.title ?? '' }),
      el('div', { class: 'list__meta', text: [primaryAuthor(book.author), book.publisher].filter(Boolean).join(' · ') }),
      el('div', { class: 'list__meta', text: [book.pages ? `${book.pages}쪽` : '', readingTime(book.pages) ?? ''].filter(Boolean).join(' · ') }),
    ]),
  ]);
}

function shelfControls(book) {
  const group = el('div', { class: 'status' });
  for (const status of LIBRARY_STATUS) {
    group.append(
      el('button', {
        class: 'chip chip--slim',
        type: 'button',
        text: status.label,
        'aria-pressed': String(getLibraryEntry(book.isbn13)?.status === status.id),
        onClick: () => {
          setLibraryStatus(book.isbn13, status.id);
          render(book.isbn13);
        },
      }),
    );
  }
  return group;
}

function section(label, node) {
  return el('div', { class: 'card__section' }, [el('p', { class: 'card__label', text: label }), node]);
}

// 게이트를 통과한 필드가 하나도 없으면 근거가 있었다고 말할 수 없다. 여기서 판정하면
// source: 'description' 으로 이미 저장된 캐시 항목도 재호출 없이 함께 교정된다.
function hasGroundedField(summary) {
  return Boolean(summary.oneLine || summary.keyPoints?.length || summary.forWhom || summary.notForWhom);
}

function summaryCard(book) {
  const summary = book.summary ?? EMPTY_SUMMARY;
  const grounded = summary.source === 'description' && hasGroundedField(summary);
  const card = el('div', { class: 'card' }, [
    el('span', { class: 'badge', text: grounded ? '소개글 기반' : '요약 정보 없음' }),
  ]);

  if (summary.oneLine) card.append(el('p', { class: 'summary__line', text: summary.oneLine }));

  if (summary.keyPoints?.length) {
    const list = el('ul', { class: 'keypoints' });
    for (const point of summary.keyPoints) list.append(el('li', { text: point }));
    card.append(section('핵심 주장', list));
  }
  if (summary.forWhom) card.append(section('이런 사람에게 맞음', el('p', { text: summary.forWhom })));
  if (summary.notForWhom) card.append(section('건너뛰어도 되는 사람', el('p', { text: summary.notForWhom })));

  if (book.tags) {
    const tags = el('div', { class: 'tags' });
    for (const value of [book.tags.topic, book.tags.tone, book.tags.density, book.tags.angle]) {
      if (value) tags.append(el('span', { class: 'badge', text: value }));
    }
    card.append(tags);
  }

  if (!grounded && book.link) {
    card.append(
      el('p', { class: 'field__hint' }, [
        el('a', { href: book.link, target: '_blank', rel: 'noopener', text: '책 정보 보기' }),
      ]),
    );
  }
  return card;
}

// 게이트 통과분만 저장한다. 실패 필드는 null 로 남긴다(규칙 1).
function applyGate2(raw, sourceText) {
  const fields = {
    oneLine: gate2_verifyOutput(raw?.oneLine, sourceText),
    keyPoints: gate2_verifyOutput(raw?.keyPoints, sourceText),
    forWhom: gate2_verifyOutput(raw?.forWhom, sourceText),
    notForWhom: gate2_verifyOutput(raw?.notForWhom, sourceText),
  };
  return { ...fields, source: hasGroundedField(fields) ? 'description' : 'none' };
}

function paint(book, extra = null) {
  clear(root);
  root.append(el('div', { class: 'card' }, [header(book), shelfControls(book)]));
  root.append(summaryCard(book));
  if (extra) root.append(extra);
  renderRecommendations(root, book);
}

export async function render(isbn13) {
  if (!isbn13) {
    clear(root).append(notice('책을 찾을 수 없습니다.'));
    return;
  }

  const cached = getBook(isbn13);
  if (cached?.summary) {
    paint(cached); // 캐시 히트 — 어떤 호출도 하지 않는다(규칙 2)
    return;
  }

  clear(root).append(notice(cached ? '' : '불러오는 중…'));
  if (cached) paint(cached, notice('소개글 확인 중…'));

  // 조회가 실패해도 이미 아는 서지정보까지 지우지 않는다. 서재에 담아둔 책은
  // 공급원이 바뀌면서 조회가 안 될 수 있는데, 그때 화면이 통째로 비면 상태 변경도 막힌다.
  const fallback = (message) => {
    const known = getBook(isbn13);
    if (known) paint(known, notice(message, true));
    else clear(root).append(notice(message, true));
  };

  let detail;
  try {
    detail = await fetchDetail(isbn13);
  } catch (error) {
    fallback(error.message);
    return;
  }
  if (!detail) {
    fallback('카카오 책 검색에서 이 책을 찾지 못했습니다.');
    return;
  }

  mergeBook({ ...detail, description: undefined, toc: undefined });
  const book = getBook(isbn13);

  if (!gate1_canGenerate(detail.description, detail.toc)) {
    putBook({ ...book, summary: { ...EMPTY_SUMMARY }, generatedAt: new Date().toISOString() });
    paint(getBook(isbn13));
    return;
  }

  paint(book, notice('요약 생성 중…'));

  const sourceText = buildSourceText(detail.description, detail.toc);
  const result = await generateSummary(book, sourceText);
  if (!result.ok) {
    paint(book, notice(result.reason, true));
    return;
  }

  putBook({
    ...book,
    summary: applyGate2(result.data, sourceText),
    tags: result.data?.tags ?? null,
    generatedAt: new Date().toISOString(),
  });
  paint(getBook(isbn13));
}

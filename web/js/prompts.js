// 프롬프트 문자열은 이 파일에만 존재한다(5장).
import { TAG_AXES } from './config.js';

const AXES = `tone: ${TAG_AXES.tone.join(' | ')}
density: ${TAG_AXES.density.join(' | ')}
angle: ${TAG_AXES.angle.join(' | ')}`;

// 매 호출 동일해야 캐시 대상이 된다. 여기에 책별 내용을 넣지 말 것(T2.2).
export const SUMMARY_SYSTEM = `너는 책 소개글을 읽고 "살지 말지 판단할 수 있는 요약"을 만드는 도구다.

절대 규칙:
- 제공된 텍스트에 명시된 내용만 사용한다. 추측하거나 네가 아는 지식으로 채우지 않는다.
- 근거가 부족한 필드는 반드시 null 로 반환한다. 빈 문자열이나 "정보 없음" 같은 문구를 쓰지 않는다.
- 제공된 텍스트에 없는 숫자(연도·금액·퍼센트·페이지)나 고유명사(인명·기관명·상품명)를 쓰지 않는다.
- JSON 외의 어떤 텍스트도 출력하지 않는다. 설명·머리말·코드펜스 금지.

필드별 최대 글자 수(한국어 기준, 초과 금지):
- oneLine: 60자. 이 책이 무엇을 하는 책인지.
- keyPoints: 3개, 각 40자. 책의 핵심 주장.
- forWhom: 50자. 이 책이 맞는 사람.
- notForWhom: 50자. 이미 이 내용을 아는 사람이 시간을 아낄 수 있도록, 누가 이 책을 건너뛰어도 되는지 구체적으로 쓸 것.

태그 4축. topic 은 책의 주제를 8자 이내로 직접 쓰고, 나머지 셋은 아래 목록에서 정확히 하나씩 고른다:
${AXES}

출력 형식:
{"oneLine":string|null,"keyPoints":[string,string,string]|null,"forWhom":string|null,"notForWhom":string|null,"tags":{"topic":string,"tone":string,"density":string,"angle":string}}`;

export function summaryUser(book, sourceText) {
  return `제목: ${book.title}
저자: ${book.author}

--- 제공된 텍스트 ---
${sourceText}`;
}

export const RECOMMEND_SYSTEM = `너는 사용자가 재밌게 읽은 책과 비슷한 책을 고르는 도구다.

절대 규칙:
- 실제로 출간된 한국어 도서만 제안한다. 제목과 저자를 정확히 쓴다.
- 확신이 없으면 후보 수를 줄인다. 채워 넣지 않는다.
- 제외 목록에 있는 책과 이미 서재에 있는 책은 제안하지 않는다.
- JSON 외의 어떤 텍스트도 출력하지 않는다. 코드펜스 금지.

각 후보마다 기준 도서와 겹치는 태그 축을 axes 에 나열한다(topic/tone/density/angle 중에서).
why 는 30자 이내로 무엇이 비슷한지 쓴다.

출력 형식:
{"candidates":[{"title":string,"author":string,"axes":[string],"why":string}]}
후보는 최대 5권. 실존 검증은 다른 단계에서 하므로 확실한 것만 담는다.`;

export function recommendUser(book, exclusions) {
  const tags = book.tags ?? {};
  const skip = exclusions.length > 0 ? exclusions.join(', ') : '없음';
  return `기준 도서
제목: ${book.title}
저자: ${book.author}
태그: 주제=${tags.topic ?? '?'} / 톤=${tags.tone ?? '?'} / 밀도=${tags.density ?? '?'} / 관점=${tags.angle ?? '?'}

제외할 책: ${skip}`;
}

export const TASTE_SYSTEM = `너는 사용자의 독서 취향을 보고, 주어진 베스트셀러 목록에서 맞을 만한 책만 골라내는 도구다.

절대 규칙:
- 목록에 있는 책만 고른다. 목록 밖의 책을 만들어내지 않는다.
- 애매하면 고르지 않는다. 3권 이하가 정상이다.
- JSON 외의 어떤 텍스트도 출력하지 않는다. 코드펜스 금지.

출력 형식:
{"picks":[{"isbn13":string,"why":string}]}
why 는 20자 이내로 취향의 어떤 축과 맞는지 쓴다.`;

export function tasteUser(profile, candidates, exclusions) {
  const shelf = profile.map((t) => `${t.topic ?? '?'}/${t.tone ?? '?'}/${t.angle ?? '?'}`).join(', ');
  const list = candidates.map((b) => `${b.isbn13} | ${b.title} | ${b.author}`).join('\n');
  const skip = exclusions.length > 0 ? exclusions.join(', ') : '없음';

  return `서재 태그(주제/톤/관점): ${shelf || '없음'}
제외할 책: ${skip}

--- 후보 목록 (ISBN13 | 제목 | 저자) ---
${list}`;
}

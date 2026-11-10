// 공급원마다 다른 모양으로 오는 값을 한 모양으로 맞춘다. 순수 함수만(9장).
import { stripTags } from './util.js';

// isbn 필드는 "ISBN10 ISBN13" 공백 구분이지만 한쪽만 오기도 하고, 굿즈·비도서
// (팬사인회 상품 등)에는 ISBN 아닌 13자리 바코드가 들어온다. 위치로 자르면 안 된다 —
// 978/979 로 시작하는 13자리만 ISBN13 이다.
export function toIsbn13(raw) {
  for (const token of String(raw ?? '').split(/\s+/)) {
    if (/^97[89]\d{10}$/.test(token)) return token;
  }
  return '';
}

// 저자 표기가 공급원마다 다르다. 예스24 "무라카미 하루키 저/홍은주 역",
// 정보나루 "지은이: 한강" · "요한 하리 지음 ;김하현 옮김" · "글: 정문정 ;그림: 피도크".
// 역할 표기를 떼고 쉼표로 이어 카카오("구병모")와 같은 모양으로 맞춘다 —
// primaryAuthor 가 첫 저자만 쓰고, gate3 의 저자 일치 비교도 이 모양을 전제한다.
export function plainAuthors(raw) {
  return String(raw ?? '')
    .split(/[/;]/)
    .map((part) =>
      part
        .trim()
        .replace(/^[^:：]{1,6}[:：]\s*/, '')
        .replace(/\s*(저|글|그림|역|옮김|지음|편|편저|엮음|감수|원작|공저)$/, '')
        .trim(),
    )
    .filter(Boolean)
    .join(', ');
}

// 예스24 목차는 줄 끝에 쪽 번호가 붙어 온다("1장 가호와 모터사이클 남자 007").
// 그대로 근거에 넣으면 gate2 가 요약 속 "119" 같은 숫자를 근거 있는 숫자로 통과시킨다.
export function cleanToc(raw) {
  return stripTags(raw)
    .split(/\r?\n/)
    .map((line) => line.replace(/[\s.·…]+\d{1,4}\s*$/, '').trim())
    .filter(Boolean)
    .join('\n');
}

import { DEFAULT_MONTHLY_LIMIT } from '../config.js';
import { cacheStats } from '../cache.js';
import { clearCaches, exportData, getSettings, getUsage, importData, saveSettings } from '../state.js';
import { el, clear, notice } from './dom.js';

const root = document.getElementById('settings-root');

function field(labelText, input, hint) {
  return el('label', { class: 'field' }, [
    el('span', { class: 'field__label', text: labelText }),
    input,
    hint ? el('p', { class: 'field__hint', text: hint }) : null,
  ]);
}

function download(text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = el('a', { href: url, download: `book-radar-${new Date().toISOString().slice(0, 10)}.json` });
  link.click();
  URL.revokeObjectURL(url);
}

export function render() {
  const settings = getSettings();
  const usage = getUsage();
  const stats = cacheStats();
  const status = el('p', { class: 'field__hint' });

  const proxy = el('input', { type: 'text', value: settings.proxyUrl, placeholder: 'https://book-radar-proxy.<계정>.workers.dev' });
  const key = el('input', { type: 'password', value: settings.apiKey, placeholder: 'sk-ant-...', autocomplete: 'off' });
  const limit = el('input', { type: 'number', value: String(settings.monthlyLimit ?? DEFAULT_MONTHLY_LIMIT), min: '0' });

  const importFile = el('input', { type: 'file', accept: 'application/json' });
  importFile.addEventListener('change', async () => {
    const file = importFile.files?.[0];
    if (!file) return;
    const result = importData(await file.text());
    status.textContent = result.message;
    if (result.ok) render();
  });

  clear(root);
  root.append(
    field('Worker 프록시 주소', proxy),
    field('Claude API 키', key, '이 브라우저에만 저장됩니다. 프록시는 키를 저장하지 않습니다.'),
    field('월간 생성 상한', limit, `이번 달 ${usage.count} / ${usage.limit}회 사용`),
    el('button', {
      class: 'btn',
      type: 'button',
      text: '저장',
      onClick: () => {
        const parsed = Number(limit.value);
        saveSettings({
          proxyUrl: proxy.value.trim(),
          apiKey: key.value.trim(),
          monthlyLimit: Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_MONTHLY_LIMIT,
        });
        status.textContent = '저장했습니다.';
      },
    }),
    status,
    el('div', { class: 'card__section' }, [
      el('p', { class: 'card__label', text: '캐시' }),
      el('p', {
        class: 'field__hint',
        text: `요약 ${stats.summaries}권 · 도서 ${stats.books}권 · 순위 ${stats.rankings}건 · 추천 ${stats.recs}건 · ${Math.round(stats.bytes / 1024)}KB`,
      }),
      el('button', {
        class: 'btn btn--slim',
        type: 'button',
        text: '캐시 비우기',
        onClick: () => {
          clearCaches();
          render();
        },
      }),
    ]),
    el('div', { class: 'card__section' }, [
      el('p', { class: 'card__label', text: '데이터' }),
      el('button', { class: 'btn btn--slim', type: 'button', text: '내보내기', onClick: () => download(exportData()) }),
      el('p', { class: 'field__hint', text: '가져오기 (현재 데이터를 덮어씁니다)' }),
      importFile,
    ]),
  );
}

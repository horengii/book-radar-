// DOM 헬퍼. 텍스트는 항상 textContent 로 넣는다 — innerHTML 경로를 만들지 않는다.

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}

export function clear(node) {
  node.replaceChildren();
  return node;
}

export function notice(message, isError = false) {
  return el('p', { class: isError ? 'notice notice--error' : 'notice', text: message });
}

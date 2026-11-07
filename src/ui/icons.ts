/** Inline SVG icons (stroke = currentColor), sized by CSS. */
const svg = (body: string, cls = 'icon'): string =>
  `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  back: svg('<path d="M15 5l-7 7 7 7" />'),
  pause: svg('<path d="M9 5v14M15 5v14" />'),
  hint: svg(
    '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z" />',
  ),
  undo: svg('<path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />'),
  redo: svg('<path d="m15 14 5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />'),
  lock: svg(
    '<rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />',
  ),
  star: svg(
    '<path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z" />',
    'star',
  ),
} as const;

/** Three stars, the first `earned` filled. */
export function starsHtml(earned: number, cls = 'stars'): string {
  let html = `<span class="${cls}">`;
  for (let i = 0; i < 3; i++) {
    html += `<span class="star-slot${i < earned ? ' earned' : ''}" style="--i:${i}">${ICONS.star}</span>`;
  }
  return `${html}</span>`;
}

/** Inserts the icon named by each `data-icon` attribute. */
export function fillIcons(root: ParentNode = document): void {
  for (const el of root.querySelectorAll<HTMLElement>('[data-icon]')) {
    if (el.querySelector('svg')) continue;
    const name = el.dataset.icon as keyof typeof ICONS;
    el.insertAdjacentHTML('afterbegin', ICONS[name] ?? '');
  }
}

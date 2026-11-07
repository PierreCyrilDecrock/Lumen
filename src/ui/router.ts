/** Screens of the game, mapped to hash URLs so that GitHub Pages needs no rewrite. */
export type Route =
  { name: 'menu' } | { name: 'levels' } | { name: 'settings' } | { name: 'play'; id: string };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#\/?/, '');
  if (path === 'niveaux') return { name: 'levels' };
  if (path === 'reglages') return { name: 'settings' };
  const play = /^niveau\/([\w-]+)$/.exec(path);
  if (play?.[1]) return { name: 'play', id: play[1] };
  return { name: 'menu' };
}

export function toHash(route: Route): string {
  switch (route.name) {
    case 'menu':
      return '#/';
    case 'levels':
      return '#/niveaux';
    case 'settings':
      return '#/reglages';
    case 'play':
      return `#/niveau/${route.id}`;
  }
}

/** Screen that the in-game back button leads to. */
export function parentOf(route: Route): Route | null {
  if (route.name === 'play') return { name: 'levels' };
  if (route.name === 'levels' || route.name === 'settings') return { name: 'menu' };
  return null;
}

export function sameRoute(a: Route | undefined, b: Route | null): boolean {
  return !!a && !!b && toHash(a) === toHash(b);
}

interface HistoryState {
  lumenIndex: number;
}

/**
 * Navigation without reloads: each screen change pushes a history entry, so the
 * browser back button walks back through the game's screens.
 */
export class Router {
  private index = 0;
  private readonly stack: Route[] = [];
  private currentRoute: Route = { name: 'menu' };

  constructor(private readonly onRoute: (route: Route) => void) {}

  get current(): Route {
    return this.currentRoute;
  }

  start(): void {
    const state = history.state as HistoryState | null;
    this.index = typeof state?.lumenIndex === 'number' ? state.lumenIndex : 0;
    this.currentRoute = parseHash(location.hash);
    this.stack[this.index] = this.currentRoute;
    history.replaceState(
      { lumenIndex: this.index } satisfies HistoryState,
      '',
      toHash(this.currentRoute),
    );
    window.addEventListener('popstate', (e) => {
      const s = e.state as HistoryState | null;
      this.index = typeof s?.lumenIndex === 'number' ? s.lumenIndex : 0;
      this.currentRoute = parseHash(location.hash);
      this.stack[this.index] = this.currentRoute;
      this.onRoute(this.currentRoute);
    });
    this.onRoute(this.currentRoute);
  }

  go(route: Route, replace = false): void {
    if (!replace) this.index++;
    this.stack[this.index] = route;
    this.stack.length = this.index + 1;
    this.currentRoute = route;
    const state: HistoryState = { lumenIndex: this.index };
    if (replace) history.replaceState(state, '', toHash(route));
    else history.pushState(state, '', toHash(route));
    this.onRoute(route);
  }

  /** In-game back: a real history step when the parent is just behind us. */
  back(): void {
    const parent = parentOf(this.currentRoute);
    if (!parent) return;
    if (this.index > 0 && sameRoute(this.stack[this.index - 1], parent)) history.back();
    else this.go(parent, true);
  }
}

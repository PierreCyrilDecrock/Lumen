import type { GameView } from '../game-view';
import { CHAPTER_TITLES, LEVELS, findLevel, levelIndex, nextLevel } from '../levels';
import { MECHANICS } from '../levels/schema';
import { isCompleted, recordResult, writeSave, type SaveData } from '../storage';
import { bindHistoryButtons, type Hud } from './hud';
import { ICONS, fillIcons, starsHtml } from './icons';
import { Router, type Route } from './router';

function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Élément ${selector} introuvable`);
  return el;
}

const FOCUSABLE = 'button:not([disabled]), [href], input, [tabindex]:not([tabindex="-1"])';

/** Menus, level grid, in-game HUD and overlays; drives the GameView. */
export class GameUi {
  readonly router: Router;
  private readonly hud: Hud;
  private readonly screens: Record<Route['name'], HTMLElement>;
  private readonly pause = $('#pause');
  private readonly victory = $('#victory');
  private overlay: HTMLElement | null = null;
  private overlayReturnFocus: HTMLElement | null = null;

  constructor(
    private readonly game: GameView,
    private readonly save: SaveData,
  ) {
    this.screens = {
      menu: $('#screen-menu'),
      levels: $('#screen-levels'),
      play: $('#screen-play'),
    };
    this.router = new Router((route) => this.show(route));
    this.hud = bindHistoryButtons(() => game.interaction);
    fillIcons();

    $('#menu-play').addEventListener('click', () => this.playNext());
    $('#menu-levels').addEventListener('click', () => this.router.go({ name: 'levels' }));
    for (const el of document.querySelectorAll<HTMLElement>('[data-back]')) {
      el.addEventListener('click', () => this.router.back());
    }
    $('#play-pause').addEventListener('click', () => this.openPause());
    $('#play-hint').addEventListener('click', () => this.hint());
    $('#pause-resume').addEventListener('click', () => this.closeOverlay());
    $('#pause-restart').addEventListener('click', () => {
      this.closeOverlay();
      this.game.restart();
    });
    $('#pause-levels').addEventListener('click', () => this.router.back());
    $('#pause-menu').addEventListener('click', () => this.router.go({ name: 'menu' }));
    $('#victory-replay').addEventListener('click', () => {
      this.closeOverlay();
      this.game.restart();
    });
    $('#victory-levels').addEventListener('click', () => this.router.back());
    $('#victory-next').addEventListener('click', () => {
      const next = this.game.definition && nextLevel(this.game.definition.id);
      if (next) this.router.go({ name: 'play', id: next.id }, true);
    });
    document.addEventListener('keydown', (e) => this.trapFocus(e));
  }

  start(): void {
    this.router.start();
  }

  isUnlocked(index: number): boolean {
    const previous = LEVELS[index - 1];
    return index === 0 || (!!previous && isCompleted(this.save, previous.id));
  }

  /** Called by the game whenever its state changes. */
  refreshHud(): void {
    const game = this.game;
    $('#play-rotations').textContent = String(game.rotations);
    const stars = $('#play-stars');
    stars.innerHTML = starsHtml(game.stars, 'stars stars-small');
    stars.setAttribute(
      'aria-label',
      `${game.stars} étoile${game.stars > 1 ? 's' : ''} possible${game.stars > 1 ? 's' : ''}`,
    );
    $<HTMLButtonElement>('#play-hint').disabled = game.won;
    this.hud.refresh();
  }

  /** Opens the pause overlay (Escape key or pause button). */
  openPause(): void {
    if (this.router.current.name !== 'play' || this.overlay || this.game.won) return;
    this.openOverlay(this.pause);
  }

  hint(): void {
    const kind = this.game.showHint();
    $('#play-message').textContent =
      kind === 'move'
        ? 'Indice : déplacez le miroir surligné.'
        : kind === 'rotate'
          ? 'Indice : tournez le miroir surligné.'
          : '';
  }

  /** Called by the game once every target is lit. */
  onWin(): void {
    const def = this.game.definition;
    if (!def) return;
    const stars = this.game.stars;
    recordResult(this.save, def.id, stars, this.game.rotations);
    writeSave(this.save);
    const rotations = this.game.rotations;
    $('#victory-stars').innerHTML = starsHtml(stars, 'stars stars-large');
    $('#victory-stars').setAttribute('aria-label', `${stars} étoile${stars > 1 ? 's' : ''} sur 3`);
    $('#victory-detail').textContent =
      `${def.title} : ${rotations} rotation${rotations > 1 ? 's' : ''}.`;
    $('#victory-next').hidden = !nextLevel(def.id);
    this.refreshHud();
    this.openOverlay(this.victory);
  }

  private show(route: Route): void {
    if (route.name === 'play') {
      const def = findLevel(route.id);
      const index = def ? levelIndex(def.id) : -1;
      if (!def || !this.isUnlocked(index)) {
        this.router.go({ name: 'levels' }, true);
        return;
      }
    }
    this.closeOverlay(false);
    for (const [name, el] of Object.entries(this.screens)) el.hidden = name !== route.name;

    if (route.name === 'play') {
      const def = findLevel(route.id)!;
      $('#play-title').textContent = def.title;
      $('#play-message').textContent = '';
      this.save.lastLevel = def.id;
      writeSave(this.save);
      this.game.load(def);
      this.game.setLocked(false);
      this.game.start();
      return;
    }
    this.game.stop();
    if (route.name === 'levels') this.renderLevels();
    this.screens[route.name].querySelector<HTMLElement>('h1, h2')?.focus();
  }

  private playNext(): void {
    const index = LEVELS.findIndex((l, i) => this.isUnlocked(i) && !isCompleted(this.save, l.id));
    const fallback = this.save.lastLevel ?? LEVELS[0]?.id;
    const id = index >= 0 ? LEVELS[index]!.id : fallback;
    if (id) this.router.go({ name: 'play', id });
  }

  private renderLevels(): void {
    const container = $('#level-chapters');
    let html = '';
    let number = 0;
    for (const mechanic of MECHANICS) {
      const levels = LEVELS.filter((l) => l.mechanic === mechanic);
      if (levels.length === 0) continue;
      html += `<section class="chapter"><h2>${CHAPTER_TITLES[mechanic]}</h2><ol class="level-grid">`;
      for (const level of levels) {
        number++;
        const index = levelIndex(level.id);
        const unlocked = this.isUnlocked(index);
        const stars = this.save.levels[level.id]?.stars ?? 0;
        const label = unlocked
          ? `Niveau ${number}, ${level.title}, ${stars} étoile${stars > 1 ? 's' : ''}`
          : `Niveau ${number}, verrouillé`;
        html += `<li><button class="level-tile" data-level="${level.id}" ${unlocked ? '' : 'disabled'} aria-label="${label}">
          <span class="level-number">${unlocked ? number : ICONS.lock}</span>
          <span class="level-name">${unlocked ? level.title : 'Verrouillé'}</span>
          ${starsHtml(stars, 'stars stars-small')}
        </button></li>`;
      }
      html += '</ol></section>';
    }
    container.innerHTML = html;
    for (const button of container.querySelectorAll<HTMLButtonElement>('[data-level]')) {
      button.addEventListener('click', () => {
        const id = button.dataset.level;
        if (id) this.router.go({ name: 'play', id });
      });
    }
  }

  private openOverlay(overlay: HTMLElement): void {
    if (this.overlay && this.overlay !== overlay) this.closeOverlay(false);
    this.overlayReturnFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.overlay = overlay;
    overlay.hidden = false;
    this.game.setLocked(true);
    this.hud.refresh();
    overlay.querySelector<HTMLElement>('.button-primary:not([hidden])')?.focus();
  }

  private closeOverlay(restoreFocus = true): void {
    const overlay = this.overlay;
    if (!overlay) return;
    overlay.hidden = true;
    this.overlay = null;
    this.game.setLocked(false);
    this.hud.refresh();
    if (restoreFocus) this.overlayReturnFocus?.focus();
  }

  /** Keeps Tab inside the open overlay; Escape closes the pause. */
  private trapFocus(e: KeyboardEvent): void {
    const overlay = this.overlay;
    if (!overlay) return;
    if (e.key === 'Escape' && overlay === this.pause) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.closeOverlay();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...overlay.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => !el.hidden);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
}

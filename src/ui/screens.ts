import { COLOR_HEX, COLOR_LABELS, MATERIALS, type Material } from '../engine';
import type { GameView } from '../game-view';
import { isMedium, isMovable, ringRadius, rotationPeriod } from '../game/interaction';
import { TUTORIALS, Tutorial } from '../game/tutorial';
import { displayAngle } from '../game/snap';
import { CHAPTER_TITLES, LEVELS, findLevel, levelIndex, nextLevel } from '../levels';
import { MECHANICS } from '../levels/schema';
import { isCompleted, recordResult, writeSave, type SaveData } from '../storage';
import { bindHistoryButtons, type Hud } from './hud';
import { ICONS, fillIcons, starsHtml } from './icons';
import { Router, type Route } from './router';
import { SettingsScreen } from './settings';
import type { Sound } from '../game/audio';
import { COLOR_GLYPHS } from '../render/symbols';
import { boxClearOfBeams } from '../render/selection';
import type { Settings } from '../game/settings';

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

  private readonly settingsScreen: SettingsScreen;
  private readonly settings: Settings;

  constructor(
    private readonly game: GameView,
    private readonly save: SaveData,
    settings: Settings,
    private readonly sound: Sound,
  ) {
    this.settings = settings;
    this.screens = {
      menu: $('#screen-menu'),
      levels: $('#screen-levels'),
      settings: $('#screen-settings'),
      play: $('#screen-play'),
    };
    this.settingsScreen = new SettingsScreen(settings, save, sound, () => this.refreshSound());
    this.router = new Router((route) => this.show(route));
    this.hud = bindHistoryButtons(() => game.interaction);
    fillIcons();

    $('#menu-play').addEventListener('click', () => this.playNext());
    $('#menu-levels').addEventListener('click', () => this.router.go({ name: 'levels' }));
    $('#menu-settings').addEventListener('click', () => this.router.go({ name: 'settings' }));
    for (const el of document.querySelectorAll<HTMLElement>('[data-back]')) {
      el.addEventListener('click', () => this.router.back());
    }
    $('#play-pause').addEventListener('click', () => this.openPause());
    $('#play-sound').addEventListener('click', () =>
      this.settingsScreen.setSound(!this.sound.enabled),
    );
    this.refreshSound();
    $('#play-hint').addEventListener('click', () => this.hint());
    $('#play-store').addEventListener('click', () =>
      this.game.interaction?.storeSelected(this.game.time),
    );
    const frost = $<HTMLInputElement>('#play-frost-input');
    const onFrost = (commit: boolean): void => {
      const interaction = this.game.interaction;
      const index = interaction?.adjustableDiffuser() ?? -1;
      if (!interaction || index < 0) return;
      interaction.setSpread(index, Number(frost.value), this.game.time, commit);
      $('#play-frost-value').textContent = `${frost.value}°`;
    };
    frost.addEventListener('input', () => onFrost(false));
    frost.addEventListener('change', () => onFrost(true));
    $('#tray').addEventListener('click', (e) => {
      const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-material]');
      const material = button?.dataset.material as Material | undefined;
      if (material) this.game.interaction?.placeFromTray(material, this.game.time);
    });
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
    const selected = game.interaction?.selectedPiece;
    $('#play-store').hidden = !(selected && isMedium(selected) && selected.trayable === true);
    this.announceSelection();
    this.updateTutorial();
    this.renderTray();
    this.refreshFrost();
    this.refreshOptics();
    this.hud.refresh();
  }

  /** Per-trace readouts: entry / exit angles, crystals lit. */
  refreshOptics(): void {
    const el = $('#play-optics');
    const text = this.game.opticsSummary();
    el.hidden = text === '';
    if (el.textContent !== text) el.textContent = text;

    this.refreshColors();
    const total = this.game.level?.crystals?.length ?? 0;
    $('#play-crystals').hidden = total === 0;
    if (total > 0) {
      setText($('#play-crystals-lit'), String(this.game.trace.crystalsLit));
      setText($('#play-crystals-total'), String(total));
    }
  }

  /** Colours captured by each colour target: needed colour, received colour, lit. */
  private refreshColors(): void {
    const bar = $('#play-colors');
    const targets = this.game.level?.colorTargets ?? [];
    bar.hidden = targets.length === 0;
    if (targets.length === 0) return;
    const trace = this.game.trace;
    let html = '';
    targets.forEach((t, i) => {
      const r = trace.colorLight[i * 3] ?? 0;
      const g = trace.colorLight[i * 3 + 1] ?? 0;
      const b = trace.colorLight[i * 3 + 2] ?? 0;
      const max = Math.max(r, g, b);
      const received =
        max > 0
          ? `rgb(${Math.round((r / max) * 255)}, ${Math.round((g / max) * 255)}, ${Math.round((b / max) * 255)})`
          : 'transparent';
      const lit = trace.colorTargetsLit[i] === true;
      const name = COLOR_LABELS[t.color];
      const state = lit ? 'allumée' : max > 0 ? 'reçoit une autre couleur' : 'éteinte';
      html += `<span class="color-chip${lit ? ' lit' : ''}" role="listitem" aria-label="Cible ${name} : ${state}">
        <span class="color-dot" style="background:${COLOR_HEX[t.color]}"></span>${this.settings.colorSymbols ? `<span class="color-glyph" aria-hidden="true">${COLOR_GLYPHS[t.color]}</span>` : ''}${name}
        <span class="color-arrow" aria-hidden="true">←</span>
        <span class="color-dot received" style="background:${received}"></span>${lit ? '<span class="color-ok" aria-hidden="true">✓</span>' : ''}</span>`;
    });
    if (bar.dataset.html !== html) {
      bar.dataset.html = html;
      bar.innerHTML = html;
    }
  }

  /** « Dépoli du verre » slider, for levels with an adjustable diffuser. */
  private refreshFrost(): void {
    const interaction = this.game.interaction;
    const index = interaction?.adjustableDiffuser() ?? -1;
    const piece = interaction?.piece(index);
    const row = $('#play-frost');
    row.hidden = !piece || !('spread' in piece);
    if (!piece || !('spread' in piece)) return;
    const input = $<HTMLInputElement>('#play-frost-input');
    if (document.activeElement !== input) input.value = String(piece.spread);
    input.disabled = interaction?.locked === true;
    setText($('#play-frost-value'), `${piece.spread}°`);
  }

  /** One button per material that the level keeps in its tray. */
  private renderTray(): void {
    const tray = $('#tray');
    const media = this.game.level?.media ?? [];
    const materials = (Object.keys(MATERIALS) as Material[]).filter((m) =>
      media.some((block) => block.trayable === true && block.material === m),
    );
    tray.hidden = materials.length === 0;
    if (tray.hidden) return;
    const counts = this.game.interaction?.trayCounts() ?? {};
    const locked = this.game.interaction?.locked === true;
    tray.innerHTML = materials
      .map((m) => {
        const count = counts[m] ?? 0;
        const name = MATERIALS[m].name;
        return `<button class="tray-item tray-${m}" type="button" data-material="${m}" ${count === 0 || locked ? 'disabled' : ''} aria-label="Poser un bloc : ${name}, ${count} restant${count > 1 ? 's' : ''}">
          <span class="tray-swatch" aria-hidden="true"></span>${name}<span class="tray-count">×${count}</span></button>`;
      })
      .join('');
  }

  private lastAnnounced = '';

  /** Screen reader message for the selected piece (type, angle, movable). */
  private announceSelection(): void {
    const p = this.game.interaction?.selectedPiece;
    let text = '';
    if (p) {
      const kind = isMedium(p)
        ? `Bloc ${MATERIALS[p.material].name.toLowerCase()}`
        : 'spread' in p
          ? 'Verre dépoli'
          : 'size' in p
            ? 'Prisme'
            : 'bands' in p
              ? 'Filtre'
              : 'Miroir';
      const angle = displayAngle(p.angle, rotationPeriod(p));
      text = `${kind} sélectionné, ${angle}°${isMovable(p) ? ', déplaçable' : ''}.`;
    }
    if (text !== this.lastAnnounced) {
      this.lastAnnounced = text;
      if (text) $('#play-message').textContent = text;
    }
  }

  private tutorial: Tutorial | null = null;
  private tutorialFrame = 0;

  /** Starts the tutorial bubbles of a level, if it has some. */
  private startTutorial(levelId: string): void {
    const steps = TUTORIALS[levelId];
    this.tutorial = steps ? new Tutorial(steps) : null;
    this.updateTutorial();
  }

  /** Advances the tutorial and places its bubble next to the piece it is about. */
  private updateTutorial(): void {
    const bubble = $('#tutorial');
    const game = this.game;
    const interaction = game.interaction;
    const tutorial = this.tutorial;
    if (tutorial && interaction) {
      tutorial.update(interaction.selectedPiece?.id ?? null, game.rotations);
    }
    const step = tutorial?.current;
    const piece = step && interaction ? interaction.piece(interaction.indexOf(step.piece)) : null;
    const visible = !!step && !!piece && !game.won && this.router.current.name === 'play';
    bubble.hidden = !visible;
    cancelAnimationFrame(this.tutorialFrame);
    if (!visible || !step || !piece) return;
    setText($('#tutorial-text'), step.text);
    bubble.dataset.gesture = step.gesture;
    const place = (): void => {
      const v = game.gc.viewport;
      const level = game.level;
      let x = piece.x;
      let y = piece.y;
      let preferBelow = false;
      if (step.anchor === 'handle') {
        const a = (piece.angle * Math.PI) / 180;
        x += Math.cos(a) * ringRadius(piece);
        y += Math.sin(a) * ringRadius(piece);
        preferBelow = Math.sin(a) > 0.2;
      }
      // Bubble size in board units; keep it off the beams (golden rule).
      const w = bubble.offsetWidth / v.scale;
      const h = bubble.offsetHeight / v.scale;
      const gap = 22 / v.scale + h / 2;
      const reach = step.anchor === 'handle' ? 14 : ringRadius(piece);
      const options = preferBelow ? [1, -1] : [-1, 1];
      let side = options[0]!;
      let cx = x;
      for (const candidate of options) {
        const cy = y + candidate * (gap + reach * 0.4);
        const clampedX = Math.min(Math.max(x, w / 2 + 2), (level?.width ?? 390) - w / 2 - 2);
        const clear = boxClearOfBeams(
          clampedX,
          cy,
          w,
          h,
          game.trace.segments,
          level?.width ?? 390,
          level?.height ?? 560,
        );
        if (clear) {
          side = candidate;
          cx = clampedX;
          break;
        }
        cx = clampedX;
      }
      const below = side > 0;
      const offset = reach * 0.4 * v.scale;
      const cssX = v.offsetX + cx * v.scale;
      const cssY = v.offsetY + y * v.scale;
      const arrowShift = (x - cx) * v.scale;
      bubble.style.setProperty('--arrow-x', `${arrowShift.toFixed(1)}px`);
      bubble.style.transform = `translate(${cssX.toFixed(1)}px, ${cssY.toFixed(1)}px) translate(-50%, ${below ? `${(22 + offset).toFixed(1)}px` : `calc(-100% - ${(22 + offset).toFixed(1)}px)`})`;
      bubble.classList.toggle('below', below);
      this.tutorialFrame = requestAnimationFrame(place);
    };
    place();
  }

  /** Sound button: icon and pressed state follow the setting. */
  private refreshSound(): void {
    const button = $('#play-sound');
    button.setAttribute('aria-pressed', String(this.sound.enabled));
    button.setAttribute('aria-label', this.sound.enabled ? 'Couper le son' : 'Activer le son');
    button.innerHTML = this.sound.enabled ? ICONS.sound : ICONS.mute;
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
        ? 'Indice : déplacez la pièce surlignée.'
        : kind === 'rotate'
          ? 'Indice : tournez la pièce surlignée.'
          : kind === 'place'
            ? 'Indice : posez un bloc depuis le bac.'
            : kind === 'adjust'
              ? 'Indice : réglez le dépoli du verre.'
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
      this.settingsScreen.hide();
      const def = findLevel(route.id)!;
      $('#play-title').textContent = def.title;
      $('#play-message').textContent = '';
      this.save.lastLevel = def.id;
      writeSave(this.save);
      this.game.load(def);
      this.game.setLocked(false);
      this.game.start();
      this.startTutorial(def.id);
      return;
    }
    this.game.stop();
    this.tutorial = null;
    this.updateTutorial();
    if (route.name === 'levels') this.renderLevels();
    if (route.name === 'settings') this.settingsScreen.show();
    else this.settingsScreen.hide();
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

function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

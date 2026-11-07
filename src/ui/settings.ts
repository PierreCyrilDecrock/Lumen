import {
  applyPreset,
  clamp01,
  currentPreset,
  systemPrefersReducedMotion,
  type PresetName,
  type Settings,
} from '../game/settings';
import { writeSave, type SaveData } from '../storage';
import { SettingsPreview } from './preview';

function $<T extends HTMLElement = HTMLElement>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Élément ${selector} introuvable`);
  return el;
}

/**
 * Settings screen: beam and impact sliders (0-100), « Réduire les animations »,
 * presets and a live preview. Changes apply at once (the renderer reads the
 * settings every frame) and are saved when a control is released.
 */
export class SettingsScreen {
  private readonly preview: SettingsPreview;
  private readonly beam = $<HTMLInputElement>('#set-beam');
  private readonly impact = $<HTMLInputElement>('#set-impact');
  private readonly motion = $<HTMLInputElement>('#set-motion');

  constructor(
    private readonly settings: Settings,
    private readonly save: SaveData,
  ) {
    this.preview = new SettingsPreview($<HTMLCanvasElement>('#settings-preview'), settings);
    const onSlider = (input: HTMLInputElement, key: 'beamIntensity' | 'impactIntensity') => {
      input.addEventListener('input', () => {
        settings[key] = clamp01(Number(input.value) / 100);
        this.refresh();
      });
      input.addEventListener('change', () => this.persist());
    };
    onSlider(this.beam, 'beamIntensity');
    onSlider(this.impact, 'impactIntensity');
    this.motion.addEventListener('change', () => {
      settings.reducedMotion = this.motion.checked;
      // Back to "follow the system" when the choice matches it.
      this.save.settings.reducedMotion =
        this.motion.checked === systemPrefersReducedMotion() ? null : this.motion.checked;
      this.persist();
    });
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
      button.addEventListener('click', () => {
        applyPreset(settings, button.dataset.preset as PresetName);
        this.refresh();
        this.persist();
      });
    }
  }

  show(): void {
    this.refresh();
    this.preview.start();
  }

  hide(): void {
    this.preview.stop();
  }

  private refresh(): void {
    const s = this.settings;
    const beam = Math.round(s.beamIntensity * 100);
    const impact = Math.round(s.impactIntensity * 100);
    if (document.activeElement !== this.beam) this.beam.value = String(beam);
    if (document.activeElement !== this.impact) this.impact.value = String(impact);
    $('#set-beam-value').textContent = `${beam} %`;
    $('#set-impact-value').textContent = `${impact} %`;
    this.motion.checked = s.reducedMotion;
    const preset = currentPreset(s);
    for (const button of document.querySelectorAll<HTMLButtonElement>('[data-preset]')) {
      button.setAttribute('aria-pressed', String(button.dataset.preset === preset));
    }
  }

  private persist(): void {
    this.save.settings.beamIntensity = this.settings.beamIntensity;
    this.save.settings.impactIntensity = this.settings.impactIntensity;
    writeSave(this.save);
  }
}

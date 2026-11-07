import { expect, test, type Page } from '@playwright/test';

/** Converts board coordinates (390 × 560) to page pixels. */
async function boardToPage(page: Page) {
  const box = await page.locator('#game').boundingBox();
  if (!box) throw new Error('Plateau introuvable');
  const scale = Math.min(box.width / 390, box.height / 560);
  const ox = box.x + (box.width - 390 * scale) / 2;
  const oy = box.y + (box.height - 560 * scale) / 2;
  return (x: number, y: number): [number, number] => [ox + x * scale, oy + y * scale];
}

/** Drags with the mouse along an arc around (cx, cy), from angle a0 to a1 (degrees). */
async function dragArc(
  page: Page,
  at: (x: number, y: number) => [number, number],
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
) {
  const point = (a: number) =>
    at(cx + r * Math.cos((a * Math.PI) / 180), cy + r * Math.sin((a * Math.PI) / 180));
  await page.mouse.move(...point(a0));
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(...point(a0 + ((a1 - a0) * i) / 12));
  await page.mouse.up();
}

test.beforeEach(({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  (page as Page & { errors: string[] }).errors = errors;
});

test('le jeu se charge sans erreur et sans défilement horizontal', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.menu-title')).toHaveText('Lumen');
  await expect(page.locator('#menu-play')).toBeVisible();
  await expect(page.locator('#menu-levels')).toBeVisible();
  await expect(page.locator('#menu-settings')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  expect((page as Page & { errors: string[] }).errors).toEqual([]);
});

test('le niveau 1 se résout à la souris et la progression survit au rechargement', async ({
  page,
}) => {
  await page.goto('./');
  await page.locator('#menu-play').click();
  await expect(page.locator('#play-title')).toHaveText('Premier reflet');
  const at = await boardToPage(page);

  // Select the mirror, then turn its handle from 90° to 135°.
  await page.mouse.click(...at(200, 300));
  await dragArc(page, at, 200, 300, 36, 90, 136);
  await expect(page.locator('#play-rotations')).toHaveText('3');
  await expect(page.locator('#victory')).toBeVisible();
  await expect(page.locator('#victory-stars .earned')).toHaveCount(3);

  await page.reload();
  await page.goto('./#/niveaux');
  await expect(page.locator('[data-level="r01"] .earned')).toHaveCount(3);
  await expect(page.locator('[data-level="r02"]')).toBeEnabled();
  await expect(page.locator('[data-level="r03"]')).toBeDisabled();
});

test('le bouton retour du navigateur reste dans le jeu', async ({ page }) => {
  await page.goto('./');
  await page.locator('#menu-levels').click();
  await page.locator('[data-level="r01"]').click();
  await expect(page.locator('#screen-play')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#screen-levels')).toBeVisible();
  await page.goBack();
  await expect(page.locator('#screen-menu')).toBeVisible();
});

test('le niveau 1 se joue au clavier', async ({ page }, info) => {
  test.skip(info.project.name !== 'ordinateur', 'Clavier : ordinateur seulement');
  await page.goto('./#/niveau/r01');
  await page.locator('#game').focus();
  await page.keyboard.press('Tab'); // Select the mirror.
  await expect(page.locator('#play-message')).toContainText('Miroir sélectionné');
  for (let i = 0; i < 3; i++) await page.keyboard.press('r');
  await expect(page.locator('#victory')).toBeVisible();
});

test('fonctionne hors ligne après une première visite', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'ordinateur', 'Une seule fois suffit');
  await page.goto('./');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // Now controlled by the service worker.
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.menu-title')).toHaveText('Lumen');
  await page.locator('#menu-levels').click();
  await expect(page.locator('[data-level="r01"]')).toBeVisible();
  await context.setOffline(false);
});

test('le manifeste de la version installable est servi', async ({ request }) => {
  const response = await request.get('manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = (await response.json()) as { display: string; background_color: string };
  expect(manifest.display).toBe('standalone');
  expect(manifest.background_color).toBe('#02030A');
});

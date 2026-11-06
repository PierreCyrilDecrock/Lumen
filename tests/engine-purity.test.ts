import { describe, expect, it } from 'vitest';

const sources = import.meta.glob<string>('../src/engine/**/*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('src/engine purity', () => {
  it('has source files to check', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(0);
  });

  it.each(Object.entries(sources))(
    '%s imports nothing from render, ui, game or storage',
    (_, code) => {
      expect(code).not.toMatch(/from\s+['"][^'"]*\/(render|ui|game|storage)(\/|['"])/);
    },
  );

  it.each(Object.entries(sources))('%s uses no DOM or Canvas global', (_, code) => {
    expect(code).not.toMatch(
      /\b(document|window|navigator|localStorage|CanvasRenderingContext2D|HTMLCanvasElement)\b/,
    );
  });
});

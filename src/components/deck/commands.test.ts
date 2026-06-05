import { describe, expect, it } from 'vitest';
import { architectureBySlug } from '../../content/architectures';
import { complete, parse } from './commands';

const arch = architectureBySlug['stalwart-mail'];

describe('commands.parse', () => {
  it('help/ls produce print output', () => {
    expect(parse('help', arch).kind).toBe('print');
    const ls = parse('ls', arch);
    expect(ls.kind).toBe('print');
    if (ls.kind === 'print') expect(ls.lines.join(' ')).toContain('stalwart');
  });

  it('connect produces a CONNECT action with an exact echo', () => {
    const c = parse('connect nginx stalwart', arch);
    expect(c.kind).toBe('action');
    if (c.kind === 'action') {
      expect(c.action).toMatchObject({ type: 'CONNECT', from: 'nginx', to: 'stalwart' });
      expect(c.echo).toBe('connect nginx stalwart');
    }
  });

  it('unknown nodes and unknown verbs error', () => {
    expect(parse('connect nope stalwart', arch).kind).toBe('error');
    expect(parse('frobnicate', arch).kind).toBe('error');
    expect(parse('connect nginx', arch).kind).toBe('error');
  });

  it('boot/reset/clear map to actions; skills maps to skills', () => {
    expect(parse('boot', arch)).toMatchObject({ kind: 'action' });
    expect(parse('skills cloud', arch)).toMatchObject({ kind: 'skills', cluster: 'cloud' });
    expect(parse('skills', arch)).toMatchObject({ kind: 'skills', cluster: null });
  });
});

describe('commands.complete', () => {
  it('completes verbs then node ids', () => {
    expect(complete('con', arch)).toContain('connect');
    expect(complete('connect ng', arch)).toContain('nginx');
  });
});

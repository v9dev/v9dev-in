import { describe, expect, it } from 'vitest';
import { architectureBySlug } from '../../content/architectures';
import { type Ctx, complete, parse } from './commands';

const arch = architectureBySlug['stalwart-mail'];
const playing: Ctx = { phase: 'playing', arch };
const menu: Ctx = { phase: 'menu', arch: null };

describe('commands.parse - listing + menu', () => {
  it('ls / games print the scenario ids', () => {
    for (const verb of ['ls', 'games']) {
      const c = parse(verb, menu);
      expect(c.kind).toBe('print');
      if (c.kind === 'print') {
        const text = c.lines.join(' ');
        expect(text).toContain('stalwart-mail');
        expect(text).toContain('cockpit');
        expect(text).toContain('webstack');
        expect(text).toContain('ci');
      }
    }
  });

  it('help prints the full guide listing every command', () => {
    const c = parse('help', menu);
    expect(c.kind).toBe('print');
    if (c.kind === 'print') {
      const text = c.lines.join('\n');
      for (const verb of [
        'ls',
        'play',
        'connect',
        'disconnect',
        'status',
        'hint',
        'boot',
        'reset',
        'menu',
        'clear',
      ]) {
        expect(text).toContain(verb);
      }
    }
  });

  it('in menu phase a gameplay verb is gently redirected to ls', () => {
    const c = parse('connect nginx stalwart', menu);
    expect(c.kind).toBe('error');
    if (c.kind === 'error') {
      expect(c.message.toLowerCase()).toContain('load a game first');
      expect(c.message).toContain('ls');
    }
  });

  it('clear and help still work in menu phase', () => {
    expect(parse('clear', menu)).toMatchObject({ kind: 'action' });
    expect(parse('help', menu).kind).toBe('print');
  });
});

describe('commands.parse - play / start', () => {
  it('play <id> yields a game command carrying the slug', () => {
    const c = parse('play stalwart-mail', menu);
    expect(c).toMatchObject({ kind: 'game', verb: 'play', arg: 'stalwart-mail' });
  });

  it('start <id> is an alias for play', () => {
    const c = parse('start cockpit', menu);
    expect(c).toMatchObject({ kind: 'game', verb: 'play', arg: 'cockpit' });
  });

  it('play without an id errors with usage', () => {
    expect(parse('play', menu).kind).toBe('error');
  });

  it('play with an unknown id errors', () => {
    const c = parse('play nope', menu);
    expect(c.kind).toBe('error');
    if (c.kind === 'error') expect(c.message).toContain('nope');
  });
});

describe('commands.parse - gameplay verbs', () => {
  it('connect / link map to a CONNECT action with an exact echo', () => {
    for (const verb of ['connect', 'link']) {
      const c = parse(`${verb} nginx stalwart`, playing);
      expect(c.kind).toBe('action');
      if (c.kind === 'action') {
        expect(c.action).toMatchObject({ type: 'CONNECT', from: 'nginx', to: 'stalwart' });
        expect(c.echo).toBe(`${verb} nginx stalwart`);
      }
    }
  });

  it('disconnect / unlink map to a DISCONNECT action', () => {
    for (const verb of ['disconnect', 'unlink']) {
      const c = parse(`${verb} nginx stalwart`, playing);
      expect(c.kind).toBe('action');
      if (c.kind === 'action') {
        expect(c.action).toMatchObject({ type: 'DISCONNECT', from: 'nginx', to: 'stalwart' });
      }
    }
  });

  it('status / hint / boot / fireup / menu / back map to game commands', () => {
    expect(parse('status', playing)).toMatchObject({ kind: 'game', verb: 'status' });
    expect(parse('hint', playing)).toMatchObject({ kind: 'game', verb: 'hint' });
    expect(parse('boot', playing)).toMatchObject({ kind: 'game', verb: 'boot' });
    expect(parse('fireup', playing)).toMatchObject({ kind: 'game', verb: 'boot' });
    expect(parse('menu', playing)).toMatchObject({ kind: 'game', verb: 'menu' });
    expect(parse('back', playing)).toMatchObject({ kind: 'game', verb: 'menu' });
  });

  it('reset maps to a game command (timestamp captured by the runner)', () => {
    expect(parse('reset', playing)).toMatchObject({ kind: 'game', verb: 'reset' });
  });

  it('clear maps to a CLEAR action', () => {
    expect(parse('clear', playing)).toMatchObject({
      kind: 'action',
      action: { type: 'CLEAR' },
    });
  });

  it('unknown nodes and unknown verbs error', () => {
    expect(parse('connect nope stalwart', playing).kind).toBe('error');
    expect(parse('frobnicate', playing).kind).toBe('error');
    expect(parse('connect nginx', playing).kind).toBe('error');
  });

  it('empty input is a no-op print', () => {
    expect(parse('   ', playing)).toMatchObject({ kind: 'print', lines: [] });
  });
});

describe('architect-mode commands', () => {
  const playingCtx = { phase: 'playing', arch: architectureBySlug['stalwart-mail'] } as const;

  it('parses add/remove into game verbs with the id arg', () => {
    expect(parse('add nginx', playingCtx)).toMatchObject({
      kind: 'game',
      verb: 'add',
      arg: 'nginx',
    });
    expect(parse('remove nginx', playingCtx)).toMatchObject({
      kind: 'game',
      verb: 'remove',
      arg: 'nginx',
    });
  });
  it('rejects add/remove for an unknown node', () => {
    expect(parse('add nope', playingCtx)).toMatchObject({ kind: 'error' });
  });
  it('add/remove require a loaded scenario', () => {
    const menuCtx = { phase: 'menu', arch: null } as const;
    expect(parse('add nginx', menuCtx)).toMatchObject({ kind: 'error' });
  });
  it('ls lists cards while playing, games at the menu', () => {
    expect(parse('ls', { phase: 'menu', arch: null } as const)).toMatchObject({ kind: 'print' });
    expect(parse('ls', playingCtx)).toMatchObject({ kind: 'game', verb: 'cards' });
    expect(parse('cards', playingCtx)).toMatchObject({ kind: 'game', verb: 'cards' });
  });
  it('help mentions add/remove and no longer claims hint reveals the wire', () => {
    const lines = (parse('help', playingCtx) as { lines: string[] }).lines.join('\n');
    expect(lines).toMatch(/add/);
    expect(lines).toMatch(/remove/);
    expect(lines).not.toMatch(/reveal the next required wire/);
  });
});

describe('commands.complete', () => {
  it('completes verbs', () => {
    expect(complete('con', playing)).toContain('connect');
    expect(complete('st', playing)).toContain('status');
  });

  it('completes game ids after play', () => {
    expect(complete('play c', menu)).toContain('cockpit');
    expect(complete('play c', menu)).toContain('ci');
  });

  it('completes node ids after connect when an arch is loaded', () => {
    expect(complete('connect ng', playing)).toContain('nginx');
  });

  it('offers no node ids in menu phase (no arch loaded)', () => {
    expect(complete('connect ng', menu)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { architectureBySlug } from '../../content/architectures';
import { deckReducer, initDeckState } from './state';

const arch = architectureBySlug['stalwart-mail'];

describe('deckReducer', () => {
  it('inits UNWIRED in the menu phase with zeroed counters + a system log line', () => {
    const s = initDeckState(arch);
    expect(s.archSlug).toBe('stalwart-mail');
    expect(s.edges).toHaveLength(0);
    expect(s.phase).toBe('menu');
    expect(s.moves).toBe(0);
    expect(s.hintsUsed).toBe(0);
    expect(s.startedAt).toBeNull();
    expect(s.wonAt).toBeNull();
    expect(s.log[0].kind).toBe('system');
    expect(s.armedFrom).toBeNull();
  });

  it('PLAY loads a scenario unwired, enters playing, sets startedAt, resets counters, logs the objective', () => {
    let s = initDeckState(arch);
    // dirty the prior session so the reset is observable
    s = deckReducer(s, { type: 'HINT' });
    s = deckReducer(s, { type: 'PLAY', arch, at: 1000 });
    expect(s.phase).toBe('playing');
    expect(s.edges).toHaveLength(0);
    expect(s.startedAt).toBe(1000);
    expect(s.wonAt).toBeNull();
    expect(s.moves).toBe(0);
    expect(s.hintsUsed).toBe(0);
    expect(s.log.some((l) => l.text.includes(arch.objective))).toBe(true);
  });

  it('CONNECT adds a new edge, clears armedFrom, increments moves; duplicates are ignored + do not count', () => {
    let s = deckReducer(initDeckState(arch), { type: 'PLAY', arch, at: 1 });
    s = deckReducer(s, { type: 'ARM', from: 'nginx' });
    expect(s.armedFrom).toBe('nginx');
    s = deckReducer(s, { type: 'CONNECT', from: 'mailclient', to: 'nginx' });
    expect(s.armedFrom).toBeNull();
    expect(s.edges.some((e) => e.id === 'mailclient->nginx')).toBe(true);
    expect(s.moves).toBe(1);
    const n = s.edges.length;
    s = deckReducer(s, { type: 'CONNECT', from: 'mailclient', to: 'nginx' });
    expect(s.edges).toHaveLength(n);
    expect(s.moves).toBe(1);
  });

  it('DISCONNECT removes an edge and increments moves', () => {
    let s = deckReducer(initDeckState(arch), { type: 'PLAY', arch, at: 1 });
    s = deckReducer(s, { type: 'CONNECT', from: 'stalwart', to: 'sqlite' });
    expect(s.moves).toBe(1);
    s = deckReducer(s, { type: 'DISCONNECT', from: 'stalwart', to: 'sqlite' });
    expect(s.edges.some((e) => e.id === 'stalwart->sqlite')).toBe(false);
    expect(s.moves).toBe(2);
  });

  it('HINT increments hintsUsed', () => {
    let s = deckReducer(initDeckState(arch), { type: 'PLAY', arch, at: 1 });
    s = deckReducer(s, { type: 'HINT' });
    s = deckReducer(s, { type: 'HINT' });
    expect(s.hintsUsed).toBe(2);
  });

  it('WIN enters the won phase and stamps wonAt', () => {
    let s = deckReducer(initDeckState(arch), { type: 'PLAY', arch, at: 1 });
    s = deckReducer(s, { type: 'WIN', at: 5000 });
    expect(s.phase).toBe('won');
    expect(s.wonAt).toBe(5000);
  });

  it('MENU returns to the menu phase', () => {
    let s = deckReducer(initDeckState(arch), { type: 'PLAY', arch, at: 1 });
    s = deckReducer(s, { type: 'MENU' });
    expect(s.phase).toBe('menu');
  });

  it('LOG appends and pushes input lines into history', () => {
    let s = initDeckState(arch);
    s = deckReducer(s, { type: 'LOG', kind: 'input', text: 'connect a b' });
    expect(s.log.at(-1)).toMatchObject({ kind: 'input', text: 'connect a b' });
    expect(s.history.at(-1)).toBe('connect a b');
  });

  it('SELECT_NODE(null) closes; CLEAR empties the log', () => {
    let s = initDeckState(arch);
    s = deckReducer(s, { type: 'SELECT_NODE', id: 'stalwart' });
    expect(s.selectedNodeId).toBe('stalwart');
    s = deckReducer(s, { type: 'SELECT_NODE', id: null });
    expect(s.selectedNodeId).toBeNull();
    s = deckReducer(s, { type: 'CLEAR' });
    expect(s.log).toHaveLength(0);
  });

  it('RESET re-inits the current scenario unwired but stays playing with a fresh startedAt', () => {
    let s = deckReducer(initDeckState(arch), { type: 'PLAY', arch, at: 1 });
    s = deckReducer(s, { type: 'CONNECT', from: 'stalwart', to: 'sqlite' });
    s = deckReducer(s, { type: 'HINT' });
    expect(s.moves).toBe(1);
    s = deckReducer(s, { type: 'RESET', arch, at: 9000 });
    expect(s.edges).toHaveLength(0);
    expect(s.phase).toBe('playing');
    expect(s.startedAt).toBe(9000);
    expect(s.moves).toBe(0);
    expect(s.hintsUsed).toBe(0);
    expect(s.wonAt).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { architectureBySlug } from '../../content/architectures';
import { deckReducer, initDeckState } from './state';

const arch = architectureBySlug['stalwart-mail'];

describe('deckReducer', () => {
  it('inits from an architecture with reference edges + a system log line', () => {
    const s = initDeckState(arch);
    expect(s.archSlug).toBe('stalwart-mail');
    expect(s.edges).toHaveLength(arch.edges.length);
    expect(s.log[0].kind).toBe('system');
    expect(s.armedFrom).toBeNull();
  });

  it('CONNECT adds a new edge and clears armedFrom; duplicates are ignored', () => {
    let s = deckReducer(initDeckState(arch), { type: 'ARM', from: 'nginx' });
    expect(s.armedFrom).toBe('nginx');
    s = deckReducer(s, { type: 'CONNECT', from: 'mailclient', to: 'nginx' });
    expect(s.armedFrom).toBeNull();
    expect(s.edges.some((e) => e.id === 'mailclient->nginx')).toBe(true);
    const n = s.edges.length;
    s = deckReducer(s, { type: 'CONNECT', from: 'mailclient', to: 'nginx' });
    expect(s.edges).toHaveLength(n);
  });

  it('DISCONNECT removes an edge', () => {
    let s = initDeckState(arch);
    s = deckReducer(s, { type: 'DISCONNECT', from: 'stalwart', to: 'sqlite' });
    expect(s.edges.some((e) => e.id === 'stalwart->sqlite')).toBe(false);
  });

  it('LOG appends and pushes input lines into history', () => {
    let s = initDeckState(arch);
    s = deckReducer(s, { type: 'LOG', kind: 'input', text: 'connect a b' });
    expect(s.log.at(-1)).toMatchObject({ kind: 'input', text: 'connect a b' });
    expect(s.history.at(-1)).toBe('connect a b');
  });

  it('SELECT_NODE(null) closes; CLEAR empties the log; RESET restores reference', () => {
    let s = initDeckState(arch);
    s = deckReducer(s, { type: 'SELECT_NODE', id: 'stalwart' });
    expect(s.selectedNodeId).toBe('stalwart');
    s = deckReducer(s, { type: 'SELECT_NODE', id: null });
    expect(s.selectedNodeId).toBeNull();
    s = deckReducer(s, { type: 'CLEAR' });
    expect(s.log).toHaveLength(0);
    s = deckReducer(s, { type: 'DISCONNECT', from: 'stalwart', to: 'sqlite' });
    s = deckReducer(s, { type: 'RESET', arch });
    expect(s.edges).toHaveLength(arch.edges.length);
  });
});

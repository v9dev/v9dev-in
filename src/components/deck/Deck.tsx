import { architectureBySlug } from '@content/architectures';
import { useCallback, useReducer, useState } from 'react';
import Diagram from './Diagram';
import Terminal from './Terminal';
import { canConnect } from './board';
import type { Command } from './commands';
import { deckReducer, initDeckState } from './state';

const arch = architectureBySlug['stalwart-mail'];

export default function Deck() {
  const [state, dispatch] = useReducer(deckReducer, arch, initDeckState);
  // Local chart selection - the chart itself is wired in Group F.
  const [, setSkillsCluster] = useState<string | null>(null);

  const runCommand = useCallback((cmd: Command) => {
    if (cmd.kind === 'print') {
      for (const text of cmd.lines) dispatch({ type: 'LOG', kind: 'output', text });
      return;
    }
    if (cmd.kind === 'error') {
      dispatch({ type: 'LOG', kind: 'error', text: cmd.message });
      return;
    }
    if (cmd.kind === 'skills') {
      setSkillsCluster(cmd.cluster);
      dispatch({
        type: 'LOG',
        kind: 'output',
        text: `skills${cmd.cluster ? ` ${cmd.cluster}` : ''}`,
      });
      return; // chart wired in Group F
    }
    // action
    dispatch({ type: 'LOG', kind: 'input', text: cmd.echo });
    const a = cmd.action;
    if (a.type === 'CONNECT') {
      const v = canConnect(arch, a.from, a.to);
      if (!v.ok) {
        dispatch({ type: 'LOG', kind: 'error', text: `! ${v.reason}` });
        return;
      }
      dispatch(a);
      dispatch({ type: 'LOG', kind: 'output', text: `LINK ${a.from} -> ${a.to}  OK` });
      return;
    }
    if (a.type === 'DISCONNECT') {
      dispatch(a);
      dispatch({ type: 'LOG', kind: 'output', text: `UNLINK ${a.from} -> ${a.to}` });
      return;
    }
    dispatch(a);
  }, []);

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <Terminal arch={arch} log={state.log} history={state.history} onRun={runCommand} />
      <Diagram arch={arch} state={state} dispatch={dispatch} onRun={runCommand} />
    </div>
  );
}

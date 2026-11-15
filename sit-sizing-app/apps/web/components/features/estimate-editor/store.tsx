'use client';

import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import type { Assumptions, EstimateInputs } from '@sit/schemas';
import { computeBoth, DEFAULT_ASSUMPTIONS, uncalibratedCount, type BothResults } from '@sit/engine';

/** The open draft (design 8.3): one client store, recomputed on every change. */
export interface EditorState {
  inputs: EstimateInputs;
  assumptions: Assumptions;
  /** True when there are changes the server has not seen yet. */
  dirty: boolean;
  /** Optimistic lock token from the last server copy (design 8.3, autosave). */
  rowVersion: number;
  /** Increases with every local change, so a save only clears `dirty` for what it sent. */
  revision: number;
}

export type EditorAction =
  | { type: 'load'; inputs: EstimateInputs; assumptions: Assumptions; rowVersion: number }
  | { type: 'editInputs'; recipe: (draft: EstimateInputs) => void }
  | { type: 'editAssumptions'; recipe: (draft: Assumptions) => void }
  | { type: 'replace'; inputs: EstimateInputs; assumptions: Assumptions }
  | { type: 'saved'; rowVersion: number; revision: number }
  /** This tab took the lock back ("Open here instead"): keep the values on screen. */
  | { type: 'relocked'; rowVersion: number };

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'load':
      return {
        inputs: action.inputs,
        assumptions: action.assumptions,
        rowVersion: action.rowVersion,
        dirty: false,
        revision: 0,
      };
    case 'editInputs': {
      const inputs = structuredClone(state.inputs);
      action.recipe(inputs);
      return { ...state, inputs, dirty: true, revision: state.revision + 1 };
    }
    case 'editAssumptions': {
      const assumptions = structuredClone(state.assumptions);
      action.recipe(assumptions);
      return { ...state, assumptions, dirty: true, revision: state.revision + 1 };
    }
    case 'replace':
      return {
        ...state,
        inputs: action.inputs,
        assumptions: action.assumptions,
        dirty: true,
        revision: state.revision + 1,
      };
    case 'saved':
      // Edits made while the save was in flight stay dirty and are saved next.
      return {
        ...state,
        rowVersion: action.rowVersion,
        dirty: state.revision !== action.revision,
      };
    case 'relocked': {
      // If the draft changed elsewhere, the values on screen win: save them over it.
      const changed = action.rowVersion !== state.rowVersion;
      return {
        ...state,
        rowVersion: action.rowVersion,
        dirty: state.dirty || changed,
        revision: changed ? state.revision + 1 : state.revision,
      };
    }
  }
}

export interface EditorContextValue {
  state: EditorState;
  /** Both modes, recomputed when inputs or assumptions change. */
  results: BothResults;
  uncalibrated: number;
  /** False for viewers and while someone else holds the edit lock. */
  editable: boolean;
  editInputs: (recipe: (draft: EstimateInputs) => void) => void;
  editAssumptions: (recipe: (draft: Assumptions) => void) => void;
  dispatch: (action: EditorAction) => void;
}

const EditorContext = createContext<EditorContextValue | null>(null);

export function EditorProvider({
  initial,
  editable,
  children,
}: {
  initial: Omit<EditorState, 'dirty' | 'revision'>;
  editable: boolean;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(editorReducer, { ...initial, dirty: false, revision: 0 });
  // Runs the engine in the browser on every change (design 8.3); memoised per state.
  const results = useMemo(
    () => computeBoth(state.inputs, state.assumptions),
    [state.inputs, state.assumptions],
  );
  const uncalibrated = useMemo(
    () => uncalibratedCount(state.assumptions, DEFAULT_ASSUMPTIONS as Assumptions),
    [state.assumptions],
  );
  const value = useMemo<EditorContextValue>(
    () => ({
      state,
      results,
      uncalibrated,
      editable,
      dispatch,
      editInputs: (recipe) => dispatch({ type: 'editInputs', recipe }),
      editAssumptions: (recipe) => dispatch({ type: 'editAssumptions', recipe }),
    }),
    [state, results, uncalibrated, editable],
  );
  return <EditorContext.Provider value={value}>{children}</EditorContext.Provider>;
}

export function useEditor(): EditorContextValue {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('useEditor must be used inside <EditorProvider>');
  return ctx;
}

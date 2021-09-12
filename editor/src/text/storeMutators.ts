import { Section, allSectionsStore, AllSections, SectionStore } from "./textState";
import { getOptions } from "../preprocess/align";
import type { Writable } from "svelte/store";
import { tick } from "svelte/internal";
import { selectSectionStart, selectExactly } from "../input/select";
import { SectionSelection, selectionStore } from "../input/selectionState";
import { deriveConditionally } from "../utils/stores";
import { getAssertExists } from "../utils/list";
import type { SectionPatch } from "./save";
import { stat } from "fs";

let allSections: AllSections;
allSectionsStore.subscribe(state => allSections = state);

type HistoryStep = {
  selection: SectionSelection | undefined;
  sections: Record<number, {
              from: Section;
              to: Section;
            }>
};

let undoCount: number = 0;
const history: HistoryStep[] = [];

let pendingStepSections: HistoryStep["sections"] = {};

let selection: SectionSelection | undefined;
selectionStore.subscribe(state => selection = state);

deriveConditionally(selectionStore, undefined, (a, b) => {
  if (a?.anchor?.section !== b?.anchor?.section) return true;
  if (a?.focus?.section !== b?.focus?.section) return true;
  return false;
}).subscribe(() => commitHistory())

async function addHistory(idx: number, from: Section, to: Section) {
  if (sectionsEqual(from, to)) return;

  const currentSection = pendingStepSections[idx];
  if (currentSection === undefined) {
    pendingStepSections[idx] = { from, to };
  } else {
    currentSection.to = to;
  }
}

export function commitHistory() {
  if (Object.keys(pendingStepSections).length === 0) return;
  console.log("Committed history", pendingStepSections)

  const splitPoint = history.length - undoCount;
  history.splice(splitPoint, history.length);

  history.push({
    selection,
    sections: pendingStepSections
  });

  pendingStepSections = {};
  undoCount = 0;
}

export function clearHistory() {
  history.splice(0, history.length);
  pendingStepSections = {};
  undoCount = 0;
}

export async function undo() {
  commitHistory();

  const step = history.length - 1 - undoCount;
  const historyStep: HistoryStep | undefined = history[step];
  if (!historyStep) return;

  undoCount++;
  Object.entries(historyStep.sections).forEach(([idxString, { from }]) => {
    const idx = parseInt(idxString);
    getAssertExists(allSections, idx).set(from);
  })

  await tick();

  const previousStep: HistoryStep | undefined = history[step - 1];
  if (previousStep === undefined) {
    const idxString = Object.keys(historyStep.sections)?.[0];
    if (idxString !== undefined) {
      await selectSectionStart(parseInt(idxString));
    }
  } else {
    await selectExactly(previousStep?.selection);
  }
}

export async function redo() {
  commitHistory();

  const step = history.length - undoCount;
  const historyStep: HistoryStep | undefined = history[step];
  if (!historyStep) return;

  undoCount--;
  Object.entries(historyStep.sections).forEach(([idxString, { to }]) => {
    const idx = parseInt(idxString);
    getAssertExists(allSections, idx).set(to);
  })

  await tick();
  await selectExactly(historyStep?.selection);
}




abstract class BaseSectionMutator<S> {
  protected readonly underlying: Writable<S>;

  constructor(underlying: Writable<S>) {
    this.underlying = underlying;
  }

  get(): Writable<S> {
    return this.underlying;
  }

  abstract update(func: (state: Section) => Section): this;

  setText(text: string): this {
    return this.update(state => {
      if (state.text === text && state.edited) return state;

      return {
        ...state,
        text,
        completionOptions: getOptions(text, state.originalOptions),
        edited: true
      };
    })
  }

  toggleParagraph(): this {
    return this.update(state => ({
      ...state,
      endParagraph: !state.endParagraph
    }))
  }

  enableEndParagraph(): this {
    return this.update(state => ({
      ...state,
      endParagraph: true
    }))
  }

  disableEndParagraph(): this {
    return this.update(state => ({
      ...state,
      endParagraph: false
    }))
  }

  applyPatch(patch: SectionPatch): this {
    return this.update(state => ({
      ...state,
      text: patch.text ?? state.text,
      edited: patch.edited ?? state.edited,
      endParagraph: patch.endParagraph ?? state.endParagraph
    }))
  }
}

export class SectionMutator extends BaseSectionMutator<Section> {
  update(func: (state: Section) => Section): this {
    this.underlying.update(state => {
      const newState = func(state);
      addHistory(state.idx, state, newState);
      return newState;
    });
    return this;
  }

  static ofIdx(idx: number): SectionMutator | undefined {
    const store: SectionStore | undefined = allSections[idx];
    if (!store) return undefined;
    return new SectionMutator(store);
  }
}

export class MaybeSectionMutator extends BaseSectionMutator<Section | undefined> {
  update(func: (state: Section) => Section): this {
    this.underlying.update(state => {
      if (state === undefined) return undefined;
      const newState = func(state);
      addHistory(state.idx, state, newState);
      return newState;
    })
    return this;
  }
}

function sectionsEqual(a: Section, b: Section): boolean {
  if (a.idx !== b.idx) return false;
  if (a.text !== b.text) return false;
  if (a.startTime !== b.startTime) return false;
  if (a.endTime !== b.endTime) return false;
  if (a.edited !== b.edited) return false;
  if (a.endParagraph !== b.endParagraph) return false;
  return true;
}
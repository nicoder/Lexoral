import { Writable, writable, derived, Readable } from "svelte/store";
import { selectedSectionsIdxStore, selectionStore } from "./selectionStores";
import { allSectionsStore, documentStore, ParagraphStore, ParagraphState, SectionStore, SectionState } from "./sectionStores";
import * as Tone from "tone";
import { clampGet, unwrapStore, clamp } from "./utils";

/**
 * These mutations are applied in order.
 * sectionOffset is only applied when you select one section, and is not applied when you manually select a range of sections.
 * 
 * 1. Add `sectionOffset` sections before and after the original selection. This is non-negative.
 * 2. If `constrainWithinParagraph`, remove any of the sections added by `sectionOffset` that are in a paragraph different to the paragraph(s) of the original selection
 * 3. If `addGap`, play from the end of the section before the first section until the start of the section after the last section (rather than the start of the first to the end of the last). In other words, play the silence before and after the selection.
 * 4. Subtract `timeOffset` seconds from the start time and add it to the end time, expanding the selection.
 */
type AudioSelectionSideMutation = {
  sectionOffset: number;
  constrainWithinParagraph: boolean;
  addGap: boolean;
  timeOffset: number;
}
type AudioSelectionMutation = {
  start: AudioSelectionSideMutation;
  end: AudioSelectionSideMutation;
}
let mutation: AudioSelectionMutation = {
  start: {
    sectionOffset: 3,
    constrainWithinParagraph: true,
    addGap: true,
    timeOffset: 0
  },
  end: {
    sectionOffset: 3,
    constrainWithinParagraph: true,
    addGap: true,
    timeOffset: 0
  }
}
const mutationStore: Writable<AudioSelectionMutation> = writable(mutation);
mutationStore.subscribe(state => mutation = state);




const startParagraphStoreWrapped: Readable<ParagraphStore | undefined> = derived([documentStore, selectionStore], ([document, selection]) => {
  if (selection === undefined) return undefined;
  return clampGet(document, selection.early.paragraph);
});
const startParagraphStore: Readable<ParagraphState | undefined> = unwrapStore(startParagraphStoreWrapped);


const endParagraphStoreWrapped: Readable<ParagraphStore | undefined> = derived([documentStore, selectionStore], ([document, selection]) => {
  if (selection === undefined) return undefined;
  return clampGet(document, selection.late.paragraph);
});
const endParagraphStore: Readable<ParagraphState | undefined> = unwrapStore(endParagraphStoreWrapped);


const offsetSelectionStore: Readable<{ start: SectionStore; end: SectionStore } | undefined> = derived([selectedSectionsIdxStore, selectionStore, mutationStore, startParagraphStore, endParagraphStore, allSectionsStore], ([selectedIdxs, selection, mutation, startParagraph, endParagraph, sections]) => {
  // Nothing selected
  if (selectedIdxs === undefined) return undefined;

  const rangeSelected = selectedIdxs.start !== selectedIdxs.end;
  if (rangeSelected) return {
    start: sections[selectedIdxs.start],
    end: sections[selectedIdxs.end]
  }

  const startSectionStore: SectionStore = mutation.start.constrainWithinParagraph
                                            ?
                                          clampGet(startParagraph, selection.early.section - mutation.start.sectionOffset)
                                            :
                                          sections[clamp(selectedIdxs.start - mutation.start.sectionOffset, 0, Object.keys(sections).length - 1)];

  const endSectionStore: SectionStore = mutation.end.constrainWithinParagraph
                                          ?
                                        clampGet(endParagraph, selection.late.section + mutation.end.sectionOffset)
                                          :
                                        sections[clamp(selectedIdxs.end + mutation.end.sectionOffset, 0, Object.keys(sections).length - 1)];

  return {
    start: startSectionStore,
    end: endSectionStore
  }
});

const offsetStartSectionStoreWrapped: Readable<SectionStore | undefined> = derived(offsetSelectionStore, state => state?.start);
const offsetStartSectionStore: Readable<SectionState | undefined> = unwrapStore(offsetStartSectionStoreWrapped);
const gapsStartSectionStoreWrapped: Readable<SectionStore | undefined> = derived([offsetStartSectionStore, mutationStore, allSectionsStore], ([start, mutation, sections]) => {
  if (start === undefined) return undefined;
  const offset = mutation.start.addGap ? 1 : 0;
  const store = sections[clamp(start.idx - offset, 0, Object.keys(sections).length - 1)]
  return store;
})
const gapsStartSectionStore: Readable<SectionState | undefined> = unwrapStore(gapsStartSectionStoreWrapped);
const startTimeStore: Readable<number | undefined> = derived([gapsStartSectionStore, mutationStore], ([start, mutation]) => {
  if (start === undefined) return undefined;
  if (mutation.start.addGap) return start.endTime - mutation.start.timeOffset;
  else return start.startTime - mutation.start.timeOffset;
})

const offsetEndSectionStoreWrapped: Readable<SectionStore | undefined> = derived(offsetSelectionStore, state => state?.end);
const offsetEndSectionStore: Readable<SectionState | undefined> = unwrapStore(offsetEndSectionStoreWrapped);
const gapsEndSectionStoreWrapped: Readable<SectionStore | undefined> = derived([offsetEndSectionStore, mutationStore, allSectionsStore], ([end, mutation, sections]) => {
  if (end === undefined) return undefined;
  const offset = mutation.start.addGap ? 1 : 0;
  const store = sections[clamp(end.idx + offset, 0, Object.keys(sections).length - 1)]
  return store;
})
const gapsEndSectionStore: Readable<SectionState | undefined> = unwrapStore(gapsEndSectionStoreWrapped);
const endTimeStore: Readable<number | undefined> = derived([gapsEndSectionStore, mutationStore], ([end, mutation]) => {
  if (end === undefined) return undefined;
  if (mutation.start.addGap) return end.startTime + mutation.end.timeOffset;
  else return end.endTime + mutation.end.timeOffset;
})

export const audioTimingsStore: Readable<{ start: number; end: number } | undefined> = derived([startTimeStore, endTimeStore], ([start, end]) => ({ start, end }))

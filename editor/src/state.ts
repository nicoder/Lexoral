import { writable, derived } from "svelte/store";
import type { Writable, Readable } from "svelte/store";
import type { Output, OutputSection } from "./types";
import { maybeDerived } from "./utils";
import { currentTimeStore, audioStateStore } from "./audioState";

export const outputStore: Writable<Output> = writable([]);

export const audioLengthStore: Readable<number> = derived(outputStore, sections => {
  if (!sections?.length) return 0;
  return sections[sections.length - 1].endTime;
});

export const currentTimePercentStore: Readable<number> = derived([currentTimeStore, audioLengthStore], ([time, length]) => {
  if (!length) return 0;
  return 100 * (time / length);
});

export const playingSectionsStore: Readable<Output> = derived(
  [outputStore, audioStateStore],
  ([sections, audioState]) => sections.filter(section => section.startTime < audioState.loopEnd && section.endTime > audioState.loopStart)
);

export const currentSectionStore: Readable<OutputSection> = maybeDerived(
  [playingSectionsStore, currentTimeStore],
  null,
  ([playingSections, currentTime]) => playingSections.find(section => section.startTime <= currentTime && section.endTime >= currentTime) || null
);

export const directionStore: Writable<"start" | "end"> = writable("start");

export const prevSectionStore: Readable<OutputSection> = derived(
  [outputStore, audioStateStore],
  ([sections, audioState]) => {
    const firstSectionIdx = sections.find(section => section.endTime > audioState.loopStart)?.idx ?? 0;
    const prevIdx = Math.max(0, firstSectionIdx - 1);
    return sections[prevIdx];
  }
);

export const nextSectionStore: Readable<OutputSection> = derived(
  [outputStore, audioStateStore],
  ([sections, audioState]) => {
    const reverseSections = sections.slice().reverse();
    const lastSectionIdx = reverseSections.find(section => section.startTime < audioState.loopEnd)?.idx ?? 0;
    const nextIdx = Math.min(sections.length - 1, lastSectionIdx + 1);
    return sections[nextIdx];
  }
);

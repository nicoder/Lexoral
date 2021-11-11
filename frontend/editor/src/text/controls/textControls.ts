import { selectEnd, selectNextSection, selectPrevSection, selectSectionEnd, selectSectionStart, selectStart } from "../../input/select";
import type { SectionStore } from "../../state/section/sectionStore";
import { getMaxSectionIdx, getSectionStore } from "../../state/section/sectionStoreRegistry";
import type { SectionKeyboardEvent } from "./sectionInput";

export async function deletePrevCharacter(event: SectionKeyboardEvent, section: SectionStore) {
  const currentOffset = window.getSelection()?.focusOffset;
  if (currentOffset === undefined) return; // Don't know what to do with this, leave it default
  if (currentOffset > 0) return; // Move one character left as normal

  // Need to move one section left
  event.preventDefault();
  section.startParagraphStore.set(false);
  await selectPrevSection(section.idx);
}

export async function deletePrevWord(event: SectionKeyboardEvent, section: SectionStore) {
  const currentOffset = window.getSelection()?.focusOffset;
  if (currentOffset === undefined) return; // Don't know what to do with this, leave it default

  if (currentOffset <= 0) {
    // At start of section, delete previous section
    event.preventDefault();
    if (section.idx === 0) return; // At start of document already

    const prevSection = getSectionStore(section.idx - 1);
    section.startParagraphStore.set(false);
    prevSection.displayTextStore.set("");
    await selectSectionStart(section.idx - 1);
  } else {
    // Not at start of section, delete to there
    event.preventDefault();
    section.displayTextStore.update(text => text.slice(currentOffset));
    await selectStart(event.currentTarget);
  }
}

export async function deleteNextCharacter(event: SectionKeyboardEvent, section: SectionStore) {
  const currentOffset = window.getSelection()?.focusOffset;
  if (currentOffset === undefined) return; // Don't know what to do with this, leave it default

  const textLength = event.currentTarget.textContent?.length;
  if (textLength !== undefined && currentOffset < textLength) return; // Move one character right as normal

  // Need to move one section right
  event.preventDefault();
  section.endParagraphStore.set(false);
  await selectNextSection(section.idx);
}

export async function deleteNextWord(event: SectionKeyboardEvent, section: SectionStore) {
  const currentOffset = window.getSelection()?.focusOffset;
  if (currentOffset === undefined) return; // Don't know what to do with this, leave it default

  const textLength = event.currentTarget.textContent?.length;

  if (textLength === undefined || currentOffset >= textLength) {
    // At end of section, move to end of next section
    event.preventDefault();
    if (section.idx === getMaxSectionIdx()) return; // At end of document already

    const nextSection = getSectionStore(section.idx + 1);
    nextSection.displayTextStore.set("");
    section.endParagraphStore.set(false);
    await selectSectionEnd(section.idx + 1);
  } else {
    // Not at end of section, delete from there
    event.preventDefault();
    section.displayTextStore.update(text => text.slice(0, currentOffset));
    await selectEnd(event.currentTarget);
  }
}

export async function newLine(event: SectionKeyboardEvent, section: SectionStore) {
  const currentOffset = window.getSelection()?.focusOffset;
  if (currentOffset === undefined) return; // Don't know what to do with this, leave it default

  if (currentOffset <= 0) {
    section.startParagraphStore.set(true);
  } else {
    section.endParagraphStore.set(true);
  }
}
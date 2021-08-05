import { NWaligner } from "seqalign";
import type { OutputSection } from "./types";

const defaultAligner = NWaligner({
  similarityScoreFunction: (char1: string, char2: string) => (char1.toLowerCase() === char2.toLowerCase() ? 1 : -2)
});

export function getOptions(text: string, options: OutputSection["options"]): string[] {
  const newOptions = options.map(option => alignOption(text, option.text));
  newOptions.sort((a, b) => b.score - a.score);
  const justText = newOptions.map(option => option.text);

  const deduped: string[] = []
  justText.filter(str => {
    if (deduped.includes(str)) return false;
    deduped.push(str);
    return true;
  })
  return deduped;
}

function alignOption(inputText: string, optionText: string): { text: string; score: number } {
  if (!inputText) return { text: optionText, score: 0 };

  const alignment = defaultAligner.align(inputText, optionText);
  const inputAlignment: string = alignment.alignedSequences[0];

  let dashes = 0;
  for(let i = inputAlignment.length; i--; i >= 0) {
    if (inputAlignment[i] === "-") {
      dashes++;
    } else {
      break;
    }
  }

  const completion = optionText.substring(optionText.length - dashes, optionText.length);
  return { text: inputText + completion, score: alignment.score };
}
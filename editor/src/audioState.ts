import { writable, Writable } from "svelte/store";
import { Tweened, tweened } from "svelte/motion";
import { clamp } from "./utils";

export type AudioState = {
  loopStart: number;
  loopEnd: number;
  loop: boolean;
  paused: boolean;
};

export const audioStateStore: Writable<AudioState> = writable({
  loopStart: 0,
  loopEnd: 0,
  loop: true,
  paused: false
});
export const currentTimeStore: Tweened<number> = tweened(0);

let cancelTimers: () => void = () => {};

audioStateStore.subscribe(audioState => {
  if ("start" in audioState) throw new Error("start")

  cancelTimers();
  cancelTimers = () => {};

  let playbackStart: number;
  currentTimeStore.update((target, current) => {
    playbackStart = clamp(current, audioState.loopStart, audioState.loopEnd);
    return playbackStart;
  }, {duration: 0});

  if (audioState.paused) return;

  const firstDurationMs = (audioState.loopEnd - playbackStart) * 1000;
  currentTimeStore.set(audioState.loopEnd, {duration: firstDurationMs});

  if (!audioState.loop || audioState.loopEnd === audioState.loopStart) return;

  const timers: NodeJS.Timeout[] = [];
  const latterDurationMs = (audioState.loopEnd - audioState.loopStart) * 1000;

  function resetTime() {
    currentTimeStore.set(audioState.loopStart, {duration: 0})
    currentTimeStore.set(audioState.loopEnd, {duration: latterDurationMs});
  }

  timers.push(
    setTimeout(() => {
      resetTime();
      timers.push(
        setInterval(() => {
          resetTime();
        }, latterDurationMs)
      )
    }, firstDurationMs)
  );

  cancelTimers = () => timers.forEach(clearTimeout);
})



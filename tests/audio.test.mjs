import assert from "node:assert/strict";
import { openSync, closeSync, readFileSync, readSync } from "node:fs";
import test from "node:test";
import {
  AUDIO_VOLUME_LEVELS,
  bgmGainForLevel,
  clampAudioVolumeLevel,
  DEFAULT_AUDIO_VOLUME_LEVEL,
  legacyPercentToAudioVolumeLevel,
} from "../lib/audio-volume.ts";

test("sound settings expose exactly six integer volume levels with four as the default", () => {
  assert.deepEqual(AUDIO_VOLUME_LEVELS, [0, 1, 2, 3, 4, 5]);
  assert.equal(DEFAULT_AUDIO_VOLUME_LEVEL, 4);
  assert.equal(clampAudioVolumeLevel(-10), 0);
  assert.equal(clampAudioVolumeLevel(2.6), 3);
  assert.equal(clampAudioVolumeLevel(100), 5);
});

test("BGM gains stay ambient and follow the requested perceptual progression", () => {
  const gains = AUDIO_VOLUME_LEVELS.map(bgmGainForLevel);
  assert.equal(gains[0], 0);
  assert.ok(gains[1] <= 0.02);
  for (let index = 1; index < gains.length; index += 1) assert.ok(gains[index] > gains[index - 1]);
  assert.ok(gains[4] >= 0.2 && gains[4] < 0.3);
  assert.ok(gains[5] > gains[4] && gains[5] < 0.5);
  assert.equal(legacyPercentToAudioVolumeLevel(55), 4);
  assert.equal(legacyPercentToAudioVolumeLevel(70), 4);
});

test("September BGM is bundled and uses a sample-accurate Web Audio loop", () => {
  const component = readFileSync(new URL("../components/background-music.tsx", import.meta.url), "utf8");
  const settings = readFileSync(new URL("../app/settings/[section]/page.tsx", import.meta.url), "utf8");
  const middleware = readFileSync(new URL("../middleware.ts", import.meta.url), "utf8");
  const audioUrl = new URL("../public/audio/evoke-september.wav", import.meta.url);
  const descriptor = openSync(audioUrl, "r");
  const header = Buffer.alloc(12);
  readSync(descriptor, header, 0, header.length, 0);
  closeSync(descriptor);

  assert.equal(header.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(header.subarray(8, 12).toString("ascii"), "WAVE");
  assert.match(component, /SEPTEMBER_BACKGROUND_MUSIC_URL = "\/audio\/evoke-september\.wav"/);
  assert.match(component, /webkitAudioContext/);
  assert.match(component, /new Audio\(silentMediaUrl\)/);
  assert.match(component, /silentMedia\.play\(\)/);
  assert.match(component, /createBuffer\(1, 1, context\.sampleRate\)/);
  assert.match(component, /window\.addEventListener\("touchend", unlockPlayback\)/);
  assert.match(component, /document\.addEventListener\("visibilitychange", recoverPlayback\)/);
  assert.match(component, /context\.suspend\(\)\.then\(\(\) => context\.resume\(\)\)/);
  assert.match(component, /createBufferSource\(\)/);
  assert.match(component, /source\.loop = mode !== "harvest"/);
  assert.match(component, /source\.loopStart = 0/);
  assert.match(component, /source\.loopEnd = buffer\.duration/);
  assert.match(middleware, /wav\|mp3\|ogg\|m4a\|aac\|flac/);
  assert.match(settings, /min="0"[\s\S]*max="5"[\s\S]*step="1"/);
  assert.doesNotMatch(settings, /\{value\}%/);
});

test("quiz BGM is fixed, preloaded silently during the countdown, and fades between tracks", () => {
  const component = readFileSync(new URL("../components/background-music.tsx", import.meta.url), "utf8");
  const quizPage = readFileSync(new URL("../app/quiz/page.tsx", import.meta.url), "utf8");
  const audioUrl = new URL("../public/audio/memorimber-quiz-bgm.mp3", import.meta.url);
  const descriptor = openSync(audioUrl, "r");
  const header = Buffer.alloc(3);
  readSync(descriptor, header, 0, header.length, 0);
  closeSync(descriptor);

  assert.ok(header.toString("ascii") === "ID3" || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0));
  assert.match(component, /QUIZ_BACKGROUND_MUSIC_URL = "\/audio\/memorimber-quiz-bgm\.mp3"/);
  assert.match(component, /mode === "countdown"[\s\S]*fadeOutActiveTrack\(context\)[\s\S]*loadBuffer\(context, QUIZ_BACKGROUND_MUSIC_URL\)/);
  assert.match(component, /linearRampToValueAtTime\(0, now \+ QUICK_FADE_OUT_SECONDS\)/);
  const relativeGain = Number(component.match(/QUIZ_RELATIVE_GAIN = ([\d.]+)/)?.[1]);
  const loopStart = Number(component.match(/QUIZ_LOOP_START_SECONDS = ([\d.]+)/)?.[1]);
  const loopEnd = Number(component.match(/QUIZ_LOOP_END_SECONDS = ([\d.]+)/)?.[1]);
  assert.ok(relativeGain > 0 && relativeGain <= 1);
  assert.ok(loopStart >= 0);
  assert.ok(loopEnd > loopStart);
  assert.match(component, /source\.loopStart = QUIZ_LOOP_START_SECONDS/);
  assert.match(component, /source\.loopEnd = Math\.min\(QUIZ_LOOP_END_SECONDS, buffer\.duration\)/);
  assert.match(component, /trackGainTarget = mode === "quiz"[\s\S]*QUIZ_RELATIVE_GAIN[\s\S]*mode === "harvest"[\s\S]*HARVEST_RELATIVE_GAIN[\s\S]*: 1/);
  assert.match(component, /mode === "quiz"[\s\S]*setValueAtTime\(trackGainTarget, now\)[\s\S]*else[\s\S]*linearRampToValueAtTime\(trackGainTarget, now \+ FADE_IN_SECONDS\)/);
  assert.match(component, /source\.start\(0, source\.loopStart\)/);
  assert.match(quizPage, /useState\(3\)/);
  assert.match(quizPage, /setBackgroundMusicMode\(musicMode\)/);
  assert.match(quizPage, /onResults=\{\(\) => setQuizStage\("results"\)\}/);
});

test("harvest flight audio plays once while the monthly BGM is faded out", () => {
  const component = readFileSync(new URL("../components/background-music.tsx", import.meta.url), "utf8");
  const harvest = readFileSync(new URL("../lib/harvest-context.tsx", import.meta.url), "utf8");
  const recall = readFileSync(new URL("../components/memory-recall-dialog.tsx", import.meta.url), "utf8");
  const audioUrl = new URL("../public/audio/september-fr-4926.wav", import.meta.url);
  const descriptor = openSync(audioUrl, "r");
  const header = Buffer.alloc(12);
  readSync(descriptor, header, 0, header.length, 0);
  closeSync(descriptor);

  assert.equal(header.subarray(0, 4).toString("ascii"), "RIFF");
  assert.equal(header.subarray(8, 12).toString("ascii"), "WAVE");
  assert.match(component, /HARVEST_FLIGHT_MUSIC_URL = "\/audio\/september-fr-4926\.wav"/);
  assert.match(component, /HARVEST_RELATIVE_GAIN = 0\.25/);
  assert.match(component, /\{ bgmVolume, soundEffectVolume, preferencesReady \} = usePreferences\(\)/);
  assert.match(component, /desiredSoundEffectGainRef = useRef\(bgmGainForLevel\(soundEffectVolume\)\)/);
  assert.match(component, /mode === "harvest"[\s\S]*desiredSoundEffectGainRef\.current[\s\S]*desiredBgmGainRef\.current/);
  assert.match(component, /playbackModeRef\.current === "harvest"[\s\S]*desiredSoundEffectGainRef\.current[\s\S]*desiredBgmGainRef\.current/);
  assert.match(component, /mode === "countdown" \|\| mode === "harvest"[\s\S]*fadeOutActiveTrack\(context\)/);
  assert.match(component, /source\.loop = mode !== "harvest"/);
  assert.match(harvest, /setBackgroundMusicMode\("harvest"\)[\s\S]*setFlight/);
  assert.match(harvest, /setFlight\(null\)[\s\S]*setBackgroundMusicMode\("default"\)/);
  assert.doesNotMatch(recall, /relaunch|HarvestFlight|useHarvest/);
});

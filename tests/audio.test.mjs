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
  assert.match(component, /if \(!AudioContextConstructor\) return/);
  assert.match(component, /createBufferSource\(\)/);
  assert.match(component, /source\.loop = true/);
  assert.match(component, /source\.loopStart = 0/);
  assert.match(component, /source\.loopEnd = buffer\.duration/);
  assert.match(middleware, /wav\|mp3\|ogg\|m4a\|aac\|flac/);
  assert.match(settings, /min="0"[\s\S]*max="5"[\s\S]*step="1"/);
  assert.doesNotMatch(settings, /\{value\}%/);
});

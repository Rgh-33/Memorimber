"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { bgmGainForLevel } from "@/lib/audio-volume";
import { usePreferences } from "@/lib/preferences-context";

const SEPTEMBER_BACKGROUND_MUSIC_URL = "/audio/evoke-september.wav";
const QUIZ_BACKGROUND_MUSIC_URL = "/audio/memorimber-quiz-bgm.mp3";
const HARVEST_FLIGHT_MUSIC_URL = "/audio/september-fr-4926.wav";
const backgroundMusicUrl = process.env.NEXT_PUBLIC_BGM_URL?.trim() || SEPTEMBER_BACKGROUND_MUSIC_URL;
const QUICK_FADE_OUT_SECONDS = 0.18;
const FADE_IN_SECONDS = 0.24;
const QUIZ_RELATIVE_GAIN = 0.30;
const QUIZ_LOOP_START_SECONDS = 0.0;
const QUIZ_LOOP_END_SECONDS = 97.4;

export type BackgroundMusicMode = "default" | "countdown" | "quiz" | "harvest";

type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext;
type ActiveTrack = {
  url: string;
  source: AudioBufferSourceNode;
  gain: GainNode;
};

const BackgroundMusicContext = createContext<((mode: BackgroundMusicMode) => void) | null>(null);

function getAudioContextConstructor() {
  const audioWindow = window as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  return audioWindow.AudioContext ?? audioWindow.webkitAudioContext;
}

function isIOSDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function createSilentWavUrl() {
  const sampleRate = 8000;
  const sampleCount = sampleRate / 4;
  const dataSize = sampleCount * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataSize, true);

  return URL.createObjectURL(new Blob([buffer], { type: "audio/wav" }));
}

export function useBackgroundMusic() {
  const setBackgroundMusicMode = useContext(BackgroundMusicContext);
  if (!setBackgroundMusicMode) throw new Error("useBackgroundMusic must be used inside BackgroundMusic.");
  return setBackgroundMusicMode;
}

export function BackgroundMusic({ children }: { children: ReactNode }) {
  const { bgmVolume, preferencesReady } = usePreferences();
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const activeTrackRef = useRef<ActiveTrack | null>(null);
  const buffersRef = useRef(new Map<string, AudioBuffer>());
  const bufferPromisesRef = useRef(new Map<string, Promise<AudioBuffer>>());
  const iosMediaUnlockRef = useRef<HTMLAudioElement | null>(null);
  const desiredGainRef = useRef(bgmGainForLevel(bgmVolume));
  const playbackModeRef = useRef<BackgroundMusicMode>("default");
  const switchPlaybackRef = useRef<(mode: BackgroundMusicMode) => Promise<void>>(async () => {});

  const setBackgroundMusicMode = useCallback((mode: BackgroundMusicMode) => {
    playbackModeRef.current = mode;
    void switchPlaybackRef.current(mode);
  }, []);

  useEffect(() => {
    let disposed = false;
    const abortController = new AbortController();
    const buffers = buffersRef.current;
    const bufferPromises = bufferPromisesRef.current;
    let silentMediaUrl: string | null = null;

    if (isIOSDevice()) {
      silentMediaUrl = createSilentWavUrl();
      const silentMedia = new Audio(silentMediaUrl);
      silentMedia.loop = true;
      silentMedia.preload = "auto";
      silentMedia.setAttribute("playsinline", "");
      silentMedia.load();
      iosMediaUnlockRef.current = silentMedia;
    }

    const ensureAudioGraph = () => {
      let context = audioContextRef.current;
      let masterGain = masterGainRef.current;
      if (!context || !masterGain) {
        const AudioContextConstructor = getAudioContextConstructor();
        if (!AudioContextConstructor) return null;
        context = new AudioContextConstructor({ latencyHint: "playback" });
        masterGain = context.createGain();
        masterGain.gain.value = desiredGainRef.current;
        masterGain.connect(context.destination);
        audioContextRef.current = context;
        masterGainRef.current = masterGain;
      }
      return { context, masterGain };
    };

    const loadBuffer = (context: AudioContext, url: string) => {
      const loaded = buffers.get(url);
      if (loaded) return Promise.resolve(loaded);
      const loading = bufferPromises.get(url);
      if (loading) return loading;

      const promise = (async () => {
        const response = await fetch(url, { signal: abortController.signal });
        if (!response.ok) throw new Error(`BGMを読み込めませんでした。(${response.status})`);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        buffers.set(url, buffer);
        return buffer;
      })().finally(() => {
        bufferPromises.delete(url);
      });
      bufferPromises.set(url, promise);
      return promise;
    };

    const fadeOutActiveTrack = (context: AudioContext) => {
      const activeTrack = activeTrackRef.current;
      if (!activeTrack) return;
      activeTrackRef.current = null;
      const now = context.currentTime;
      activeTrack.gain.gain.cancelScheduledValues(now);
      activeTrack.gain.gain.setValueAtTime(activeTrack.gain.gain.value, now);
      activeTrack.gain.gain.linearRampToValueAtTime(0, now + QUICK_FADE_OUT_SECONDS);
      try { activeTrack.source.stop(now + QUICK_FADE_OUT_SECONDS + 0.03); } catch { /* The source may already be stopped. */ }
    };

    const switchPlayback = async (mode: BackgroundMusicMode) => {
      if (disposed) return;
      const graph = ensureAudioGraph();
      if (!graph) return;
      const { context, masterGain } = graph;
      if (context.state !== "running" && context.state !== "closed") void context.resume().catch(() => {});

      if (mode === "countdown" || mode === "harvest") {
        fadeOutActiveTrack(context);
        if (mode === "countdown") {
          void loadBuffer(context, QUIZ_BACKGROUND_MUSIC_URL).catch((error: unknown) => {
            if (!abortController.signal.aborted) console.warn(error);
          });
          return;
        }
      }

      const url = mode === "quiz"
        ? QUIZ_BACKGROUND_MUSIC_URL
        : mode === "harvest"
          ? HARVEST_FLIGHT_MUSIC_URL
          : backgroundMusicUrl;
      if (activeTrackRef.current?.url === url) return;

      let buffer: AudioBuffer;
      try {
        buffer = await loadBuffer(context, url);
      } catch (error) {
        if (!abortController.signal.aborted) console.warn(error);
        return;
      }
      if (disposed || playbackModeRef.current !== mode || activeTrackRef.current?.url === url) return;

      fadeOutActiveTrack(context);
      const trackGain = context.createGain();
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = mode !== "harvest";
      if (mode === "quiz") {
        source.loopStart = QUIZ_LOOP_START_SECONDS;
        source.loopEnd = Math.min(QUIZ_LOOP_END_SECONDS, buffer.duration);
      } else {
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
      }
      source.connect(trackGain);
      trackGain.connect(masterGain);
      source.addEventListener("ended", () => {
        if (activeTrackRef.current?.source === source) activeTrackRef.current = null;
        source.disconnect();
        trackGain.disconnect();
      }, { once: true });

      const now = context.currentTime;
      const trackGainTarget = mode === "quiz" ? QUIZ_RELATIVE_GAIN : 1;
      if (mode === "quiz" || mode === "harvest") {
        trackGain.gain.setValueAtTime(trackGainTarget, now);
      } else {
        trackGain.gain.setValueAtTime(0, now);
        trackGain.gain.linearRampToValueAtTime(trackGainTarget, now + FADE_IN_SECONDS);
      }
      source.start(0, source.loopStart);
      activeTrackRef.current = { url, source, gain: trackGain };
      if (mode === "default") {
        void loadBuffer(context, HARVEST_FLIGHT_MUSIC_URL).catch((error: unknown) => {
          if (!abortController.signal.aborted) console.warn(error);
        });
      }
      if (context.state !== "running" && context.state !== "closed") void context.resume().catch(() => {});
    };

    switchPlaybackRef.current = switchPlayback;
    const unlockPlayback = () => {
      const silentMedia = iosMediaUnlockRef.current;
      if (silentMedia?.paused) void silentMedia.play().catch(() => {});
      void switchPlayback(playbackModeRef.current);

      const context = audioContextRef.current;
      if (!context || context.state === "running" || context.state === "closed") return;
      const silentBuffer = context.createBuffer(1, 1, context.sampleRate);
      const silentSource = context.createBufferSource();
      silentSource.buffer = silentBuffer;
      silentSource.connect(context.destination);
      silentSource.addEventListener("ended", () => silentSource.disconnect(), { once: true });
      silentSource.start(0);
      void context.resume().catch(() => {});
    };
    const recoverPlayback = () => {
      if (document.visibilityState !== "visible") return;
      const silentMedia = iosMediaUnlockRef.current;
      if (silentMedia?.paused) void silentMedia.play().catch(() => {});
      const context = audioContextRef.current;
      if (!context || context.state === "closed") return;
      void switchPlayback(playbackModeRef.current);
      if (context.state === "running") {
        void context.suspend().then(() => context.resume()).catch(() => {});
      } else {
        void context.resume().catch(() => {});
      }
    };
    window.addEventListener("pointerdown", unlockPlayback);
    window.addEventListener("click", unlockPlayback);
    window.addEventListener("touchend", unlockPlayback);
    window.addEventListener("keydown", unlockPlayback);
    window.addEventListener("pageshow", recoverPlayback);
    document.addEventListener("visibilitychange", recoverPlayback);

    return () => {
      disposed = true;
      abortController.abort();
      window.removeEventListener("pointerdown", unlockPlayback);
      window.removeEventListener("click", unlockPlayback);
      window.removeEventListener("touchend", unlockPlayback);
      window.removeEventListener("keydown", unlockPlayback);
      window.removeEventListener("pageshow", recoverPlayback);
      document.removeEventListener("visibilitychange", recoverPlayback);
      switchPlaybackRef.current = async () => {};
      iosMediaUnlockRef.current?.pause();
      iosMediaUnlockRef.current?.removeAttribute("src");
      iosMediaUnlockRef.current = null;
      if (silentMediaUrl) URL.revokeObjectURL(silentMediaUrl);
      try { activeTrackRef.current?.source.stop(); } catch { /* The source may already be stopped. */ }
      activeTrackRef.current?.source.disconnect();
      activeTrackRef.current?.gain.disconnect();
      activeTrackRef.current = null;
      masterGainRef.current?.disconnect();
      masterGainRef.current = null;
      buffers.clear();
      bufferPromises.clear();
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context && context.state !== "closed") void context.close();
    };
  }, []);

  useEffect(() => {
    const nextGain = bgmGainForLevel(bgmVolume);
    desiredGainRef.current = nextGain;
    const context = audioContextRef.current;
    const masterGain = masterGainRef.current;
    if (context && masterGain) {
      const now = context.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(masterGain.gain.value, now);
      masterGain.gain.linearRampToValueAtTime(nextGain, now + 0.12);
    }
    if (preferencesReady && nextGain > 0) void switchPlaybackRef.current(playbackModeRef.current);
  }, [bgmVolume, preferencesReady]);

  return <BackgroundMusicContext.Provider value={setBackgroundMusicMode}>{children}</BackgroundMusicContext.Provider>;
}

"use client";

import { useEffect, useRef } from "react";
import { bgmGainForLevel } from "@/lib/audio-volume";
import { usePreferences } from "@/lib/preferences-context";

const SEPTEMBER_BACKGROUND_MUSIC_URL = "/audio/evoke-september.wav";
const backgroundMusicUrl = process.env.NEXT_PUBLIC_BGM_URL?.trim() || SEPTEMBER_BACKGROUND_MUSIC_URL;

type AudioContextConstructor = new (options?: AudioContextOptions) => AudioContext;

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

export function BackgroundMusic() {
  const { bgmVolume, preferencesReady } = usePreferences();
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const iosMediaUnlockRef = useRef<HTMLAudioElement | null>(null);
  const desiredGainRef = useRef(bgmGainForLevel(bgmVolume));
  const startPlaybackRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let disposed = false;
    const abortController = new AbortController();
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

    const startPlayback = async () => {
      if (disposed) return;

      let context = audioContextRef.current;
      let gain = gainRef.current;
      if (!context || !gain) {
        const AudioContextConstructor = getAudioContextConstructor();
        if (!AudioContextConstructor) return;
        context = new AudioContextConstructor({ latencyHint: "playback" });
        gain = context.createGain();
        gain.gain.value = desiredGainRef.current;
        gain.connect(context.destination);
        audioContextRef.current = context;
        gainRef.current = gain;
      }

      if (context.state !== "running" && context.state !== "closed") void context.resume().catch(() => {});
      if (sourceRef.current) return;
      if (loadPromiseRef.current) return loadPromiseRef.current;

      loadPromiseRef.current = (async () => {
        const response = await fetch(backgroundMusicUrl, { signal: abortController.signal });
        if (!response.ok) throw new Error(`BGMを読み込めませんでした。(${response.status})`);
        const buffer = await context.decodeAudioData(await response.arrayBuffer());
        if (disposed) return;

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
        source.connect(gain);
        source.start(0);
        sourceRef.current = source;
        if (context.state !== "running" && context.state !== "closed") void context.resume().catch(() => {});
      })().catch((error: unknown) => {
        if (!abortController.signal.aborted) console.warn(error);
      }).finally(() => {
        loadPromiseRef.current = null;
      });

      return loadPromiseRef.current;
    };

    startPlaybackRef.current = startPlayback;
    const unlockPlayback = () => {
      const silentMedia = iosMediaUnlockRef.current;
      if (silentMedia?.paused) void silentMedia.play().catch(() => {});
      void startPlayback();

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
      startPlaybackRef.current = async () => {};
      iosMediaUnlockRef.current?.pause();
      iosMediaUnlockRef.current?.removeAttribute("src");
      iosMediaUnlockRef.current = null;
      if (silentMediaUrl) URL.revokeObjectURL(silentMediaUrl);
      try { sourceRef.current?.stop(); } catch { /* The source may already be stopped. */ }
      sourceRef.current?.disconnect();
      gainRef.current?.disconnect();
      sourceRef.current = null;
      gainRef.current = null;
      const context = audioContextRef.current;
      audioContextRef.current = null;
      if (context && context.state !== "closed") void context.close();
    };
  }, []);

  useEffect(() => {
    const nextGain = bgmGainForLevel(bgmVolume);
    desiredGainRef.current = nextGain;
    const context = audioContextRef.current;
    const gain = gainRef.current;
    if (context && gain) {
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(nextGain, now + 0.12);
    }
    if (preferencesReady && nextGain > 0) void startPlaybackRef.current();
  }, [bgmVolume, preferencesReady]);

  return null;
}

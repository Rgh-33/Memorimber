"use client";

import { useEffect, useRef } from "react";
import { bgmGainForLevel } from "@/lib/audio-volume";
import { usePreferences } from "@/lib/preferences-context";

const SEPTEMBER_BACKGROUND_MUSIC_URL = "/audio/evoke-september.wav";
const backgroundMusicUrl = process.env.NEXT_PUBLIC_BGM_URL?.trim() || SEPTEMBER_BACKGROUND_MUSIC_URL;

export function BackgroundMusic() {
  const { bgmVolume, preferencesReady } = usePreferences();
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const loadPromiseRef = useRef<Promise<void> | null>(null);
  const desiredGainRef = useRef(bgmGainForLevel(bgmVolume));
  const startPlaybackRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    let disposed = false;
    const abortController = new AbortController();

    const startPlayback = async () => {
      if (disposed) return;

      let context = audioContextRef.current;
      let gain = gainRef.current;
      if (!context || !gain) {
        const AudioContextConstructor = window.AudioContext;
        if (!AudioContextConstructor) return;
        context = new AudioContextConstructor();
        gain = context.createGain();
        gain.gain.value = desiredGainRef.current;
        gain.connect(context.destination);
        audioContextRef.current = context;
        gainRef.current = gain;
      }

      if (context.state === "suspended") void context.resume().catch(() => {});
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
      })().catch((error: unknown) => {
        if (!abortController.signal.aborted) console.warn(error);
      }).finally(() => {
        loadPromiseRef.current = null;
      });

      return loadPromiseRef.current;
    };

    startPlaybackRef.current = startPlayback;
    const unlockPlayback = () => { void startPlayback(); };
    window.addEventListener("pointerdown", unlockPlayback);
    window.addEventListener("keydown", unlockPlayback);

    return () => {
      disposed = true;
      abortController.abort();
      window.removeEventListener("pointerdown", unlockPlayback);
      window.removeEventListener("keydown", unlockPlayback);
      startPlaybackRef.current = async () => {};
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

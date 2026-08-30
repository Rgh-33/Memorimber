"use client";

import { useEffect, useRef } from "react";
import { usePreferences } from "@/lib/preferences-context";

const backgroundMusicUrl = process.env.NEXT_PUBLIC_BGM_URL;

export function BackgroundMusic() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { bgmVolume } = usePreferences();

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = bgmVolume / 100;
    audio.muted = bgmVolume === 0;
  }, [bgmVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const startPlayback = () => {
      void audio.play().then(() => {
        window.removeEventListener("pointerdown", startPlayback);
        window.removeEventListener("keydown", startPlayback);
      }).catch(() => {
        // Autoplay may be blocked until the first user interaction.
      });
    };

    startPlayback();
    window.addEventListener("pointerdown", startPlayback);
    window.addEventListener("keydown", startPlayback);
    return () => {
      window.removeEventListener("pointerdown", startPlayback);
      window.removeEventListener("keydown", startPlayback);
    };
  }, []);

  if (!backgroundMusicUrl) return null;

  return <audio ref={audioRef} src={backgroundMusicUrl} loop preload="auto" aria-hidden="true" />;
}

"use client";
import { useState } from "react";
export function ClubVideo({ src, captions }: { src: string; captions: string }) {
  const [isPlaying, setIsPlaying] = useState(false);
  if (!isPlaying) {
    return (
      <button type="button" onClick={() => setIsPlaying(true)} aria-label="Vereinsvideo abspielen">
        <svg aria-hidden="true" viewBox="0 0 10 10"><path d="M0 0L10 5L0 10z" /></svg>
      </button>
    );
  }
  return (
    <video controls src={src}>
      <track kind="captions" srcLang="de" src={captions} label="Deutsch" />
    </video>
  );
}

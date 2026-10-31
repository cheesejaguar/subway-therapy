"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AudioContextConstructor = typeof AudioContext;

interface AmbientNodes {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

/**
 * A quiet, optional subway-platform bed: filtered brown noise, generated in
 * the browser. Nothing loads until the visitor asks for it, and it never
 * autoplays. Volume is deliberately low enough to sit under conversation.
 */
export function useAmbientSound() {
  const [enabled, setEnabled] = useState(false);
  const contextRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<AmbientNodes | null>(null);

  const start = useCallback(async (): Promise<boolean> => {
    const windowWithWebkit = window as typeof window & {
      webkitAudioContext?: AudioContextConstructor;
    };
    const Constructor = window.AudioContext ?? windowWithWebkit.webkitAudioContext;
    if (!Constructor) return false;

    const context = contextRef.current ?? new Constructor();
    contextRef.current = context;
    if (context.state === "suspended") {
      await context.resume();
    }
    if (nodesRef.current) return true;

    const bufferSize = Math.floor(context.sampleRate * 4);
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i += 1) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }

    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 420;
    filter.Q.value = 0.4;

    const gain = context.createGain();
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 1.2);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start();

    nodesRef.current = { source, gain };
    return true;
  }, []);

  const stop = useCallback(() => {
    const nodes = nodesRef.current;
    if (nodes) {
      try {
        nodes.source.stop();
      } catch {
        // Already stopped.
      }
      nodes.source.disconnect();
      nodes.gain.disconnect();
      nodesRef.current = null;
    }
    if (contextRef.current) {
      void contextRef.current.suspend();
    }
  }, []);

  const toggle = useCallback(async (): Promise<boolean> => {
    if (enabled) {
      stop();
      setEnabled(false);
      return false;
    }
    const started = await start();
    setEnabled(started);
    return started;
  }, [enabled, start, stop]);

  useEffect(() => {
    return () => {
      stop();
      const context = contextRef.current;
      contextRef.current = null;
      if (context) {
        void context.close();
      }
    };
  }, [stop]);

  return { enabled, toggle };
}

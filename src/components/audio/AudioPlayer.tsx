'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Play, Pause, Volume2, VolumeX, SkipBack } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  title?: string;
  producer?: string;
  coverImage?: string;
  isPlaying?: boolean;
  onPlayToggle?: () => void;
  compact?: boolean;
  accentColor?: string;
}

export default function AudioPlayer({
  src,
  title,
  producer,
  coverImage,
  isPlaying: externalIsPlaying,
  onPlayToggle,
  compact = false,
  accentColor = '#e11d48',
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const [internalPlaying, setInternalPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);

  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalPlaying;

  // Generate waveform from audio
  const generateWaveform = useCallback(async () => {
    if (!src) return;
    try {
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const rawData = audioBuffer.getChannelData(0);

      const samples = compact ? 60 : 100;
      const blockSize = Math.floor(rawData.length / samples);
      const filteredData: number[] = [];

      for (let i = 0; i < samples; i++) {
        let sum = 0;
        for (let j = 0; j < blockSize; j++) {
          sum += Math.abs(rawData[i * blockSize + j]);
        }
        filteredData.push(sum / blockSize);
      }

      const maxVal = Math.max(...filteredData);
      const normalized = filteredData.map(d => d / maxVal);
      setWaveformData(normalized);
      audioContext.close();
    } catch (err) {
      // Fallback: generate random waveform
      const samples = compact ? 60 : 100;
      const fake = Array.from({ length: samples }, () => 0.2 + Math.random() * 0.8);
      setWaveformData(fake);
    }
  }, [src, compact]);

  useEffect(() => {
    generateWaveform();
  }, [generateWaveform]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const barWidth = width / waveformData.length;
    const gap = 1;
    const progress = duration > 0 ? currentTime / duration : 0;

    ctx.clearRect(0, 0, width, height);

    waveformData.forEach((val, i) => {
      const barHeight = val * height * 0.85;
      const x = i * barWidth;
      const y = (height - barHeight) / 2;
      const isPlayed = i / waveformData.length <= progress;

      ctx.fillStyle = isPlayed ? accentColor : 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.roundRect(x + gap / 2, y, barWidth - gap, barHeight, 1);
      ctx.fill();
    });
  }, [waveformData, currentTime, duration, accentColor]);

  // Audio events
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setLoaded(true);
    };
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setInternalPlaying(false);
      onPlayToggle?.();
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [onPlayToggle]);

  // Sync play state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  // Volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  const togglePlay = () => {
    if (onPlayToggle) {
      onPlayToggle();
    } else {
      setInternalPlaying(!internalPlaying);
    }
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || !duration) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = x / rect.width;
    audio.currentTime = progress * duration;
  };

  const restart = () => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0;
    }
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Compact mode (for cards)
  if (compact) {
    return (
      <div className="w-full">
        <audio ref={audioRef} src={src} preload="metadata" />
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-transform hover:scale-110"
            style={{ backgroundColor: accentColor }}
            aria-label={isPlaying ? 'Arrêter la lecture' : 'Lire le beat'}
            aria-pressed={isPlaying}
          >
            {isPlaying ? (
              <Pause size={14} className="text-black" />
            ) : (
              <Play size={14} className="text-black ml-0.5" />
            )}
          </button>
          <canvas
            ref={canvasRef}
            className="flex-1 h-8 cursor-pointer"
            onClick={handleWaveformClick}
            style={{ width: '100%' }}
            role="slider"
            aria-label="Barre de progression audio"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
          />
          <span className="text-[10px] text-gray-400 flex-shrink-0 w-8 text-right">
            {formatTime(duration - currentTime)}
          </span>
        </div>
      </div>
    );
  }

  // Full mode
  return (
    <div className="w-full bg-[#13131a] border border-[#1e1e2e] rounded-2xl overflow-hidden">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Top section with cover + info */}
      {(title || coverImage) && (
        <div className="flex items-center gap-3 p-4 pb-2">
          {coverImage && (
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-800 flex-shrink-0 relative">
              <Image src={coverImage} alt={title} width={48} height={48} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            {title && <p className="text-sm font-bold text-white truncate">{title}</p>}
            {producer && <p className="text-xs text-gray-400 truncate">{producer}</p>}
          </div>
        </div>
      )}

      {/* Waveform */}
      <div className="px-4 py-2">
        <canvas
          ref={canvasRef}
          className="w-full h-16 cursor-pointer rounded-lg"
          onClick={handleWaveformClick}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-4 pb-4">
        <div className="flex items-center gap-2">
          <button onClick={restart} className="text-gray-400 hover:text-white transition p-1" aria-label="Recommencer la lecture">
            <SkipBack size={16} />
          </button>
          <button
            onClick={togglePlay}
            className="w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105"
            style={{ backgroundColor: accentColor }}
            aria-label={isPlaying ? 'Arrêter la lecture' : 'Lire le beat'}
            aria-pressed={isPlaying}
          >
            {isPlaying ? (
              <Pause size={18} className="text-black" />
            ) : (
              <Play size={18} className="text-black ml-0.5" />
            )}
          </button>
        </div>

        {/* Time */}
        <div className="text-xs text-gray-400">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <button onClick={() => setMuted(!muted)} className="text-gray-400 hover:text-white transition" aria-label={muted ? 'Activer le son' : 'Mute'}>
            {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={muted ? 0 : volume}
            onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); }}
            className="w-16 h-1 accent-[#e11d48] cursor-pointer"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}

import React, { useRef, useEffect, useState } from 'react';
import { VideoClip, Template } from '../types';
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react';

interface PlayerProps {
  videoUrl: string;
  clip: VideoClip | null;
  template: Template;
  isPlaying: boolean;
  onPlayPause: () => void;
}

const Player: React.FC<PlayerProps> = ({ videoUrl, clip, template, isPlaying, onPlayPause }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentCaption, setCurrentCaption] = useState<string>("");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(e => console.error("Play failed", e));
    } else {
      video.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clip) return;

    // Jump to start time when clip changes
    video.currentTime = clip.startTime;
    setCurrentTime(clip.startTime);
    video.play().then(() => onPlayPause && !isPlaying && onPlayPause()).catch(() => {});
    
    // Auto-loop logic
    const handleTimeUpdate = () => {
      if (!clip) return;
      setCurrentTime(video.currentTime);
      
      const duration = clip.endTime - clip.startTime;
      const elapsed = video.currentTime - clip.startTime;
      setProgress((elapsed / duration) * 100);

      // Loop
      if (video.currentTime >= clip.endTime) {
        video.currentTime = clip.startTime;
      }

      // Precise Caption Sync
      const relativeTime = video.currentTime - clip.startTime;
      const activeCaption = clip.captions.find(
        c => relativeTime >= c.start && relativeTime <= c.end
      );
      
      if (activeCaption) {
        setCurrentCaption(activeCaption.text);
      } else {
        setCurrentCaption("");
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [clip]); // Dependency on clip ID to reset

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative group w-full max-w-[350px] mx-auto aspect-[9/16] bg-black rounded-3xl overflow-hidden shadow-2xl border-4 border-dark-700">
      {/* Video Element */}
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full h-full object-cover"
        playsInline
        onClick={onPlayPause}
      />

      {/* Captions Overlay */}
      {currentCaption && (
        <div className={`absolute pointer-events-none transition-all duration-100 ${template.containerClass}`}>
          <div className={`${template.textClass}`}>
            {currentCaption}
          </div>
        </div>
      )}

      {/* Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        {/* Progress Bar */}
        <div className="w-full h-1 bg-gray-600 rounded-full mb-4 overflow-hidden">
          <div 
            className="h-full bg-brand-500 transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-white">
          <button onClick={onPlayPause} className="p-2 hover:bg-white/20 rounded-full transition">
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          
          <span className="text-xs font-mono">
             {formatTime(currentTime)} / {clip ? formatTime(clip.endTime) : "0:00"}
          </span>

          <button onClick={toggleMute} className="p-2 hover:bg-white/20 rounded-full transition">
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>
      
      {/* Play Overlay Button (Center) */}
      {!isPlaying && (
        <div 
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
          onClick={onPlayPause}
        >
          <div className="p-4 bg-white/20 backdrop-blur-md rounded-full border border-white/30 text-white">
            <Play size={32} fill="currentColor" />
          </div>
        </div>
      )}
    </div>
  );
};

export default Player;
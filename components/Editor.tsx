
import React, { useState } from 'react';
import { VideoClip, Template, ClipStyle } from '../types';
import { TEMPLATES } from '../constants';
import Player from './Player';
import { Download, Sparkles, Wand2, Scissors, Share2, AlertCircle } from 'lucide-react';

interface EditorProps {
  videoUrl: string;
  clips: VideoClip[];
  onReset: () => void;
  onExportCheck: () => boolean;
  onExportSuccess: () => void;
}

const Editor: React.FC<EditorProps> = ({ videoUrl, clips, onReset, onExportCheck, onExportSuccess }) => {
  const [selectedClipId, setSelectedClipId] = useState<string>(clips[0]?.id || "");
  const [selectedTemplateId, setSelectedTemplateId] = useState<ClipStyle>(ClipStyle.MODERN);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const currentClip = clips.find(c => c.id === selectedClipId) || null;
  const currentTemplate = TEMPLATES.find(t => t.id === selectedTemplateId) || TEMPLATES[0];

  // Helper to draw captions on canvas matching the CSS styles
  const drawCaption = (ctx: CanvasRenderingContext2D, time: number, clip: VideoClip, template: Template) => {
    const relativeTime = time - clip.startTime;
    const activeCaption = clip.captions.find(c => relativeTime >= c.start && relativeTime <= c.end);
    
    if (!activeCaption) return;
    const text = activeCaption.text;

    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let x = w / 2;
    let y = h * 0.75; // Default bottom position

    switch (template.id) {
      case ClipStyle.MODERN:
        ctx.font = 'bold 60px sans-serif';
        const metrics = ctx.measureText(text);
        const padding = 30;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        // Draw rounded rect approximation
        ctx.fillRect(x - metrics.width/2 - padding, y - 50, metrics.width + padding*2, 100);
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 10;
        ctx.fillText(text, x, y);
        ctx.shadowBlur = 0;
        break;

      case ClipStyle.NEON:
        y = h * 0.7;
        ctx.font = 'italic 900 70px sans-serif';
        ctx.shadowColor = '#d946ef'; // Fuchsia
        ctx.shadowBlur = 30;
        ctx.fillStyle = '#fde047'; // Yellow
        ctx.fillText(text.toUpperCase(), x, y);
        ctx.shadowBlur = 0;
        // Simple stroke for extra readability
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#a21caf';
        ctx.strokeText(text.toUpperCase(), x, y);
        break;

      case ClipStyle.BOLD:
        y = h * 0.3; // Top
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-2 * Math.PI / 180); // -2 deg rotation
        ctx.font = '900 80px serif';
        const mBold = ctx.measureText(text.toUpperCase());
        ctx.fillStyle = '#dc2626'; // Red
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 20;
        ctx.fillRect(-mBold.width/2 - 30, -60, mBold.width + 60, 120);
        ctx.fillStyle = '#ffffff';
        ctx.shadowBlur = 0;
        ctx.fillText(text.toUpperCase(), 0, 0);
        ctx.restore();
        break;

      case ClipStyle.MINIMAL:
        y = h * 0.85;
        ctx.font = '500 45px monospace';
        const mMin = ctx.measureText(text);
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x - mMin.width/2 - 20, y - 40, mMin.width + 40, 80);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.fillText(text, x, y);
        break;

      case ClipStyle.GAME:
         y = h * 0.8;
         ctx.font = '900 70px sans-serif';
         ctx.lineWidth = 8;
         ctx.lineJoin = 'round';
         ctx.strokeStyle = '#000000';
         ctx.strokeText(text, x, y);
         ctx.fillStyle = '#4ade80'; // Green
         ctx.fillText(text, x, y);
         // Add text shadow
         ctx.shadowColor = '#000';
         ctx.shadowOffsetX = 4;
         ctx.shadowOffsetY = 4;
         ctx.shadowBlur = 0;
         ctx.fillText(text, x, y);
         ctx.shadowColor = 'transparent';
         break;
    }
  };

  const handleExport = async () => {
    // 1. Check Usage Limit
    if (!onExportCheck()) return;

    if (!currentClip || !videoUrl) return;
    
    // Stop preview if playing
    setIsPlaying(false);
    setIsExporting(true);
    setExportProgress(0);

    const canvas = document.createElement('canvas');
    // Shorts resolution
    canvas.width = 1080;
    canvas.height = 1920; 
    const ctx = canvas.getContext('2d');
    if(!ctx) return;

    // Create a detached video element for rendering
    const exportVid = document.createElement('video');
    exportVid.src = videoUrl;
    exportVid.crossOrigin = "anonymous";
    exportVid.muted = false; // We want audio
    exportVid.playsInline = true;

    // Load metadata
    await new Promise((resolve) => {
        exportVid.onloadedmetadata = () => resolve(true);
    });

    // Setup Audio Context for mixing
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const actx = new AudioContext();
    const source = actx.createMediaElementSource(exportVid);
    const dest = actx.createMediaStreamDestination();
    
    source.connect(dest);
    source.connect(actx.destination); // Let user hear the export process

    // Create stream from canvas + audio
    const stream = canvas.captureStream(30); // 30 FPS
    if (dest.stream.getAudioTracks().length > 0) {
        stream.addTrack(dest.stream.getAudioTracks()[0]);
    }

    const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
    });
    
    const chunks: Blob[] = [];
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
    
    recorder.onstop = () => {
        // Create Blob and Download
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ClipGenius_${currentClip.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.webm`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Cleanup
        setIsExporting(false);
        actx.close();
        exportVid.remove();
        canvas.remove();

        // 2. Increment Usage Count
        onExportSuccess();
    };

    // Prepare Video
    exportVid.currentTime = currentClip.startTime;
    
    recorder.start();
    
    try {
      await exportVid.play();
    } catch (e) {
      console.error("Export play failed", e);
      setIsExporting(false);
      return;
    }

    // Render Loop
    const renderFrame = () => {
        // Check if finished or cancelled
        if (exportVid.paused || exportVid.ended || exportVid.currentTime >= currentClip.endTime) {
            recorder.stop();
            exportVid.pause();
            return;
        }

        // Update Progress
        const progress = ((exportVid.currentTime - currentClip.startTime) / (currentClip.endTime - currentClip.startTime)) * 100;
        setExportProgress(Math.min(progress, 100));

        // 1. Clear Canvas
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 2. Draw Video (Cover Logic for 9:16)
        const vidRatio = exportVid.videoWidth / exportVid.videoHeight;
        const canvasRatio = canvas.width / canvas.height;
        let drawW, drawH, drawX, drawY;

        if (vidRatio > canvasRatio) {
            // Video is wider than canvas (landscape -> portrait)
            drawH = canvas.height;
            drawW = drawH * vidRatio;
            drawX = (canvas.width - drawW) / 2;
            drawY = 0;
        } else {
            drawW = canvas.width;
            drawH = drawW / vidRatio;
            drawX = 0;
            drawY = (canvas.height - drawH) / 2;
        }
        ctx.drawImage(exportVid, drawX, drawY, drawW, drawH);

        // 3. Draw Overlays
        drawCaption(ctx, exportVid.currentTime, currentClip, currentTemplate);

        requestAnimationFrame(renderFrame);
    };

    renderFrame();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Export Overlay */}
      {isExporting && (
        <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-8 backdrop-blur-sm">
           <div className="w-full max-w-md space-y-6 text-center">
             <div className="relative w-24 h-24 mx-auto">
                <svg className="w-full h-full" viewBox="0 0 100 100">
                  <circle className="text-gray-700 stroke-current" strokeWidth="8" cx="50" cy="50" r="40" fill="transparent"></circle>
                  <circle 
                    className="text-brand-500 stroke-current transition-all duration-200 ease-linear" 
                    strokeWidth="8" 
                    strokeLinecap="round" 
                    cx="50" 
                    cy="50" 
                    r="40" 
                    fill="transparent" 
                    strokeDasharray="251.2" 
                    strokeDashoffset={251.2 - (251.2 * exportProgress) / 100}
                    transform="rotate(-90 50 50)"
                  ></circle>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-xl">
                  {Math.round(exportProgress)}%
                </div>
             </div>
             <h3 className="text-2xl font-bold text-white">Rendering Short...</h3>
             <p className="text-gray-400">Please wait while we bake your video with captions.</p>
             <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm bg-yellow-400/10 p-3 rounded-lg border border-yellow-400/20">
                <AlertCircle size={16} />
                <span>Audio is playing for synchronization.</span>
             </div>
           </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-dark-700 bg-dark-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
            <Scissors size={18} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">ClipGenius <span className="text-brand-400 text-sm font-normal">Editor</span></h1>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={onReset}
                disabled={isExporting}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition disabled:opacity-50"
            >
                Start Over
            </button>
            <button 
                onClick={handleExport}
                disabled={isExporting}
                className="flex items-center gap-2 px-6 py-2 bg-white text-dark-900 font-bold rounded-lg hover:bg-gray-200 transition disabled:opacity-50"
            >
                <Download size={18} />
                Export Short
            </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar: Clips List */}
        <aside className="w-80 bg-dark-800 border-r border-dark-700 flex flex-col overflow-hidden hidden md:flex">
          <div className="p-4 border-b border-dark-700">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Sparkles size={14} className="text-brand-400" />
              AI Detected Moments
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {clips.map((clip) => (
              <div 
                key={clip.id}
                onClick={() => {
                  setSelectedClipId(clip.id);
                  setIsPlaying(true);
                }}
                className={`
                  p-4 rounded-xl cursor-pointer border transition-all duration-200
                  ${selectedClipId === clip.id 
                    ? 'bg-brand-900/30 border-brand-500 ring-1 ring-brand-500' 
                    : 'bg-dark-700 border-transparent hover:border-dark-600 hover:bg-dark-600'}
                `}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`
                    text-xs font-bold px-2 py-0.5 rounded
                    ${clip.viralScore > 90 ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}
                  `}>
                    Score: {clip.viralScore}
                  </span>
                  <span className="text-xs text-gray-500 font-mono">
                    {Math.round(clip.endTime - clip.startTime)}s
                  </span>
                </div>
                <h3 className="font-semibold text-white mb-1 line-clamp-1">{clip.title}</h3>
                <p className="text-xs text-gray-400 line-clamp-2">{clip.description}</p>
              </div>
            ))}
          </div>
        </aside>

        {/* Center: Preview */}
        <main className="flex-1 bg-dark-900 p-8 flex items-center justify-center relative">
          <div className="absolute top-4 text-center">
            <p className="text-sm text-gray-500 mb-1">Previewing: <span className="text-white font-medium">{currentClip?.title}</span></p>
          </div>
          <Player 
            videoUrl={videoUrl}
            clip={currentClip}
            template={currentTemplate}
            isPlaying={isPlaying}
            onPlayPause={() => setIsPlaying(!isPlaying)}
          />
        </main>

        {/* Right Sidebar: Customization */}
        <aside className="w-80 bg-dark-800 border-l border-dark-700 flex flex-col overflow-y-auto z-10">
          <div className="p-4 border-b border-dark-700">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <Wand2 size={14} className="text-brand-400" />
              Styles & Captions
            </h2>
          </div>
          
          <div className="p-6 space-y-6">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-3 block">Caption Style</label>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTemplateId(tpl.id)}
                    className={`
                      relative h-20 rounded-lg overflow-hidden border-2 transition-all group
                      ${selectedTemplateId === tpl.id ? 'border-brand-500 scale-105 shadow-lg shadow-brand-900/20' : 'border-dark-600 opacity-70 hover:opacity-100'}
                    `}
                  >
                    <div className={`absolute inset-0 ${tpl.previewColor} opacity-20`}></div>
                    <div className="absolute inset-0 flex items-center justify-center p-2">
                      <span className={`text-sm ${tpl.fontClass} text-white truncate max-w-full px-1`}>
                        Abc
                      </span>
                    </div>
                    <div className="absolute bottom-1 left-0 right-0 text-[10px] text-center text-gray-300 bg-black/40">
                        {tpl.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-4 bg-dark-700/50 rounded-xl border border-dark-600">
                <h3 className="text-sm font-medium text-white mb-2">Caption Preview</h3>
                <div className="space-y-2">
                    {currentClip?.captions.slice(0, 3).map((cap, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-400 italic border-l-2 border-dark-500 pl-2">
                            <span>"{cap.text}"</span>
                            <span className="text-gray-600 font-mono">{cap.start}s</span>
                        </div>
                    ))}
                    <div className="text-xs text-gray-600 pl-2">...</div>
                </div>
            </div>

            <div>
                <button className="w-full flex items-center justify-center gap-2 py-3 border border-dark-600 rounded-lg text-gray-300 hover:bg-dark-700 hover:text-white transition group">
                    <Share2 size={16} className="group-hover:text-brand-400 transition-colors" />
                    Social Optimization
                </button>
                <p className="text-[10px] text-gray-500 mt-2 text-center">
                   Uses AI to format tags and titles (Coming Soon)
                </p>
            </div>

          </div>
        </aside>
      </div>
    </div>
  );
};

export default Editor;

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Check, Move, RefreshCw } from 'lucide-react';

interface AvatarCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (croppedDataUrl: string) => void;
}

export const AvatarCropModal: React.FC<AvatarCropModalProps> = ({
  isOpen,
  imageSrc,
  onClose,
  onCropComplete,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset state whenever a new image is loaded
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, imageSrc]);

  if (!isOpen || !imageSrc) return null;

  // Mouse & Touch Drag Handlers
  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX - position.x, y: clientY - position.y });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    setPosition({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    });
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      e.preventDefault();
      handleMove(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => handleEnd();

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      handleStart(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging && e.touches.length === 1) {
      handleMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => handleEnd();

  // Reset adjustments
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  // Generate high-resolution cropped canvas data URL
  const handleApplyCrop = () => {
    const img = imageRef.current;
    if (!img) return;

    const outputSize = 400; // Crisp 400x400 avatar output
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Background fill (white)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outputSize, outputSize);

    // Save state
    ctx.save();

    // Center of output canvas
    ctx.translate(outputSize / 2, outputSize / 2);

    // Apply rotation
    ctx.rotate((rotation * Math.PI) / 180);

    // Scaling ratio based on preview viewport size (280px circle)
    const previewViewportSize = 280;
    const scaleFactor = outputSize / previewViewportSize;

    ctx.translate(position.x * scaleFactor, position.y * scaleFactor);
    ctx.scale(zoom * scaleFactor, zoom * scaleFactor);

    // Draw image centered
    const imgWidth = img.naturalWidth || img.width;
    const imgHeight = img.naturalHeight || img.height;

    // Fit image inside base viewport
    const baseFitScale = Math.max(previewViewportSize / imgWidth, previewViewportSize / imgHeight);
    const drawWidth = imgWidth * baseFitScale;
    const drawHeight = imgHeight * baseFitScale;

    ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

    ctx.restore();

    // Convert canvas to optimized JPEG
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    onCropComplete(croppedDataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-amber-300/60 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-[#121212] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Move className="w-5 h-5 text-[#D4AF37]" />
            <h3 className="font-extrabold text-sm sm:text-base tracking-wide text-[#D4AF37]">
              Ajustar Foto de Perfil
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-gray-300 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 text-center">
          <p className="text-xs font-bold text-[#121212]">
            Arraste para enquadrar o rosto • Use o zoom para aproximar
          </p>
        </div>

        {/* Viewport Area */}
        <div
          ref={containerRef}
          className="relative w-full h-[320px] bg-neutral-900 overflow-hidden flex items-center justify-center select-none touch-none cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Draggable & Scalable Image */}
          <div
            className="absolute transition-transform duration-75 ease-out flex items-center justify-center pointer-events-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            }}
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop target"
              className="max-w-none max-h-none object-contain"
              style={{
                width: '280px',
                height: '280px',
                objectFit: 'cover',
              }}
              draggable={false}
            />
          </div>

          {/* Circular Crop Overlay Mask */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Outer dark overlay */}
            <div className="w-[280px] h-[280px] rounded-full border-4 border-[#D4AF37] shadow-[0_0_0_9999px_rgba(0,0,0,0.65)] ring-2 ring-white/40"></div>
          </div>
        </div>

        {/* Controls Section */}
        <div className="p-5 space-y-4 bg-white">
          {/* Zoom Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-gray-700">
              <span className="flex items-center gap-1">
                <ZoomIn className="w-4 h-4 text-[#D4AF37]" />
                Zoom (Aproximar)
              </span>
              <span>{Math.round(zoom * 100)}%</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.8, z - 0.15))}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg cursor-pointer"
                title="Afastar"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <input
                type="range"
                min="0.8"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#D4AF37]"
              />
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(3, z + 0.15))}
                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg cursor-pointer"
                title="Aproximar"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Additional Action Controls (Rotate & Reset) */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCw className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>Girar 90°</span>
            </button>

            <button
              type="button"
              onClick={handleReset}
              className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Centralizar</span>
            </button>
          </div>

          {/* Modal Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleApplyCrop}
              className="py-2.5 px-5 bg-[#00C853] hover:bg-[#00E676] text-[#121212] font-black text-xs rounded-xl shadow-md transition flex items-center gap-1.5 cursor-pointer border border-[#00A843]"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Confirmar Foto Ajustada</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

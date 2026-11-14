import React, { useState } from 'react';

interface SmartImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackLabel?: string;
}

function buildSvgFallback(label: string): string {
  const safeText = (label || 'Restaurant Hub')
    .replace(/[<>&"']/g, '')
    .slice(0, 26);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#5b21b6"/>
        <stop offset="55%" stop-color="#7c3aed"/>
        <stop offset="100%" stop-color="#9333ea"/>
      </linearGradient>
    </defs>
    <rect width="600" height="400" fill="url(#g)"/>
    <circle cx="300" cy="165" r="54" fill="rgba(255,255,255,0.18)"/>
    <path d="M282 140 v50 M274 140 v20 a8 8 0 0 0 16 0 v-20 M312 140 c0 15 10 20 10 32 v18" stroke="#ffffff" stroke-width="6" stroke-linecap="round" fill="none"/>
    <text x="300" y="265" text-anchor="middle" fill="#ffffff" font-family="Plus Jakarta Sans, Inter, sans-serif" font-weight="800" font-size="24">${safeText}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const SmartImage: React.FC<SmartImageProps> = ({
  src,
  alt = '',
  fallbackLabel,
  className = '',
  ...rest
}) => {
  const [failed, setFailed] = useState(false);
  const label = fallbackLabel || alt || 'Fresh Dish';
  const effectiveSrc = !src || failed ? buildSvgFallback(label) : src;

  return (
    <img
      src={effectiveSrc}
      alt={alt}
      className={className}
      onError={() => {
        if (!failed) setFailed(true);
      }}
      {...rest}
    />
  );
};

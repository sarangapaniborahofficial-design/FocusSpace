import React from 'react';
import type { LaunchLink } from '../types';

export interface BrandIconProps {
  size?: number;
  className?: string;
}

/** Official Spotify Logo (Vibrant green circle with 3 curved sound waves) */
export function SpotifyLogo({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Spotify"
    >
      <circle cx="12" cy="12" r="11" fill="#1DB954" />
      <path
        d="M16.9 9.1c-3.1-1.8-8.2-2-11.2-1.1-.5.1-.9-.1-1.1-.6-.1-.5.1-.9.6-1.1 3.5-1.1 9.2-.8 12.8 1.3.4.3.6.8.3 1.2-.2.4-.7.6-1.4.3zm-.3 3.1c-.2.4-.7.5-1.1.3-2.6-1.6-6.6-2.1-9.7-1.1-.4.1-.9-.1-1-.5-.1-.4.1-.9.5-1 3.6-1.1 8-.6 11 1.2.4.3.5.7.3 1.1zm-1.2 3.1c-.2.3-.6.4-.9.2-2.3-1.4-5.2-1.7-8.6-.9-.3.1-.7-.1-.8-.4-.1-.3.1-.7.4-.8 3.7-.9 6.9-.5 9.5 1 .3.2.4.6.4.9z"
        fill="#000000"
      />
    </svg>
  );
}

/** Official YouTube Logo (Red rounded rectangle with centered white play triangle) */
export function YouTubeLogo({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="YouTube"
    >
      <path
        d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.5 12 3.5 12 3.5s-7.505 0-9.377.55a3.016 3.016 0 0 0-2.122 2.136C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.55 9.376.55 9.376.55s7.505 0 9.377-.55a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
        fill="#FF0000"
      />
      <polygon points="9.545,15.568 15.818,12 9.545,8.432" fill="#FFFFFF" />
    </svg>
  );
}

/** Official Discord Logo ("Clyde" game controller in official Blurple #5865F2) */
export function DiscordLogo({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Discord"
    >
      <rect width="24" height="24" rx="6" fill="#5865F2" />
      <path
        d="M18.8 6.5A16.8 16.8 0 0 0 14.6 5.2c-.2.4-.4.8-.5 1.1a15.7 15.7 0 0 0-4.8 0c-.2-.3-.4-.7-.5-1.1a16.8 16.8 0 0 0-4.2 1.3C2 10.6 1.6 14.5 1.8 18.3a17 17 0 0 0 5.2 2.6c.4-.6.8-1.2 1.1-1.8-1.8-.7-2.2-1.7-2.2-1.7.2.1.3.2.5.3 4.1 1.9 8.6 1.9 12.7 0 .2-.1.3-.2.5-.3 0 0-.5 1.1-2.2 1.7.3.6.7 1.2 1.1 1.8a17 17 0 0 0 5.2-2.6c.4-4.5-.7-8.3-3-11.8zM8.7 15c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2z"
        fill="#FFFFFF"
      />
    </svg>
  );
}

/** Official VS Code Logo (Microsoft Visual Studio Code folded ribbon chevron) */
export function VSCodeLogo({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="VS Code"
    >
      <path
        d="M17.5 2.5L12 7.2 6.6 3.2 2.6 5.2c-.4.2-.6.7-.6 1.1v11.4c0 .5.2.9.6 1.1l4 2 5.4-4 5.5 4.8c.6.5 1.5.5 2.1 0l3.8-3.3c.4-.4.6-.9.6-1.5V7.2c0-.6-.2-1.1-.6-1.5l-3.8-3.2c-.6-.5-1.5-.5-2.1 0z"
        fill="#007ACC"
      />
      <path
        d="M18.8 6.8L12.5 12.3l6.3 5.5c.3-.3.5-.7.5-1.1V7.9c0-.4-.2-.8-.5-1.1z"
        fill="#1F9CF0"
      />
      <path
        d="M12.5 12.3L4.8 5.8 3.2 6.6v10.8l1.6.8 7.7-5.9z"
        fill="#0065A9"
        fillOpacity="0.4"
      />
    </svg>
  );
}

/** Official Cursor Logo (Crisp isometric faceted 3D diamond/cube logo) */
export function CursorLogo({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Cursor"
    >
      <rect width="24" height="24" rx="6" fill="#141414" />
      <path d="M12 4L19 8V16L12 20L5 16V8L12 4Z" fill="#262626" />
      <path d="M12 4L19 8L12 12L5 8L12 4Z" fill="#E5E5E5" />
      <path d="M5 8L12 12V20L5 16V8Z" fill="#A3A3A3" />
      <path d="M19 8L12 12V20L19 16V8Z" fill="#737373" />
    </svg>
  );
}

/** Official GitHub Logo (Invertocat silhouette in currentColor) */
export function GitHubLogo({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="GitHub"
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

/** Official Obsidian Logo (Faceted purple crystal gemstone) */
export function ObsidianLogo({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Obsidian"
    >
      <path
        d="M12.8 2.2a2 2 0 0 0-1.6 0L4.3 5.4a2 2 0 0 0-1.2 1.8v8.6a2 2 0 0 0 1 1.8l7 4.2a2 2 0 0 0 2 0l7-4.2a2 2 0 0 0 1-1.8V7.2a2 2 0 0 0-1.2-1.8L12.8 2.2z"
        fill="#7C3AED"
      />
      <path
        d="M12 2.3v19.4l7-4.2a2 2 0 0 0 1-1.8V7.2a2 2 0 0 0-1.2-1.8L12 2.3z"
        fill="#6D28D9"
      />
      <path d="M12 7l4 3-4 3-4-3 4-3z" fill="#DDD6FE" />
      <path d="M12 13l4 3-4 3-4-3 4-3z" fill="#C4B5FD" />
    </svg>
  );
}

/** Official Antigravity Logo (DeepMind radiant multi-tone star mark) */
export function AntigravityLogo({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Antigravity"
    >
      <defs>
        <linearGradient id="antigravity-brand-grad" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff5526" />
          <stop offset="0.5" stopColor="#a3e635" />
          <stop offset="1" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      <path
        d="M12 2L14.6 9.4L22 12L14.6 14.6L12 22L9.4 14.6L2 12L9.4 9.4L12 2Z"
        fill="url(#antigravity-brand-grad)"
      />
      <circle cx="12" cy="12" r="2.2" fill="#FFFFFF" />
    </svg>
  );
}

/** Official Figma Logo (5-tile geometric layout) */
export function FigmaLogo({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Figma"
    >
      <path d="M8 24c2.2 0 4-1.8 4-4v-4H8a4 4 0 0 0 0 8z" fill="#0ACF83" />
      <path d="M4 16a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" fill="#A259FF" />
      <path d="M4 8a4 4 0 0 1 4-4h4v8H8a4 4 0 0 1-4-4z" fill="#F24E1E" />
      <path d="M12 0h4a4 4 0 0 1 0 8h-4V0z" fill="#FF7262" />
      <path d="M20 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" fill="#1ABCFE" />
    </svg>
  );
}

/** Official Slack Logo (4-color hashtag mark) */
export function SlackLogo({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Slack"
    >
      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52-2.523 2.52 2.52 0 0 1 2.52-2.52h2.52v5.043H5.042z" fill="#E01E5A" />
      <path d="M8.833 15.165a2.528 2.528 0 0 1 2.521-2.523 2.52 2.52 0 0 1 2.521 2.523v6.313A2.528 2.528 0 0 1 11.354 24a2.52 2.52 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A" />
      <path d="M8.833 5.042a2.528 2.528 0 0 1-2.52-2.52 2.52 2.52 0 0 1 2.52-2.522h2.521v5.042H8.833z" fill="#36C5F0" />
      <path d="M8.833 8.833a2.528 2.528 0 0 1 2.521-2.52 2.52 2.52 0 0 1 2.521 2.52v6.313a2.528 2.528 0 0 1-2.521 2.521 2.52 2.52 0 0 1-2.521-2.521V8.833z" fill="#36C5F0" />
      <path d="M18.958 8.833a2.528 2.528 0 0 1 2.522 2.52 2.52 2.52 0 0 1-2.522 2.521h-2.521V8.833h2.521z" fill="#2EB67D" />
      <path d="M15.167 8.833a2.528 2.528 0 0 1-2.521 2.52 2.52 2.52 0 0 1-2.521-2.52V2.522A2.528 2.528 0 0 1 12.646 0a2.52 2.52 0 0 1 2.521 2.522v6.311z" fill="#2EB67D" />
      <path d="M15.167 18.958a2.528 2.528 0 0 1 2.521 2.522 2.52 2.52 0 0 1-2.521 2.52h-2.521v-5.042h2.521z" fill="#ECB22E" />
      <path d="M15.167 15.165a2.528 2.528 0 0 1-2.521 2.523 2.52 2.52 0 0 1-2.521-2.523V8.852a2.528 2.528 0 0 1 2.521-2.521 2.52 2.52 0 0 1 2.521 2.521v6.313z" fill="#ECB22E" />
    </svg>
  );
}

/** Official Notion Logo (Monochrome N block) */
export function NotionLogo({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Notion"
    >
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l11.43-.84c1.168-.093 1.634.373 1.4.933l-2.428 14.195c-.187.933-.747 1.306-1.587 1.353l-12.083.746c-.934.047-1.4-.42-1.214-1.353l2.054-15.454zM8.847 7.054c-.7.047-.793.42-.746.886l1.26 9.479c.047.467.373.654.793.607l1.493-.093c.42-.047.56-.42.513-.887l-1.26-9.479c-.046-.467-.373-.653-.793-.606L8.847 7.054zm5.556-.373c-.607.047-.793.42-.653.933l2.844 7.237-1.26-7.33c-.093-.56-.467-.887-.933-.84l-1.447.093c-.466.047-.653.373-.56.933l1.913 10.131c.093.56.466.84.933.793l1.867-.14c.607-.047.84-.42.7-.933l-2.847-7.238 1.26 7.33c.094.56.467.887.934.84l1.446-.093c.467-.047.654-.373.56-.933L16.793 7.38c-.093-.56-.466-.84-.933-.793l-1.457.094z" />
    </svg>
  );
}

/** Developer Terminal Logo (>_) */
export function TerminalLogo({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Terminal"
    >
      <rect width="24" height="24" rx="6" fill="#18181B" />
      <path d="M6 8L10 12L6 16" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 16H18" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** Universal Web / Browser Logo */
export function WebBrowserLogo({ size = 20, className = '' }: BrandIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Web Link"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.8" />
      <path d="M2 12H22" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2A15.3 15.3 0 0 1 16 12A15.3 15.3 0 0 1 12 22A15.3 15.3 0 0 1 8 12A15.3 15.3 0 0 1 12 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

/**
 * Automatically inspects a launch link and returns the corresponding official brand logo.
 */
export function resolveBrandLogo(link: LaunchLink, size = 20): React.ReactElement {
  const label = link.label?.toLowerCase() ?? '';
  const url = link.url?.toLowerCase() ?? '';
  const icon = link.icon?.toLowerCase() ?? '';

  if (label.includes('spotify') || url.includes('spotify') || icon === 'spotify') {
    return <SpotifyLogo size={size} />;
  }
  if (label.includes('youtube') || url.includes('youtube') || icon === 'youtube') {
    return <YouTubeLogo size={size} />;
  }
  if (label.includes('discord') || url.includes('discord') || icon === 'discord') {
    return <DiscordLogo size={size} />;
  }
  if (label.includes('antigravity') || url.includes('antigravity') || icon === 'antigravity') {
    return <AntigravityLogo size={size} />;
  }
  if (label.includes('cursor') || url.includes('cursor') || icon === 'cursor') {
    return <CursorLogo size={size} />;
  }
  if (label.includes('vscode') || label.includes('vs code') || url.includes('vscode') || icon === 'code') {
    return <VSCodeLogo size={size} />;
  }
  if (label.includes('github') || url.includes('github') || icon === 'github') {
    return <GitHubLogo size={size} />;
  }
  if (label.includes('obsidian') || url.includes('obsidian') || icon === 'obsidian' || icon === 'book') {
    return <ObsidianLogo size={size} />;
  }
  if (label.includes('figma') || url.includes('figma') || icon === 'figma') {
    return <FigmaLogo size={size} />;
  }
  if (label.includes('slack') || url.includes('slack') || icon === 'slack') {
    return <SlackLogo size={size} />;
  }
  if (label.includes('notion') || url.includes('notion') || icon === 'notion') {
    return <NotionLogo size={size} />;
  }
  if (label.includes('terminal') || label.includes('bash') || url.includes('terminal') || icon === 'terminal') {
    return <TerminalLogo size={size} />;
  }

  // Fallback to web browser or generic
  return <WebBrowserLogo size={size} />;
}

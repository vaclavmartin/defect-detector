# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Defect Detector is a Next.js application for analyzing metallic structures through image processing. Users upload photos of metallic structures, and the app detects dark and light spots indicating defects, marking them with circles and annotations. The app provides configurable detection parameters including minimum spot size and contrast thresholds.

## Tech Stack

- **Framework**: Next.js 16.0.1 (App Router)
- **React**: 19.2.0
- **TypeScript**: 5.x (strict mode enabled)
- **Styling**: Tailwind CSS v4 with PostCSS
- **Fonts**: Geist Sans and Geist Mono from next/font

## Development Commands

```bash
# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Architecture

### App Router Structure

Uses Next.js App Router with the following structure:
- `app/layout.tsx` - Root layout with font configuration (Geist Sans, Geist Mono) and metadata
- `app/page.tsx` - Main page component
- `app/globals.css` - Global styles with Tailwind CSS v4 and theme variables

### TypeScript Configuration

- **Path alias**: `@/*` maps to root directory for cleaner imports
- **Strict mode**: Enabled for type safety
- **Target**: ES2017
- **Module resolution**: bundler mode

### Styling System

- Uses Tailwind CSS v4 with `@import "tailwindcss"` syntax
- Theme configuration via `@theme inline` in globals.css
- CSS variables for theming:
  - `--background` and `--foreground` for light/dark mode
  - `--font-geist-sans` and `--font-geist-mono` for typography
- Dark mode support via `prefers-color-scheme`

## Key Conventions

### Component Patterns

- Server Components by default (Next.js 16 App Router)
- Use `"use client"` directive only when client-side interactivity is required
- Metadata exports in layout files for SEO

### Image Handling

- Use `next/image` component for optimized image loading
- Images stored in `/public` directory
- Consider Sharp library integration for server-side image processing

### Styling

- Tailwind utility classes for all styling
- Custom CSS variables defined in `app/globals.css`
- Theme values accessed via `--color-*` and `--font-*` custom properties

## Application-Specific Context

This is a defect detection application that will require:
- Image upload functionality (client component)
- Image processing for detecting dark/light spots (likely server-side or Web Worker)
- Canvas or SVG for rendering detection circles and annotations
- State management for detection configuration (min size, contrast thresholds)
- Potentially OpenCV.js or similar for image analysis

# Auravo Website

A modern marketing website for Auravo, built with Astro + React + Tailwind CSS. Features include workshop booking, voice assessment quiz, and interactive components.

## Tech Stack

- **Astro** - Frontend framework
- **React** - Interactive components
- **Tailwind CSS** - Styling
- **Vercel** - Deployment platform
- **TypeScript/JavaScript**

## Local Setup

### Prerequisites
- Node.js 18+
- npm (or yarn/pnpm)

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```
Open http://localhost:4321/ in your browser.

### Build
```bash
npm run build
```
Output is generated in `dist/`.

## Deployment

Deployed via **Vercel**. Environment variables should be set in the Vercel dashboard:
- `PUBLIC_SUPABASE_URL` (if using Supabase)
- `PUBLIC_SUPABASE_ANON_KEY` (if using Supabase)

Build command: `npm run build`  
Output directory: `dist`

## Project Structure

```
├── public/          # Static assets
├── src/
│   ├── components/  # React and Astro components
│   │   ├── home/    # Homepage sections
│   │   ├── quiz/    # Voice archetype quiz
│   │   └── book-workshop/ # Workshop booking form
│   ├── layouts/     # Page layouts
│   ├── pages/       # Astro pages
│   └── lib/         # Utilities
├── package.json
└── README.md
```

## Features

- **Homepage** - Marketing sections with interactive components
- **Voice Archetype Quiz** - Interactive quiz with results
- **Workshop Booking** - Form to book workshops or bring Auravo to institutions
- **Responsive Design** - Mobile-first, modern UI

## Useful Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

# Markdown Reader

A static page that renders markdown as collapsible sections and reads it aloud with word highlighting. Paste markdown into the page and press Render.

## Features

- Headings nest into sections that expand and collapse. All sections start expanded.
- Tables, fenced code, lists, blockquotes, links, and inline formatting.
- Play and pause, a voice dropdown limited to the browser's language, and a speed slider from 0.5x to 2x.
- The current word is highlighted. Click any word to start reading from it.
- Symbols such as `->` and `≥` are spoken by name, and "json" and "jsonb" are pronounced as words.
- Theme dropdown with seven dark color schemes.

## Requirements

- Node.js 18 or later
- A browser with the Web Speech API (current Chrome, Edge, Safari, and Firefox)

## Development

```sh
npm install
npm run typecheck   # TypeScript type check only
npm run build       # type check, then bundle into dist/
```

Open `dist/index.html` in a browser after a build.

## Deployment

`npm run build` writes a self-contained static site to `dist/`:

- `index.html`
- `styles.css`
- `app.js` (with `app.js.map`)

Serve the `dist/` folder from any static host, such as GitHub Pages, Netlify, or an S3 bucket. The page makes no network requests and needs no server.

## Project layout

```
src/
  index.html   page markup
  styles.css   styles, using CSS custom properties set by the theme
  main.ts      entry point: wires the editor, themes, and speech controls
  markdown.ts  markdown-to-HTML parser and section builder
  speech.ts    text-to-speech playback, word highlighting, voice selection
  themes.ts    color scheme definitions and application
build.mjs      build script (type check, esbuild bundle, copy static files)
```

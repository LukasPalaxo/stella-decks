# Stella Decks

An HTML slide deck system with a design system, browser viewer, and pixel-perfect PDF export. Built for AI-native workflows with Codex and [Claude Code](https://claude.ai/code).

## Quick Start

```bash
git clone https://github.com/rsarver/stella-decks.git
cd stella-decks
npm install
npm start
```

Open `http://localhost:3000` to see the example deck. Arrow keys to navigate, Esc for overview grid, F for fullscreen.

Then open the project in Codex or Claude Code and run these prompts:

1. **Design system** - "Help me set up my design system."  
   Describe a vibe ("The Economist meets a16z"), pick from visual directions, or drop inspiration into `context/` first.
2. **First deck** - "Create my first deck from this brief: ..."  
   The agent creates deck structure, outline, and initial slides.
3. **Export** - "Export deck `<deck-slug>`."  
   This runs the screenshot pipeline and produces PNGs/PDF.

You talk strategy and narrative. The agent handles the files and repo edits.

Note: export requires a local Chrome/Edge executable (or `PUPPETEER_EXECUTABLE_PATH`).

## How It Works

**Slides are HTML.** Each slide is a self-contained HTML file (1280x720px, 16:9). They link to a shared CSS design system (`deck.css`) for colors, typography, and components.

**Manifests control order.** Each deck has a `manifest.json` listing slides in order with labels. The viewer and export scripts both read from it.

**The viewer previews in-browser.** `viewer/index.html` loads slides as iframes with keyboard navigation (arrows), overview grid (Esc), and fullscreen (F).

**Export is screenshot-based.** Puppeteer takes 2x retina screenshots of each slide, then pdf-lib composites them into a PDF. This avoids Chrome's print-mode CSS rendering bugs. Slide numbers are auto-injected from manifest order.

## Skills

Stella Decks ships with two agent skills that do the heavy lifting:

**`/design-setup`** - Build your design system through conversation. Describe a vibe ("clean, confident, dark editorial"), pick from visual directions the agent proposes, or drop brand materials into `context/` and let it extract the palette and tone. It proposes specific hex values, named Google Fonts, pixel spacing, and opinionated design principles written in your voice, then writes DESIGN.md and updates the CSS tokens. One good sentence about what you want is enough to generate an entire design system.

**`/narrative-review`** - Review a deck's story structure the way a communications advisor would. Evaluates thesis clarity, audience empathy, narrative arc, slide-level discipline, and whether the evidence supports the assertions. Catches structural problems that are easy to miss when you're deep in individual slides: a thesis that never gets paid off, a data section that undermines the confidence of what came before, a closing that doesn't connect back to the opening. Run it iteratively as you build.

If you use [gstack](https://github.com/garrytan/gstack), `/design-consultation` is an alternative to `/design-setup` that adds competitive research and AI mockup previews.

## The Design System

The design system lives in two places:

- **DESIGN.md** defines your visual identity: colors, typography, spacing, design principles, and rules. Your agent reads this before making any design decision. Built via `/design-setup`.
- **deck.css** implements it as CSS custom properties. Override the `:root` tokens to change the entire look.

Manual path: edit DESIGN.md and the `:root` tokens in deck.css directly.

## Project Structure

```text
stella-decks/
  decks/
    styles/deck.css              # Shared design system (token-driven CSS)
    assets/                      # Shared images across decks
    example/                     # Starter deck (5 template slides)
      manifest.json
      BRIEF.md
      slides/
    {your-deck}/                 # Your decks go here
  .claude/skills/
    design-setup/                # /design-setup
    narrative-review/            # /narrative-review
  .agents/skills/
    design-setup/                # Codex skill mirror
    narrative-review/            # Codex skill mirror
  archive/                       # Parked slides (move, don't delete)
  context/                       # Drop brand materials, research, notes here
  exports/                       # Generated PNGs and PDFs
  viewer/index.html              # Browser-based slide viewer
  scripts/
    export-deck.mjs              # Puppeteer screenshot -> PDF pipeline
    export-deck-md.mjs           # Deck -> Markdown exporter
    generate-image.mjs           # AI image generation (optional)
  DESIGN.md                      # Your design system brief
  AGENTS.md                      # Agent instructions for Codex and compatible tools
  CLAUDE.md                      # Claude-specific companion instructions
  docs/                          # Reference: design tokens, components, workflow
```

## Export

Ask your agent to export your deck, or run it directly:

```bash
node scripts/export-deck.mjs my-deck            # PNGs + PDF
node scripts/export-deck.mjs my-deck --png-only # PNGs only (for Google Slides)
node scripts/export-deck-md.mjs my-deck         # Markdown export
```

Output: `exports/{deck}/slides/` (2560x1440 retina PNGs) and `exports/{deck}/{deck}.pdf`.

## Image Generation (Optional)

Generate design-system-aligned images for slide backgrounds, icons, and case study visuals using OpenAI's image API. Add `OPENAI_API_KEY` to `.env`.

Templates: `dark-atmosphere`, `light-spot`, `domain-icon`, `hero-background`, `cover-accent`.

## Deploy

Stella Decks is static HTML. Deploy anywhere:

- **Vercel:** `npx vercel` with a rewrite: `{ "source": "/:deck", "destination": "/viewer/index.html?deck=:deck" }`
- **GitHub Pages / Netlify / Cloudflare Pages:** Push the repo. No build step needed.
- **Any static host:** Point to `viewer/index.html?deck=your-deck`.

## Philosophy

- **Slides are code.** Version-controlled HTML. Diff, branch, revert.
- **Design system first.** Define your visual identity once. Every slide inherits it.
- **AI-native.** AGENTS.md + DESIGN.md make your coding agent a design partner, not a code generator.
- **Export is pixel-perfect.** Screenshots avoid CSS print rendering bugs.
- **Content lives in briefs.** Every deck has a BRIEF.md that captures intent and audience.

## License

MIT

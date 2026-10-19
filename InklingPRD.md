# Product Requirements Document (PRD)

**Project Name:** Inkling

**Tagline:** Where your best thoughts begin in the margins.

**Target Platform:** Web Application (Responsive Desktop / Tablet / Pen-first devices)

**Primary Audience:** High School (AP/IB/Honors Literature) & College/University Humanities Students

**Document Version:** 1.1.0

**Status:** Approved for Implementation

---

## 1. Executive Summary & Brand Psychology

### 1.1 The Problem

When high school and college students read novels, plays, and critical theory for English and humanities classes, digital reading tools consistently fall short. Mainstream readers (Kindle, Adobe Acrobat, Kami, Apple Books, Google Drive Preview) were engineered either for passive consumer reading or bureaucratic document signing.

Their core flaws in an academic literature setting include:

1. **Hidden Annotations:** Marginal notes are collapsed into tiny speech-bubble icons or hidden popovers instead of resting visibly alongside the prose.
2. **Spatial Disorientation:** The absence of persistent spatial layout destroys spatial memory (the cognitive ability to remember *where* on the page an argument or motif appeared).
3. **Sterile, High-Stakes Aesthetics:** Blinding white backgrounds, corporate UI chrome, and spreadsheet-like note sidebars create performance anxiety rather than focused, reflective inquiry.
4. **Friction in Essay Synthesis:** Students highlight text, but extracting those highlights into MLA/APA citations or seminar talking points requires tedious manual copy-pasting and page-number cross-referencing.

Consequently, students continue carrying heavy physical paperbacks despite the convenience and cost savings of digital texts.

### 1.2 The Vision

**Inkling** is a digital reading sanctuary engineered specifically for humanities students. It pairs the warmth, spatial intuition, and tactile pleasure of physical margin notes with digital superpowers: instant quotation synthesis, academic citation formatting, multi-format parsing, and motif tracking.

---

## 2. Naming & Cognitive Psychology Rationale

### Why "Inkling"?

*Pronunciation:* /ˈɪŋk.lɪŋ/

*Definition:* A nascent idea, suspicion, or germ of a thought; figuratively, a friendly miniature drop of ink.

#### Cognitive & Psychological Pillars:

1. **Perfectionism Dissolution:** High school and college literature students often freeze up because they feel every marginal comment must sound profound or essay-ready. "Inkling" grants psychological permission to start small—a fleeting thought, a question mark, or an initial reaction.
2. **The Kindchenschema & Diminutive Warmth:** The `-ling` morpheme (as in *duckling* or *seedling*) naturally triggers an innate feeling of smallness, gentleness, and non-intimidation. It makes a 500-page classic feel welcoming rather than formidable.
3. **Literary Heritage & In-Group Recognition:** "The Inklings" was the famed Oxford literary discussion group attended by C.S. Lewis, J.R.R. Tolkien, and Charles Williams. For AP literature students and English majors, the name signals literary prestige and cozy scholarly fellowship.
4. **Phonosemantic Aesthetics:** The crisp velar nasal stop (`ŋk`) resolved into the soft liquid consonant (`l`) creates a rhythm that feels playful and tactile—reminiscent of pen strokes on fresh paper.

---

## 3. User Personas

| Persona | Role | Primary Pain Point | Inkling Solution |
| :--- | :--- | :--- | :--- |
| **Maya (17)** | High School AP English Lit Student | Needs to annotate for weekly binder checks; hates hidden note dropdowns; gets eye strain from standard white screens. | Wide, always-visible margins with color-coded highlighter keys (Ochre = Motif, Rose = Rhetorical Device) and tactile sticky tabs. |
| **Julian (20)** | Undergraduate English & History Major | Spends hours combing through 400-page novels extracting quotes for 10-page research essays. | "The Quotebook" seminar drawer: 1-click export of highlighted quotes with pre-formatted MLA 9 / APA 7 / Chicago citations. |
| **Leo (19)** | Neurodivergent / ADHD Literature Student | Overwhelmed by cluttered UI; loses track of recurring characters and themes across dense chapters. | Bionic/Focus reading guides, customizable warm paper tints (Chamois, Parchment, Sage), and Character/Motif tagging. |

---

## 4. Product Pillars & Aesthetic Direction

### 4.1 Aesthetic Concept: "Dark Academia Meets Warm Japanese Stationery"

* **Paper Textures & Tones:** Zero stark `#FFFFFF` canvases. Default to warm physical book stocks:
  * *Chamois Cream* (`#F9F6EE` background, `#2B2523` ink)
  * *Muted Linen / Parchment* (`#F4EFEA` background, `#262322` ink)
  * *Library Sage* (`#EAEFE9` background, `#202B24` ink)
  * *Midnight Study* (`#181615` background, `#D8D2C4` ink)
* **Typographic Hierarchy:**
  * Serif Prototyping: *EB Garamond*, *Baskerville*, *Merriweather*, and *Literata*.
  * Accessibility & Dyslexia Support: *Atkinson Hyperlegible* and *OpenDyslexic*.
  * Fluid line-height ($1.6\times$ to $1.8\times$) and calibrated line lengths (65–75 characters per line).
* **Tactile Micro-Interactions:** Subtle, organic page-turn easing, soft paper-crease drop shadows, and optional low-frequency page-turning sound cues.

---

## 5. Functional Specifications

### Module 1: Multi-Format Ingestion & Cozy Bookshelf

* **Supported Formats:**
  * `.epub` (Reflowable text with chapter navigation)
  * `.pdf` (Fixed layout and OCR text-layer support)
  * `.txt` / `.md` (Raw texts and classic literature archives)
  * **Clean Web Article Import:** Paste any URL to strip web clutter and render in book format.
* **Cozy Bookshelf View:**
  * Visual shelf displaying customized cloth-texture book spines, gold foil title embossing, and cover art.
  * Ribbon bookmarks indicating reading progress percentage and estimated reading time.
  * Course Tagging (e.g., *ENGL 302: Romantic Poets*, *AP Lit Period 4*).

### Module 2: The Living Margin Engine (Core Differentiator)

* **Always-Visible Marginalia:**
  * Instead of shrinking the reading viewport or hiding notes behind icons, Inkling renders a generous 180px–240px lateral margin.
  * Margin notes appear directly horizontal to the exact line or passage they annotate.
  * Subtle thread lines illuminate on hover to connect the text selection with its corresponding margin card.
* **Handwritten & Stylus Support:**
  * Apple Pencil / Stylus / Touch pen input for compatible touch devices.
  * Organic brush physics: Ballpoint, Gel Pen, Graphite Pencil, and Chisel Highlighter.
* **Adhesive Page Flags & Dogearing:**
  * Click the top-right corner of any page to fold it into an authentic 3D dogear.
  * Attach colorful, translucent sticky tabs onto the outer page edge with custom labels (e.g., "Thesis Evidence", "Midterm Quote", "Symbolism").

### Module 3: Semantic Annotation System

* **4-Level Annotation Toolkit:**
  1. **Highlight:** Semi-transparent watercolor wash (Yellow Ochre, Dusty Rose, Muted Sage, Sky Indigo, Lilac).
  2. **Squiggle & Underline:** Close-reading syntax indicators.
  3. **Brackets / Vertical Callouts:** Left/right margin brackets for capturing long passages without excessive highlighter fill.
  4. **Margin Sticky Pad:** Mini folded-paper notes anchored to specific lines.
* **Custom Annotation Legend:**
  * Readers can define custom highlighter keys per book (e.g., Yellow = Character Arc; Pink = Dramatic Irony; Green = Setting/Atmosphere).

### Module 4: The Seminar & Essay Synthesis Drawer

* **Quote Extractor ("The Quotebook"):**
  * Sliding drawer accessible via hotkey (`Ctrl/Cmd + J`).
  * Displays every highlight, note, and bracketed passage in sequential reading order.
  * Filterable by Tag, Color, Chapter, or Motif.
* **Instant Academic Citation Formatter:**
  * Every extracted quote automatically includes pre-formatted citations:
    * *MLA 9:* (Author 42)
    * *APA 7:* (Author, Year, p. 42)
    * *Chicago:* Author, *Title*, 42.
  * 1-Click "Copy Quote + Citation" to clipboard.
* **Split-Screen Essay Drafting:**
  * Side-by-side view: Book on the left, clean Markdown/Rich-Text scratchpad on the right.
  * Drag and drop margin notes directly into the drafting scratchpad as formatted blockquotes.

### Module 5: Study & Retention Superpowers

* **Motif & Character Tracker:**
  * Index character names and recurring symbols across the work.
  * Visual timeline showing where specific motifs cluster (e.g., the Green Light in *The Great Gatsby*).
* **Margin-to-Flashcard Conversion:**
  * Turn any highlight or margin question into an active recall flashcard with one click (Cloze deletion or Q&A).

### Module 6: Data Ownership & Local-First Philosophy

* **Zero Paywall Lock-in:**
  * Full offline capability using client-side browser storage (`IndexedDB` / `OPFS`).
* **Export Options:**
  * **Burned-in PDF:** Download the file with all highlights, sticky notes, and margin ink permanently flattened.
  * **Markdown / Obsidian / Notion Bundle:** Export all notes, quotes, and metadata formatted for PKM apps.
  * **Printable Study Sheet:** Clean two-column cheat sheet (Left: Quote & Page; Right: Marginal Note).

---

## 6. Technical Architecture & Component Tree

```
Inkling Application Root
├── State Management (Zustand + Dexie.js for IndexedDB storage)
├── Reader Engine Router
│   ├── EPUB Engine (ePub.js wrapper with custom virtualized reflow layout)
│   ├── PDF Engine (PDF.js canvas with custom text and annotation overlay layers)
│   └── Plain/Markdown Engine (Custom typography viewport)
├── Canvas & Interaction Layer
│   ├── Vector Ink Overlay (Rough.js / Perfect-Freehand for organic pen strokes)
│   ├── Selection & Highlight Controller (Range-based anchor detection)
│   └── Living Margin Anchor (Observer-based alignment to match notes to text coordinates)
└── Academic Synthesis Drawer
    ├── Citation Engine (bibtex/citation.js integration)
    ├── Quotebook Filter & Search (MiniSearch indexing)
    └── Scratchpad Editor (Tiptap / Milkdown integration)
```

---

## 7. Non-Functional Requirements (NFRs)

* **Performance:** First Contentful Paint (FCP) $< 1.2\text{s}$. Book pagination latency $< 16\text{ms}$ (smooth 60fps).
* **Storage Limits:** Handle books up to $150\text{MB}$ in PDF or EPUB format via client-side streaming chunks.
* **Accessibility:** WCAG 2.1 AA compliant contrast ratios across all paper themes; full keyboard navigation for page turning (`J`/`K` or `Arrow Keys`) and highlighting (`H`).
* **Privacy:** All student books and annotations remain strictly on-device by default. Zero server tracking of reading habits.

---

## 8. MVP Implementation Roadmap

### Phase 1: Core Sanctuary (MVP)
* EPUB & PDF viewer with 4 warm paper themes and 3 serif fonts.
* Dynamic right-side margin with persistent note-taking.
* 5-color semantic highlighting with custom label legend.
* Local storage persistence (IndexedDB).
* Basic MLA citation copy-to-clipboard.

### Phase 2: Academic Superpowers
* Tactile Sticky Tabs & Dogearing.
* Quotebook Drawer with Markdown/Obsidian export.
* Stylus / Freehand drawing layer for tablets and trackpads.
* Split-screen essay drafting scratchpad.

### Phase 3: Collaborative Seminar
* Peer book-sharing (share annotation layers with study group classmates).
* Audio ambient tracks (Rain on Library Window, Warm Hearth, Coffee Shop Mumble).
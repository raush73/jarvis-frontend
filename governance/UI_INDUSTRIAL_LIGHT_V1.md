# JARVIS PRIME — INDUSTRIAL LIGHT V1
## UI Governance Document

**Status:** LOCKED  
**Version:** 1.0  
**Locked:** 2026-03-18  

---

## 1. PURPOSE

Industrial Light V1 is the locked visual system baseline for Jarvis Prime. It defines the single source of truth for all UI decisions: color, typography, spacing, component behavior, and page composition.

Every page built in Jarvis Prime must conform to this system unless a documented exception is approved. This document exists so future pages can be built without guessing, without per-page improvisation, and without visual drift from the approved baseline.

This is not a style guide suggestion. It is a locked system.

---

## 2. MASTER REFERENCE PAGE

**Canonical master page:**

```
/customers/[id]  →  E:\JARVIS\03_frontend\app\customers\[id]\page.tsx
```

This is the approved visual truth source for Jarvis Prime Industrial Light V1. When in doubt about any visual decision — layout, spacing, color, hierarchy, interaction — reference this page first.

This page defines the approved treatment for:
- Page header with back navigation, title, ID badge, status badge
- Summary card row (4-up grid, white surface, visible border)
- Action/approval card strip
- Tab navigation row (inline pill tabs, blue active state)
- Content panel (white card, visible border, padded interior)
- Panel header with title, helper note, and primary action button
- Table header strip (light gray bg, uppercase labels, visible bottom border)
- Table body (readable rows, hover state, blue links, red delete)
- Modal overlays (white surface, border, button row)
- Primary, secondary, and destructive button treatment
- Form field treatment (label, input, focus ring, disabled state)

---

## 3. DESIGN INTENT

Jarvis Prime Industrial Light V1 is:

- **Clean** — no decorative elements that don't serve a functional purpose
- **Light** — white cards, light gray page background, no dark work surfaces
- **Industrial** — designed for daily ERP use by real operations staff, not demos
- **Professional** — appropriate for a business context; not playful, not consumer SaaS
- **Readable on standard office monitors** — minimum contrast enforced; no washed-out text
- **Flat and grounded** — no glassmorphism, no frosted surfaces, no blur effects on content
- **Not futuristic** — no gradients-for-style, no neon accents, no dark dev UI aesthetic
- **Information-first** — every visual decision serves data readability and action clarity

This system is explicitly NOT:
- A dark theme
- A consumer SaaS dashboard
- A glassmorphism or futuristic UI
- A marketing/demo interface
- A redesign of the approved Customer Profile page

---

## 4. COLOR SYSTEM

### Page & Surface

| Token | Value | Usage |
|-------|-------|-------|
| Page background | `#f8fafc` | Main app work surface behind all cards |
| Card background | `#ffffff` | All cards, panels, table wraps, modals |
| Border | `#e5e7eb` | Card borders, table dividers, input borders |
| Hover border | `#d1d5db` | Secondary borders on hover states |

### Text

| Token | Value | Usage |
|-------|-------|-------|
| Text primary | `#111827` | Page titles, card titles, data values, form inputs |
| Text secondary | `#374151` | Labels, secondary headings, button text on secondary buttons |
| Text muted | `#4b5563` | Helper text, descriptions, approval notes |
| Text soft | `#6b7280` | Panel notes, timestamps, placeholder context, table section labels |
| Text faint | `#9ca3af` | Placeholder text in inputs, disabled context, missing-value indicators |

### Action Colors

| Token | Value | Usage |
|-------|-------|-------|
| Primary blue | `#2563eb` | Primary action buttons, active tab, focus ring, edit links, email links, checkbox accent |
| Primary blue hover | `#1d4ed8` | Hover on primary blue elements |
| Blue subtle bg | `#eff6ff` | Badge backgrounds, primary-contact row highlight |
| Blue subtle border | `#bfdbfe` | Badge borders |
| Blue disabled | `#93c5fd` | Disabled primary button |

### Status / Destructive

| Token | Value | Usage |
|-------|-------|-------|
| Destructive red | `#dc2626` | Delete buttons only |
| Destructive red hover | `#b91c1c` | Hover on delete button |
| Destructive red disabled | `#fca5a5` | Disabled delete button |
| Error bg | `#fff1f2` | Error banner background |
| Error border | `#fecaca` | Error banner border |
| Error text | `#991b1b` | Error banner text |

### Global Navigation (preserved dark nav)

The global top nav and module tabs retain the dark navy treatment established in `globals.css`. This is the approved navigation system and is not subject to the light surface rules that apply to page content.

| Element | Color |
|---------|-------|
| Top nav bg | `linear-gradient(180deg, #1e3a5f 0%, #162f50 100%)` |
| Module tabs bg | `#122543` |
| Order nav bg | `#0f1f38` |
| Nav text inactive | `rgba(255,255,255,0.55)` |
| Nav text active | `#ffffff` |

---

## 5. TYPOGRAPHY RULES

### Sizes and Weights

| Context | Size | Weight | Color |
|---------|------|--------|-------|
| Page title (h1) | 26px | 700 | `#111827` |
| Section title (h2) | 18px | 700 | `#111827` |
| Sub-section title (h3) | 16px | 700 | `#111827` |
| Sub-sub title (h4) | 13px | 700 | `#111827` |
| Card label / uppercase | 11px | 700 | `#6b7280` + uppercase + `letter-spacing: 0.6px` |
| Table header label | 11px | 600 | `#374151` + uppercase + `letter-spacing: 0.5px` |
| Data value | 14px | 500 | `#111827` |
| Table body value | 13px | 400 | `#111827` |
| Action link (edit) | 13px | 500 | `#2563eb` |
| Email link | 13px | 400 | `#2563eb` |
| Helper / note text | 13px | 400 | `#6b7280` |
| Fine print / note | 11px–12px | 400 | `#6b7280` (italic for contextual notes) |
| Nav item | 13px | 500 | see nav section |
| Module tab | 12.5px | 500 | see nav section |
| Button (primary) | 13px | 700 | `#ffffff` |
| Button (secondary) | 13px | 600 | `#374151` |
| Form label | 12px | 600 | `#374151` |
| Form input | 13px | 400 | `#111827` |
| Form placeholder | 13px | 400 | `#9ca3af` |

### Rules
- Page titles use `letter-spacing: -0.3px` for optical tightening at large size
- Labels are always uppercase when used as card field labels
- Table headers are always uppercase
- Links that are actions (Edit, Add) use `#2563eb` with underline on hover
- Delete actions use `#dc2626` — no exceptions
- Disabled text uses `#6b7280` or opacity reduction

---

## 6. COMPONENT STANDARDS

### HEADER

**Purpose:** Page-level identity — communicates where you are and what entity is being viewed.

**Structure:**
```
[Back Button]
[Title h1]  [ID Badge]  [Status Badge]
```

**Rules:**
- Back button: white bg, `#e5e7eb` border, `#374151` text, 7px radius, 7–8px vertical padding
- h1: 26px, weight 700, `#111827`, `letter-spacing: -0.3px`
- ID badge: blue subtle bg (`#eff6ff`), blue border (`#bfdbfe`), blue text (`#1d4ed8`), 6px radius
- Status badge: `#f9fafb` bg, `#e5e7eb` border, `#374151` text, 6px radius
- Action buttons placed in header only when contextually required at page level
- No decorative elements in the header band

---

### SUMMARY CARD

**Purpose:** At-a-glance key facts about the entity — presented as a compact labeled-value row.

**Structure:**
```
[Label (uppercase, muted)]
[Value or Link]
```

**Rules:**
- White background (`#ffffff`)
- Visible border (`#e5e7eb`), 10px radius
- Padding: 14px 18px
- Grid layout: typically 4-up (`grid-template-columns: repeat(4, minmax(0, 1fr))`)
- Label: 11px, weight 700, `#6b7280`, uppercase, `letter-spacing: 0.6px`
- Value: 14px, weight 500, `#111827`
- Links in summary cards (website, ownership): `#2563eb` for external/navigational links
- Ownership uses its approved non-link or subtle-link render — not a bold blue CTA
- No heavy box shadow — border is the visual boundary

---

### ACTION CARD

**Purpose:** A card that is itself a navigable action or contains an approval control.

**Structure:**
```
[Label (bold, dark)]
[Helper description (muted)]
```

**Rules:**
- White background, `#e5e7eb` border, 10px radius
- Hover: `#f8fafc` bg, `#d1d5db` border
- Label: 13px, weight 700, `#111827`
- Helper text: 12px, `#6b7280`, `line-height: 1.4`
- Full-width flex card — min-width 200px
- Toggle/checkbox cards follow same surface rules

---

### TABS

**Purpose:** Module-level content switching within a page.

**Structure:**
```
[Tab] [Tab (active)] [Tab] ...
```

**Rules:**
- Inline pill tabs — not underline tabs
- Inactive: white bg, `#e5e7eb` border, `#374151` text, 8px radius
- Hover: `#f1f5f9` bg, `#d1d5db` border
- Active: `#2563eb` bg, `#2563eb` border, white text
- Count badge: `rgba(0,0,0,0.08)` bg on inactive; `rgba(255,255,255,0.25)` bg on active
- Font: 13px, weight 600
- Gap: 8px between tabs
- Do not use underline-style tabs inside page content — reserve for nav layers

---

### TABLE

**Purpose:** Structured data display in rows and columns.

**Header row:**
- Background: `#f1f5f9`
- Text: 11px, weight 600, `#374151`, uppercase, `letter-spacing: 0.5px`
- Border-bottom: `1px solid #d1d5db` (stronger than row separators)
- Padding: 10px 12px

**Body rows:**
- Text: 13px, `#111827`
- Border-bottom: `1px solid #f1f5f9` (very light — for rhythm, not hard separation)
- Padding: 12px
- Last row: no bottom border
- Hover: `background: #f9fafb`

**Actions column:**
- Edit: 13px, weight 500, `#2563eb`, hover underline
- Delete: 13px, weight 500, `#dc2626`, hover underline
- No button chrome on inline table actions — they are link-style only

**Table wrap:**
- Border: `1px solid #e5e7eb`, 8px radius
- Overflow: hidden (for radius to work)
- Lives inside the tab content card

---

### FORM FIELDS

**Label:**
- 12px, weight 600, `#374151`
- Required star: `#dc2626`

**Input / Textarea / Select:**
- White bg, `#d1d5db` border, 7px radius
- Font: 13px, `#111827`
- Padding: 9px 11px
- Focus: border `#2563eb`, box-shadow `0 0 0 2px rgba(37,99,235,0.15)`
- Placeholder: `#9ca3af`

**Disabled state:**
- Background `#f8fafc`, color `#6b7280`, cursor not-allowed

**Error banner:**
- `#fff1f2` bg, `#fecaca` border, `#991b1b` text, 6px radius, 10–12px padding

---

### PRIMARY BUTTON

```
Background:  #2563eb
Color:       #ffffff
Border:      none
Border-radius: 7px
Padding:     9px 16px
Font:        13px, weight 700
Hover bg:    #1d4ed8
Disabled bg: #93c5fd, cursor: not-allowed
```

Used for: save, create, add, confirm, generate order, submit.

---

### SECONDARY BUTTON

```
Background:  #ffffff
Color:       #374151
Border:      1px solid #e5e7eb
Border-radius: 7px
Padding:     9px 16px
Font:        13px, weight 600
Hover bg:    #f1f5f9
Hover border: #d1d5db
Disabled:    opacity 0.5, cursor: not-allowed
```

Used for: cancel, back, close, edit (in header context).

---

### DESTRUCTIVE BUTTON

```
Background:  #dc2626
Color:       #ffffff
Border:      none
Border-radius: 7px
Padding:     9px 16px
Font:        13px, weight 700
Hover bg:    #b91c1c
Disabled bg: #fca5a5, cursor: not-allowed
```

Used for: delete confirmation only. Never for cancel or close.

---

### MODAL

**Purpose:** Focused overlay for creating, editing, or confirming a destructive action.

**Rules:**
- Overlay: `rgba(0,0,0,0.35)` backdrop
- Panel: white bg, `#e5e7eb` border, 12px radius, 24–28px padding
- Max width: ~480–520px, centered
- Title: 16–18px, weight 700, `#111827`
- Body: standard form field treatment
- Button row: right-aligned, primary + secondary (or primary + destructive)
- Error banner inside modal follows form error treatment

---

### NAV (Global + Module)

**Global Top Nav (dark, locked):**
- Height: 52px, sticky, `z-index: 100`
- Background: `linear-gradient(180deg, #1e3a5f 0%, #162f50 100%)`
- Logo left, domain nav center-left, search + logout right
- Domain items: 13px, weight 500, white at varying opacity
- Active domain: white text + `rgba(59,130,246,0.15)` bg

**Module Tabs (dark, locked):**
- Height: 44px, sticky at `top: 52px`, `z-index: 99`
- Background: `#122543`
- Tab items: 12.5px, weight 500
- Active: white text + `rgba(255,255,255,0.08)` bg

**Order Nav (dark, locked):**
- Height: 42px, sticky at `top: 96px`, `z-index: 98`
- Background: `#0f1f38`
- Active tab: `#60a5fa` text + `rgba(59,130,246,0.1)` bg + bottom indicator line

**Page content tabs (light, on page):**
- See TABS component standard above

---

## 7. INTERACTION RULES

- **Blue = action.** `#2563eb` is reserved exclusively for things the user can click to do something. Edit links, email links, external website links, primary buttons, active tab.
- **Dark text = information.** `#111827` is for data values. It is not interactive unless explicitly paired with an action affordance.
- **No fake links.** Do not render non-interactive text in blue. If it's blue, it must be clickable.
- **Edit is always blue.** Inline edit links are `#2563eb`, hover underline.
- **Delete is always red.** `#dc2626`. No exceptions. Never gray delete. Never blue delete.
- **Ownership link behavior is approved as-is.** The current cursor/color treatment in the master page is the approved standard. Do not make it a bold blue CTA.
- **Active tab is blue-filled.** White text on `#2563eb` background.
- **Hover states are subtle.** `#f9fafb` or `#f1f5f9` for row/card hover. Not dramatic.
- **Focus rings are blue.** `2px solid #2563eb` with `2px offset`.
- **Checkbox accent color is blue.** `accent-color: #2563eb`.

---

## 8. PAGE COMPOSITION RULES

Every Jarvis Prime page follows this vertical stack:

```
┌─────────────────────────────────────────────────────┐
│  GLOBAL TOP NAV (dark, sticky, 52px)                │
├─────────────────────────────────────────────────────┤
│  MODULE TABS (dark, sticky, 44px)                   │
├─────────────────────────────────────────────────────┤
│  [ORDER NAV if applicable] (dark, sticky, 42px)     │
├─────────────────────────────────────────────────────┤
│  PAGE CONTENT AREA  (bg: #f8fafc)                   │
│  ┌───────────────────────────────────────────────┐  │
│  │  PAGE HEADER                                  │  │
│  │  [Back btn] [Title h1] [ID badge] [Status]    │  │
│  ├───────────────────────────────────────────────┤  │
│  │  SUMMARY CARDS ROW (4-up grid, white cards)   │  │
│  ├───────────────────────────────────────────────┤  │
│  │  ACTION / APPROVAL STRIP (flex row of cards)  │  │
│  ├───────────────────────────────────────────────┤  │
│  │  TABS ROW (inline pill tabs)                  │  │
│  ├───────────────────────────────────────────────┤  │
│  │  CONTENT CARD (white, border, padded)         │  │
│  │  ┌─────────────────────────────────────────┐  │  │
│  │  │ PANEL HEADER (title + note + action btn)│  │  │
│  │  ├─────────────────────────────────────────┤  │  │
│  │  │ TABLE or CARD CONTENT                   │  │  │
│  │  └─────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Rules:**
- Page background is always `#f8fafc` — set on the outermost page container
- Max width: 1400–1600px, centered with `margin: 0 auto`
- Top padding: 24px; side padding: 40px; bottom padding: 60px
- Summary cards come before action strips
- Tabs come directly before tab content — never separated by other content
- The primary CTA for a tab section lives in the panel header, right-aligned
- Modals float above all page content

---

## 9. REUSE RULES

1. **New pages start from Industrial Light V1.** Use the Customer Profile page as the visual template.
2. **Use existing USS components.** `PageContainer`, `PageHeader`, `Card`, `Button`, `TableWrapper` are the shared system primitives. Extend them — don't bypass them.
3. **CSS variables are the token layer.** Use `var(--color-text-primary)`, `var(--color-bg-card)`, etc. Do not hardcode colors unless adding a page-specific exception.
4. **Do not create per-page color systems.** No page should introduce a new palette. If a page needs a special color (e.g., a status badge color), document it as an exception.
5. **No ad-hoc dark surfaces in page content.** Dark surfaces belong in the nav layer only.
6. **Preserve information hierarchy.** Page title > card labels > data values. This is non-negotiable.
7. **Component deviations must be intentional.** If a new page needs a card with different padding, document why. Default to the standard.

---

## 10. DO / DON'T

### DO

| Do | Example |
|----|---------|
| Use `#f8fafc` for the page background | `background: #f8fafc` on page container |
| Use `#ffffff` for all cards and panels | Card component uses white bg |
| Use `#e5e7eb` for all borders | Summary card, tab panel, table wrap |
| Use `#2563eb` for primary action buttons | "+ Add Contact" button |
| Use `#2563eb` for edit links and email links | `color: #2563eb` on `.contact-action-link` |
| Use `#dc2626` for delete buttons only | `.contact-action-delete` in contacts table |
| Use uppercase 11px labels for card fields | `.summary-label` |
| Use `#f1f5f9` for table header background | `thead { background: #f1f5f9 }` |
| Make row hover `#f9fafb` | `tr:hover td { background: #f9fafb }` |
| Use weight 700 for primary button text | `font-weight: 700` on `.add-contact-btn` |

### DON'T

| Don't | Reason |
|-------|--------|
| Use dark card backgrounds (`rgba(255,255,255,0.04)`) on page content | That is the dark UI system — not Industrial Light |
| Use `rgba` white for borders in page content | Use solid `#e5e7eb` |
| Use blue for data values that are not clickable | Blue = action only |
| Use gray for delete buttons | Delete is always red |
| Use heavy drop shadows on cards | Border is the separator |
| Introduce new fonts or font weights | System font stack is locked |
| Make tabs underline-style inside page content | Pill tabs only inside page |
| Put the page background color inside a card | Cards are white |
| Create a new dark section in the middle of a light page | The dark / light boundary is strictly at the nav layer |
| Skip the panel header pattern for tab content | Panel header is mandatory |

---

## FUTURE PAGE BUILD RULE

When building a new page in Jarvis Prime, follow these rules exactly:

### Start From Industrial Light V1

1. **Open the master page** (`/customers/[id]/page.tsx`) and use it as your visual reference.
2. **Begin with `PageContainer`** — this sets the `#f8fafc` background.
3. **Use `PageHeader`** for the title area with optional subtitle and actions.
4. **Use `Card`** for any white surface with a border.
5. **Use `TableWrapper`** (which wraps `Card`) for table sections.
6. **Use `Button`** with `variant="primary"`, `"secondary"`, or `"destructive"`.

### Preserve Information Hierarchy

- Page title is always h1, 26px, weight 700, `#111827`
- Section titles are h2 (18px) or h3 (16px), weight 700, `#111827`
- Card field labels are 11px, uppercase, weight 700, `#6b7280`
- Data values are 14px, weight 500, `#111827`
- Never flatten the hierarchy with same-weight, same-color text at different levels

### Use Blue Only For Action / Active / Link Semantics

- `#2563eb` is for: buttons that do something, links that navigate, active tab state, inline edit/add actions, email addresses
- `#2563eb` is NOT for: data values, headings, status badges, decorative elements

### Do Not Invent New Page-Specific Color Systems

- If a page needs a status color not in this system (e.g., a new badge), use the existing semantic tokens or add to this governance document
- Do not introduce per-page `--my-page-color` variables
- Do not introduce page-local dark sections

### Document Exceptions

If a page genuinely needs to deviate from Industrial Light V1 (e.g., a data-dense financial table needs tighter padding), document the exception here with a rationale and the page path. Do not silently diverge.

### Exception Registry

| Page | Deviation | Reason | Approved |
|------|-----------|--------|----------|
| *(none yet)* | | | |

---

*This document is the locked governance standard for Jarvis Prime Industrial Light V1. All future pages must conform to or explicitly document exceptions from this baseline.*

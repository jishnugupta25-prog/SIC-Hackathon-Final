# Crime Report Portal - Design Guidelines

## Design Approach

**Selected System**: Material Design with safety-focused adaptations
**Rationale**: This utility-first application requires clarity, quick scanability, and trust. Material Design provides proven patterns for data visualization, maps, and mobile-first interactions—essential for an emergency safety tool.

**Core Principles**:
- Immediate clarity: Users must understand actions instantly in high-stress situations
- Trust through professionalism: Clean, organized layouts convey reliability
- Mobile-first: Emergency access often happens on phones
- Accessibility: High contrast, clear touch targets, readable text

---

## Typography

**Font Families** (Google Fonts):
- Primary: Inter (interface, body text, data)
- Accent: Space Grotesk (dashboard headings, statistics)

**Hierarchy**:
- Hero/Dashboard Headers: 3xl to 4xl, font-bold
- Section Titles: 2xl, font-semibold
- Card Headers: lg, font-medium
- Body Text: base, font-normal
- Captions/Meta: sm, font-normal
- Emergency Text (SOS): 2xl to 3xl, font-extrabold

---

## Layout System

**Spacing Primitives**: Use Tailwind units of **2, 4, 6, 8, 12, 16**
- Component padding: p-4 to p-6
- Section spacing: py-8 to py-16
- Card gaps: gap-4 to gap-6
- Form field spacing: space-y-4

**Grid Structure**:
- Dashboard: 12-column responsive grid
- Desktop: 3-column layout (sidebar + main + info panel optional)
- Tablet: 2-column or single column with collapsible sidebar
- Mobile: Single column, bottom navigation

**Container Widths**:
- Dashboard content: max-w-7xl
- Forms: max-w-2xl
- Map containers: Full width within parent

---

## Component Library

### Authentication Pages
- Centered card layout (max-w-md)
- Large form inputs with clear labels above fields
- Primary action button full-width
- Secondary links text-sm below form
- Email verification badge/indicator after successful signup

### Dashboard Layout
**Structure**:
- Fixed top navigation bar (h-16) with app logo, notifications bell, profile avatar
- Left sidebar (w-64 desktop, drawer on mobile) with navigation items
- Main content area with welcome header showing user name and quick stats
- Stats cards in 2-3 column grid (gap-6)
- SOS button prominently placed - large circular button (w-24 h-24 md:w-32 md:h-32) with pulsing animation

**Dashboard Cards**:
- Elevated cards with subtle shadow
- Card padding: p-6
- Icon + Title + Value/Description layout
- Hover state: slight elevation increase

### SOS Emergency Section
**SOS Button**:
- Large, circular, prominent placement (centered or top-right)
- Icon: exclamation or emergency symbol from Material Icons
- Size: Minimum w-24 h-24, scales to w-32 h-32 on desktop
- Includes "Tap Twice" instruction text below
- Confirmation modal on activation with countdown timer

**Emergency Contacts Management**:
- List view with contact cards
- Each card: Name, phone number, relationship, edit/delete icons
- Add contact button: Secondary style, icon + text
- Form modal for adding/editing: Name field, phone field, relationship dropdown

### Crime Map
**Map Container**:
- Full-width within content area (min-h-96 to min-h-screen)
- Map controls overlay (top-right): zoom, layers, current location button
- Crime markers: Clustered pins with count badges
- Info window on marker click: Crime type, date, brief description, distance from user
- Legend panel (collapsible, bottom-left): Crime type indicators

**Filter Panel** (above or beside map):
- Date range selector
- Crime type checkboxes in compact grid (grid-cols-2 md:grid-cols-4)
- Radius slider for search area
- Apply filters button

### Report Crime Form
**Layout**:
- Two-column layout on desktop (form left, map preview right)
- Single column on mobile with map below form

**Form Fields**:
- Crime type: Dropdown/select menu
- Date & Time: Date picker + time picker
- Location: Interactive map picker + address autocomplete
- Description: Large textarea (min-h-32)
- Anonymous reporting: Checkbox option
- Photo upload: Drag-drop zone with preview thumbnails (grid-cols-3)
- Submit button: Full-width on mobile, right-aligned on desktop

### Safe Places Tab
**Layout**:
- Split view: Map (60% width) + List sidebar (40% width)
- Mobile: Toggle between map view and list view

**Place Categories** (filter tabs):
- Hospitals, Police Stations, Safe Zones
- Each category has distinct icon from Material Icons

**List Items**:
- Place name (font-medium)
- Distance from user (text-sm)
- Address (text-sm, truncated)
- Direction button (opens in Google Maps)
- Call button for police stations/hospitals

### AI Recommendations Panel
**Gemini Integration Display**:
- Collapsible side panel or modal
- Header: "AI Safety Insights" with Gemini icon
- Content sections:
  - Crime pattern analysis (text with bullet points)
  - Safe route suggestions (list with map preview)
  - Safety tips based on location/time
- Refresh button to get updated analysis
- Loading state: Skeleton loaders during AI processing

### Navigation
**Desktop**:
- Vertical sidebar with icon + label navigation items
- Active state: Filled background, bold text
- Icons from Material Icons: Dashboard, Map, Report, Safe Places, Contacts, Settings

**Mobile**:
- Bottom navigation bar (h-16)
- Icon-only with labels on active state
- Maximum 5 items, overflow to hamburger menu

### Notifications/Toasts
**Toast Position**: Top-right
**Types**:
- Success: OTP sent, Crime reported, Contact added
- Warning: Location access needed, SOS activated
- Error: Submission failed, Network error
**Duration**: 4-6 seconds, dismissible

### Forms (General Patterns)
- Input fields: Full-width, h-12, rounded-md, border
- Labels: text-sm, font-medium, mb-2
- Error states: Red border, error text below field (text-sm)
- Required indicators: Asterisk in label
- Helper text: text-sm below field
- Button spacing: mt-6 for submit buttons

---

## Responsive Behavior

**Breakpoints**:
- Mobile: Base styles
- Tablet: md (768px)
- Desktop: lg (1024px)
- Large desktop: xl (1280px)

**Key Adaptations**:
- Dashboard: 3-column → 2-column → 1-column
- Navigation: Sidebar → Drawer → Bottom nav
- Forms: 2-column → 1-column
- Maps: Adjust height (min-h-64 mobile, min-h-96 desktop)
- SOS button: Fixed position on mobile (bottom-right with padding)

---

## Animations

Use sparingly for essential feedback:
- SOS button: Subtle pulse animation (animate-pulse)
- Loading states: Spinner or skeleton screens
- Modal entry/exit: Fade + slide
- Toast notifications: Slide-in from top
- NO scroll animations, NO parallax effects

---

## Images

**Hero Image**: Not applicable - this is a utility dashboard, not a marketing site
**Map Imagery**: Google Maps integration handles all map visuals
**Icons**: Material Icons via CDN for all interface icons
**User Avatars**: Placeholder initial circles for profile photos
**Crime Report Uploads**: User-uploaded photos in grid layout with thumbnails

---

## Accessibility

- Minimum touch target: 44x44px (w-11 h-11)
- Text contrast: WCAG AA minimum
- Focus indicators: Visible outline on all interactive elements
- Skip navigation link for keyboard users
- ARIA labels on all icon-only buttons
- Emergency features (SOS) have keyboard shortcuts
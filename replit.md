# Crime Report Portal

## Overview

The Crime Report Portal is a full-stack safety application that enables users to report crimes, access emergency SOS alerts, view crime maps, and find safe places nearby. The platform combines real-time geolocation, AI-powered crime analysis, and SMS emergency notifications to provide a comprehensive personal safety solution.

**Key Features:**
- Emergency SOS system with SMS alerts to contacts
- Crime reporting and visualization on interactive maps
- AI-powered crime pattern analysis and safety recommendations
- Safe places locator (hospitals, police stations, pharmacies)
- User authentication (email/password and Replit OAuth)
- Mobile-first responsive design

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

**November 23, 2025:**
- Merged admin login with main user login page
  - Added "System Admin Login" button on `/login` page for convenience
  - Admins no longer need to navigate to separate `/admin-login` URL
  - Single unified login page with toggle between user and admin modes
  - Both authentication flows fully functional and tested
  - Fixed admin session persistence by adding `credentials: "include"` to fetch requests

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework:** React with TypeScript
- **Build Tool:** Vite
- **Routing:** Wouter (lightweight client-side routing)
- **State Management:** TanStack Query (React Query) for server state
- **UI Components:** Shadcn/ui with Radix UI primitives
- **Styling:** Tailwind CSS with custom Material Design adaptations

**Design System:**
- Material Design principles adapted for safety-focused UI
- Typography: Inter (primary), Space Grotesk (headings)
- Mobile-first responsive layout with 12-column grid
- High contrast for accessibility in emergency situations
- Custom Tailwind configuration with HSL color system

**Component Architecture:**
- Reusable UI components in `/client/src/components/ui`
- Feature-based page components in `/client/src/pages`
- Sidebar navigation with collapsible mobile view
- Form validation using React Hook Form + Zod schemas

### Backend Architecture

**Technology Stack:**
- **Runtime:** Node.js with Express.js
- **Language:** TypeScript (ESNext modules)
- **Database ORM:** Drizzle ORM
- **Database:** PostgreSQL (Neon serverless)
- **Session Management:** express-session with PostgreSQL store
- **Authentication:** Passport.js (OpenID Connect for Replit, custom email/password)

**Server Structure:**
- Separate dev (`index-dev.ts`) and production (`index-prod.ts`) entry points
- Development uses Vite middleware for HMR
- Production serves pre-built static assets
- Session-based authentication with HTTP-only cookies (7-day TTL)

**API Design:**
- RESTful endpoints under `/api` prefix
- Authentication middleware (`isAuthenticated`) protects routes
- Request/response logging for debugging
- JSON body parsing with raw body preservation for webhooks

**Database Schema (Drizzle ORM):**
- `users` - User accounts with email/password or OAuth
- `sessions` - Session storage (PostgreSQL-backed)
- `emergency_contacts` - User's emergency contact list
- `crime_reports` - Crime reports with geolocation
- `sos_alerts` - Emergency SOS alert history

**Data Access Layer:**
- Storage interface pattern (`IStorage`) for abstraction
- `DatabaseStorage` implementation using Drizzle queries
- Support for operations: CRUD for contacts, reports, SOS alerts

### External Dependencies

**AI Integration - Google Gemini:**
- `@google/genai` SDK for crime pattern analysis
- Gemini 2.5 Flash model with JSON schema output
- Analyzes up to 20 recent crime reports
- Generates safety insights and recommendations
- Configured via `GEMINI_API_KEY` environment variable

**SMS Service - Twilio:**
- Twilio SDK for emergency SMS notifications
- Integrated via Replit Connectors API
- Credentials fetched from Replit runtime environment
- Sends SOS alerts with user location to emergency contacts
- Uses phone number pool from Twilio account

**Database - Neon PostgreSQL:**
- Serverless PostgreSQL via `@neondatabase/serverless`
- WebSocket connection using `ws` package
- Connection pooling for scalability
- Configured via `DATABASE_URL` environment variable
- Schema migrations in `/migrations` directory

**Authentication - Replit OAuth:**
- OpenID Connect discovery for Replit identity
- OIDC client configuration with memoized config (1-hour cache)
- Passport strategy for session management
- Token refresh and claims extraction
- Fallback to custom email/password authentication with bcrypt

**Geolocation:**
- Browser Geolocation API for user location
- High-accuracy mode with 15s timeout
- Used for crime reporting, SOS alerts, and safe place discovery
- Fallback UI when geolocation unavailable

**UI Component Library:**
- Radix UI primitives (dialogs, dropdowns, forms, etc.)
- Full suite of accessible, unstyled components
- Custom styling via Tailwind + class-variance-authority
- Lucide icons for consistent iconography

### Architecture Decisions

**Session-Based Authentication:**
- **Rationale:** More secure than JWT for web applications; HTTP-only cookies prevent XSS attacks
- **Implementation:** PostgreSQL-backed sessions with 7-day expiry
- **Trade-offs:** Requires database lookup per request but provides better security and revocation control

**Drizzle ORM Instead of Prisma:**
- **Rationale:** Lightweight, TypeScript-first ORM with better performance
- **Benefits:** SQL-like query builder, excellent type inference, smaller bundle size
- **Trade-offs:** Less mature ecosystem than Prisma but faster and more flexible

**Monorepo Structure with Shared Schema:**
- **Rationale:** Single source of truth for types between client and server
- **Implementation:** `/shared/schema.ts` exported to both environments
- **Benefits:** Type safety across full stack, reduced duplication, Zod validation schemas shared

**Vite for Frontend Tooling:**
- **Rationale:** Fast HMR, modern ES module support, optimized production builds
- **Benefits:** Sub-second startup, instant module reloading during development
- **Trade-offs:** Requires separate dev/prod server configurations

**Material Design with Safety Adaptations:**
- **Rationale:** Proven patterns for data visualization and mobile UX, trusted professional appearance
- **Adaptations:** Increased contrast, larger touch targets, emergency-focused color coding
- **Benefits:** Familiar UX patterns reduce cognitive load in high-stress situations

**Google Gemini for AI Analysis:**
- **Rationale:** Cost-effective, fast inference, structured JSON output support
- **Alternative Considered:** OpenAI GPT models (more expensive, overkill for simple analysis)
- **Benefits:** Reliable pattern recognition, safety-focused recommendations

**Twilio for SMS:**
- **Rationale:** Industry-standard SMS delivery, high reliability for emergency notifications
- **Integration:** Via Replit Connectors for credential management
- **Benefits:** Global coverage, delivery tracking, programmable messaging
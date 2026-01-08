# Changelog

## [0.0.3] - 2025-01-08
- Feature: Enriched movie data in production with additional details.
- Feature: Movie links were migrated to the database in production.
- Feature: Added a new directory and data enrichment pipeline.

## [0.0.2] - 2025-01-06
- Feature: Added cinematic "TV Scanline" background effect to Login and Register pages.
- Feature: Added "Vignette" effect to login screen for better focus and aesthetics.
- Feature: Added interactive "Mouse Spotlight" effect to login and register pages.
- Feature: Refact to front-end style.
- Feature: Added minimalist "TV Scanline" hover effect to home page category cards.
- Feature: Implemented rate limiting on the registration. Limit of one account creation per IP every 24 hours to prevent spam.
- Fix: Improved JSON parsing to support lists and auto-detect folder types from links.
- Fix: Added to page hyperlink to github repository.
- Fix: Adjustments to search in movies and series sections.

## [0.0.1] - 2025-01-01
- Feature: Authentication System - Secure Login and Logout with route protection and automatic session expiration.
- Feature: Vercel Support - Hybrid configuration to run locally (JSON files) or in the cloud (Environment Variables).
- Feature: Streaming Style Interface - New Dark Mode design, responsive cards, and integrated video modal.
- Feature: Search and Filters - Real-time search bar and initial dashboard with automatic separation of Movies and Series.
- Feature: Google Drive Integration - Deep folder navigation and video playback via API.
- Feature: Dynamic Footer - Automatic display of system version based on the Changelog.

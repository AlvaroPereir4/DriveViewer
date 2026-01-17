# Changelog

## [0.0.5] - 2026-01-17
- Feature: Added Account Settings hub for user management (e.g., password reset).
- Feature: Implemented support for login via E-mail or Username.
- Feature: Added secure Password Recovery system via email token.
- Feature: Enhanced registration form with referral source fields and community disclaimer.
- Feature: UI Update - Changed media cards to portrait mode (poster style) with CRT/Scanline and TV Flash hover effects.

## [0.0.4] - 2026-01-11
- Fix: Adjustments to front-end into series catalog.
- Fix: Adjustments to cover some issues in recognize files or videos.

## [0.0.3] - 2026-01-08
- Feature: Enriched movie data in production with additional details.
- Feature: Movie links were migrated to the database in production.
- Feature: Added a new directory and data enrichment pipeline.

## [0.0.2] - 2026-01-06
- Feature: Added cinematic "TV Scanline" background effect to Login and Register pages.
- Feature: Added "Vignette" effect to login screen for better focus and aesthetics.
- Feature: Added interactive "Mouse Spotlight" effect to login and register pages.
- Feature: Refact to front-end style.
- Feature: Added minimalist "TV Scanline" hover effect to home page category cards.
- Feature: Implemented rate limiting on the registration. Limit of one account creation per IP every 24 hours to prevent spam.
- Fix: Improved JSON parsing to support lists and auto-detect folder types from links.
- Fix: Added to page hyperlink to github repository.
- Fix: Adjustments to search in movies and series sections.

## [0.0.1] - 2026-01-01
- Feature: Authentication System - Secure Login and Logout with route protection and automatic session expiration.
- Feature: Vercel Support - Hybrid configuration to run locally (JSON files) or in the cloud (Environment Variables).
- Feature: Streaming Style Interface - New Dark Mode design, responsive cards, and integrated video modal.
- Feature: Search and Filters - Real-time search bar and initial dashboard with automatic separation of Movies and Series.
- Feature: Google Drive Integration - Deep folder navigation and video playback via API.
- Feature: Dynamic Footer - Automatic display of system version based on the Changelog.

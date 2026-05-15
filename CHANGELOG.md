# Changelog

## [0.1.1] - 2026-05-14
- Fix: Improved security coverage on specific endpoints
- 
## [0.1.0] - 2026-03-11
- Feature: Added LazyLoadObserver library to improve response time and optimize resource loading.
- Feature: Added space/cosmic meteor background animation to replace TV scanline effect.
- Feature: Improved card hover panel with larger play button, better layout, and increased typography sizes.
- Feature: Reworked card hover expansion animation to avoid text distortion.
- Feature: Enhanced modal layout with larger size and visible movie backdrop hero background.
- Feature: Updated interaction flow — cards no longer open on click, play button now opens details modal.
- Feature: Preserved grid state and scroll position when closing modal.
- Bug: Fixed JS crash caused by duplicate EDGE_MARGIN declaration.
- Bug: Fixed modal scroll being blocked due to incorrect overflow configuration.
- Bug: Fixed poster animation truncation caused by conflicting transform animations.

## [0.0.8] - 2026-01-26
- Feature: Admin Dashboard (`/admin`) implemented for media management.
- Feature: Admin Dashboard includes a searchable table to list all media items.
- Feature: Admin Dashboard allows editing of existing media details (`/admin/edit/<id>`).
- Feature: Admin Dashboard allows deletion of media items (`/admin/delete/<id>`).
- Feature: "Add Media" functionality (`/add-media`) is now integrated into the Admin Dashboard.
- Feature: Admin access is restricted to a specific email defined in `ADMIN_EMAIL` environment variable.
- Feature: Admin link is visible in the navbar only for authenticated administrators.
- Fix: Corrected modal scroll behavior on desktop for media details.
- Fix: Ensured close button is always visible on media details modal for desktop.

## [0.0.7] - 2026-01-26
- Feature: Mobile responsiveness improvements.
- Feature: Extended login session lifetime.

## [0.0.6] - 2026-01-21
- Feature: Backdrop image added to movie cards.
- Fix: Minnor bug adjusment to enrich catalog.
- Feature: UI Update - Expanded details modal size to better showcase backdrop images.
- Feature: UI Update - Increased font size for movie synopsis in details modal.
- Feature: UI Update - Replaced "Watch Now" button with a stylish circular Play icon.
- Feature: UI Update - Moved Play button to bottom-right and increased size for better ergonomics.
- Feature: Genre categories are now sorted by popularity (item count) instead of alphabetically.
- Feature: Added minimalist "Loading Spinner" (A24 Orange) for media cards and posters while images fetch.
- Feature: Implemented loading state for Modal Backdrop and Poster, ensuring a smooth visual experience.
- Fix: Added an overlay to disable the "Pop-out" button on the Google Drive video player.
- Fix: Category covers are now static (first item) instead of random to improve caching and consistency.
- Fix: Added error handling to loading spinners to prevent infinite loops on broken images.
- Feature: Implemented Advanced Client-Side Routing. Each category, folder, and movie now has a unique URL, enabling browser navigation (Back/Forward) and direct linking.
- Feature: Security Update - URLs now use movie names (slugs) instead of Drive IDs to hide file identifiers from the address bar.
- Fix: Repositioned and styled the modal close button to be visible and consistent with the UI.
- Fix: Resolved issue where closing the movie modal required multiple clicks by enforcing navigation to the previous context.
- Feature: Added Letterboxd integration. A direct link is now generated based on the movie title and displayed in both Details and Player views.
- Feature: UI Update - The Player View now displays full movie metadata (Genres, Original Title, Rating, etc.) below the video, mirroring the Details View.
- Feature: UI Update - Applied the cinematic "Spotlight & Scanline" background effect globally across the entire application.
- Feature: UI Update - Added subtle "Drifting Energy Lines" (Orange) to the background for enhanced atmosphere.

## [0.0.5] - 2026-01-17
- Feature: Added Account Settings hub for user management (e.g., password reset).
- Feature: Implemented support for login via E-mail or Username.
- Feature: Added secure Password Recovery system via email token.
- Feature: Enhanced registration form with referral source fields and community disclaimer.
- Feature: UI Update - Changed media cards to portrait mode (poster style) with CRT/Scanline and TV Flash hover effects.
- Fix: Removed redundant "Video" label from media cards for cleaner UI.
- Feature: Display release year on media cards for movies and series.
- Feature: UI Update - Redesigned buttons to outlined style (Black/Orange) for a high-contrast A24 aesthetic.
- Feature: Added dynamic Genre Categories to the home page with random movie covers as background.
- Feature: UI Update - Main categories (Movies/Series) now have dynamic covers and are visually separated from genres.

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

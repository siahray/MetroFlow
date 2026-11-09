# MetroFlow - UI Polish Backlog

**Status:** All items implemented (9 Nov 2026) — see `BACKLOG.md` §5 for the per-item record, including the two sub-items deliberately not built (bulk assign-to-unit, dispatch-response-time chart, signal-strength indicator).
**Date:** November 2, 2026

This backlog contains UI/UX enhancements for the MetroFlow Portal and Driver App. All required functionality per FSD is implemented; these are polish items to improve visual design, user experience, and production readiness.

---

## Priority: High (User Experience Impact)

### Portal UI

#### P1-1: Dashboard Page Implementation
**Current:** `/dashboard` redirects to `/triage`
**Proposed:** Implement a dedicated dashboard with KPI cards and operational overview
**Effort:** Medium
**Value:** Centralized operations overview for commanders

**Requirements:**
- Real-time KPI cards: Active SOS, Fleet Status, Active Hazards, Pending Reports
- Sector status display (currently static text in header)
- Weather advisory display (currently static text in header)
- Quick actions panel (triage, dispatch, hazards)
- Recent activity feed (last 5 actions from audit log)
- 24-hour trend charts (SOS volume, dispatch volume)

**FSD References:** FSD-FR-024 (Dashboard — Sector status, Weather advisory, Active SOS count, Operator identity)

---

#### P1-2: Loading States and Error Boundaries
**Current:** Basic loading spinners, generic error messages
**Proposed:** Improve loading states and error handling across all pages
**Effort:** Low
**Value:** Better user experience during network issues

**Requirements:**
- Skeleton loaders for incident queue, vehicle list, hazard list
- Retry buttons on error states
- Offline detection with informative messages
- Progressive loading (show initial data before full load)
- Loading indicators with estimated time for long operations

---

#### P1-3: Empty State Improvements
**Current:** Basic "no incidents match this filter" message
**Proposed:** Rich empty states with guidance and actions
**Effort:** Low
**Value:** Better user guidance when no data exists

**Requirements:**
- Empty state illustrations (SVG icons)
- Clear explanation of why queue is empty
- Suggested actions (e.g., "Check your filters", "Contact support")
- "Create first report" action for moderators
- Seasonal messages (e.g., "No active incidents — clear weather")

---

### Driver App

#### P1-4: Custom Splash Screen
**Current:** Default Expo splash
**Proposed:** Branded splash screen with MetroFlow logo
**Effort:** Low
**Value:** Professional app appearance

**Requirements:**
- MetroFlow logo/branding
- Project-specific color scheme
- Animated loading indicator
- Fade-in transition to main app
- Configurable via app.json

---

#### P1-5: Better Error Messages
**Current:** Generic error messages
**Proposed:** Context-specific error messages with actionable guidance
**Effort:** Low
**Value:** Better user understanding of issues

**Requirements:**
- GPS permission denied: Explain why location is needed
- Network error: Suggest checking connection or retry
- API errors: Clear explanation (e.g., "Server unavailable — try again later")
- Validation errors: Specific field-level error messages
- Retry buttons where appropriate

---

## Priority: Medium (Visual Polish)

### Portal UI

#### P2-1: Custom Color Scheme and Branding
**Current:** Uses slate-900/emerald-500 from scope
**Proposed:** Custom brand color palette with theme variables
**Effort:** Medium
**Value:** Distinguishable brand identity

**Requirements:**
- Define brand color palette in CSS variables
- Primary, secondary, accent colors
- Dark mode support (optional)
- Consistent color usage across all components
- Brand logo in header

---

#### P2-2: Enhanced Typography
**Current:** Default system fonts
**Proposed:** Custom typography scale with brand font
**Effort:** Low
**Value:** More polished, consistent text hierarchy

**Requirements:**
- Custom font family (e.g., Inter, system-ui)
- Typography scale (h1-h6, body, caption, overline)
- Consistent line heights and letter spacing
- Responsive text sizes
- Improved readability

---

#### P2-3: Animation and Transitions
**Current:** Minimal animations
**Proposed:** Smooth transitions and micro-interactions
**Effort:** Medium
**Value:** More polished, modern feel

**Requirements:**
- Page transition animations
- Card hover effects
- Button press states
- Loading skeleton shimmer
- Toast notification animations
- Modal open/close transitions

---

#### P2-4: Improved Data Visualization
**Current:** Basic KPI cards
**Proposed:** Charts and graphs for operational data
**Effort:** High
**Value:** Better insights and decision-making

**Requirements:**
- SOS volume over time (line chart)
- Dispatch response time (bar chart)
- Fleet utilization (pie/donut chart)
- Hazard distribution (bar chart)
- Historical trends (24h, 7d, 30d)
- Interactive chart libraries (e.g., Recharts, Chart.js)

---

### Driver App

#### P2-5: Enhanced Map Styling
**Current:** Default MapLibre style
**Proposed:** Custom map style with MetroFlow branding
**Effort:** Medium
**Value:** Better visual integration with brand

**Requirements:**
- Custom map style (dark/light mode)
- Branded marker icons
- Custom route line colors
- Hazard polygon styling (water effects)
- Better contrast and readability
- MapLibre GL style JSON or Mapbox Studio style

---

#### P2-6: Better Turn-by-Turn Instructions
**Current:** Text-based instructions
**Proposed:** Enhanced instruction display with icons
**Effort:** Medium
**Value:** Easier navigation guidance

**Requirements:**
- Direction icons (left, right, straight, U-turn)
- Street signs visual
- Distance countdown
- ETA display
- Current speed display
- Voice announcements (optional, out of scope for pilot)

---

#### P2-7: Profile Page Enhancements
**Current:** Basic profile display
**Proposed:** Enhanced profile with settings
**Effort:** Medium
**Value:** More user control and personalization

**Requirements:**
- Edit profile information
- Vehicle settings (clearance)
- Notification preferences
- Theme selection (light/dark)
- App version and build info
- Help and support link

---

## Priority: Low (Nice to Have)

### Portal UI

#### P3-1: Keyboard Shortcuts
**Current:** No keyboard shortcuts
**Proposed:** Keyboard shortcuts for power users
**Effort:** Medium
**Value:** Faster navigation for experienced dispatchers

**Requirements:**
- Ctrl+K: Quick search
- Ctrl+T: Go to triage
- Ctrl+H: Go to hazards
- Ctrl+F: Go to fleet
- Ctrl+U: Go to users
- Ctrl+E: Go to export
- Escape: Close modal
- Enter: Submit form

---

#### P3-2: Advanced Filtering
**Current:** Basic source filter
**Proposed:** Advanced filtering options
**Effort:** Medium
**Value:** More powerful queue management

**Requirements:**
- Date range filter
- Depth level filter
- Barangay filter
- Status filter (pending, verified, rejected)
- Multi-select filters
- Saved filter presets

---

#### P3-3: Bulk Actions
**Current:** Single incident actions
**Proposed:** Bulk actions for multiple incidents
**Effort:** High
**Value:** Faster batch processing

**Requirements:**
- Select multiple incidents
- Bulk approve/reject
- Bulk assign to unit
- Bulk export
- Confirmation dialogs for bulk actions

---

### Driver App

#### P3-4: Telemetry Visualization
**Current:** Basic telemetry sent to backend
**Proposed:** Display telemetry data in app
**Effort:** Medium
**Value:** Driver awareness of system status

**Requirements:**
- Display current speed
- Display heading/compass
- Display GPS accuracy
- Display connection status
- Display last sync time
- Signal strength indicator

---

#### P3-5: Report History
**Current:** No report history
**Proposed:** View past reports
**Effort:** Medium
**Value:** Driver accountability and review

**Requirements:**
- List of past reports
- Report status (pending, verified, rejected)
- View report details
- Re-submit rejected reports
- Report statistics (total, verified, rejected)

---

#### P3-6: Dark Mode
**Current:** Light mode only
**Proposed:** Dark mode support
**Effort:** High
**Value:** Better visibility in low-light conditions

**Requirements:**
- System theme detection
- Manual theme toggle
- Dark mode color palette
- Map dark mode
- Persistent theme preference

---

## Effort Estimates

| Priority | Low Effort | Medium Effort | High Effort |
|----------|------------|---------------|--------------|
| High     | P1-2, P1-3, P1-5 | P1-1 | - |
| Medium   | P2-2, P2-5 | P2-1, P2-3, P2-6, P2-7, P3-1, P3-2 | P2-4 |
| Low      | - | P3-4, P3-5 | P3-3, P3-6 |

**Total Items:** 16
**Quick Wins (Low Effort):** 5 items
**Medium Work:** 9 items
**Major Projects (High Effort):** 2 items

---

## Recommended Starting Order

1. **P1-2: Loading States and Error Boundaries** (Low effort, high UX impact)
2. **P1-3: Empty State Improvements** (Low effort, high UX impact)
3. **P1-5: Better Error Messages** (Low effort, high UX impact)
4. **P2-2: Enhanced Typography** (Low effort, visual polish)
5. **P1-1: Dashboard Page Implementation** (Medium effort, high value)

These provide the best ROI for effort invested.

---

## Notes

- All required FSD functionality is implemented; these are enhancements only
- None of these are blocking for pilot deployment
- Can be prioritized based on user feedback and business needs
- Some items (like dark mode, bulk actions) are significant projects
- Consider user feedback from pilot testing to prioritize

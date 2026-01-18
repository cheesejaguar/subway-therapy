# PRD: SubwayTherapy.net Virtual Wall

### TL;DR

SubwayTherapy.net Virtual Wall is an interactive, visually immersive online platform inspired by the original physical Subway Therapy project. Anyone can anonymously post a digital sticky note—by drawing or typing—onto a virtual tiled wall reminiscent of a New York City subway station. The experience prioritizes inclusivity, accessibility, and mass participation, with moderation measures in place to ensure the space remains welcoming for all users.

---

## Goals

### Business Goals

* Achieve at least 10,000 unique sticky notes posted in the first 30 days.

* Secure a minimum of 5 press or media mentions within the launch quarter.

* Demonstrate Vercel’s deployment speed and scaling capabilities by supporting 1,000 concurrent users at launch.

* Maintain 99.9% uptime during peak events.

* Showcase product as an innovative art/tech community initiative, driving organic social media sharing.

### User Goals

* Enable anyone to effortlessly post a creative, anonymous sticky note via mobile or desktop with minimal friction.

* Allow easy navigation and zooming/panning across the expansive virtual wall to discover other users’ notes.

* Lower barriers to participation with full accessibility and support for touch screens and low-vision users.

* Ensure a safe, positive experience through robust content moderation and immediate flagging/reporting.

* Provide privacy by not requiring user accounts or personal details.

### Non-Goals

* No support for multiple sticky notes from the same user/session per day (single-note-per-cookie/session).

* No persistent user accounts, user profiles, or social logins.

* No complex gamification (e.g., leaderboards, badges).

* No direct messaging or commenting between users.

---

## User Stories

### Visitor (General User)

* As a Visitor, I want to browse the digital wall and read anonymous sticky notes, so that I can feel connected to a diverse range of voices and perspectives.

* As a Visitor, I want to create and post a sticky note (text or drawing) with a single tap, so that I can quickly express my feelings.

* As a Visitor, I want to use touch gestures or my mouse to navigate (pan/zoom) the wall, so that I can explore different areas easily.

* As a Visitor, I want to trust that hateful or inappropriate content will be removed, so that the space feels safe.

* As a Visitor, I want the experience to work well on my mobile device, so I can participate from anywhere.

### Moderator

* As a Moderator, I want to quickly review new sticky notes in a moderation queue, so that I can approve or reject content efficiently.

* As a Moderator, I want to see flagged/hidden notes highlighted, so that moderation actions are clear and actionable.

* As a Moderator, I want simple batch moderation tools, so I can handle spikes in submissions.

### Admin

* As an Admin, I want to monitor site activity and system health, so I can respond to technical or moderation issues.

* As an Admin, I want to update moderation criteria/settings, so the platform can adapt to real-world use.

---

## Functional Requirements

* **Sticky Note Creation & Placement (Priority: Critical)**

  * Drawing/Note Tool: Users can write or draw directly onto a sticky note UI using touch, stylus, or mouse.

  * Text Input Support: Option to type a message instead of drawing, with limited formatting.

  * Color Selection: Users choose from a palette of sticky note and ink colors.

  * Placement: Users select an open spot on the virtual wall to place their note.

  * Accessibility: Full keyboard, screen reader, and high-contrast support.

* **Wall Rendering & Navigation (Priority: Critical)**

  * Infinite/Expansive Wall: A grid of subway tiles that expands with content, supporting pan/zoom interactions (mobile and desktop).

  * Lazy Loading: Offscreen portions of the wall load dynamically for performance.

  * Sticky Note Loading: Notes are fetched dynamically based on viewport, with optimized rendering.

* **Moderation & Administration (Priority: High)**

  * Moderation Queue: New notes go to a queue before being visible site-wide.

  * Manual & Automated Moderation: Human review tools plus blacklist/ban word automation.

  * Flagging: Users can report/flag inappropriate notes, adding them to the queue.

  * Admin Dashboard: Monitoring site health, wall activity, moderation backlog.

* **Session & Deduplication Management (Priority: Medium)**

  * One Note per Session/User: Deduplication via browser cookie; prevents repeated submissions.

  * Session Storage: Supports anonymous, persistent state as needed (without personal data).

* **Storage & Infrastructure (Priority: Critical)**

  * Image Storage: User-created sticky notes (drawings/text) stored as images (e.g., Vercel Blob).

  * Metadata: Note placement, creation time, and moderation status stored in fast, edge-accessible service (e.g., Vercel Edge Config).

---

## User Experience

**Entry Point & First-Time User Experience**

* Users land on SubwayTherapy.net—immediately see the tiled subway wall filled with colorful sticky notes, plus a prominent “Add Your Note” call to action.

* On first entry, a zero-friction onboarding popup or topper (<20 words) encourages participation and explains the anonymous, one-note limit.

* Accessibility onboarding offers option for larger fonts, high-contrast, or screen reader tips.

**Core Experience**

* **Step 1:** User taps "Add Your Note"

  * Presented with simple sticky note creator: choose a color, then draw/write in a clear, borderless area.

  * Touch users write/draw with finger/stylus; desktop users use mouse/keyboard.

  * Option to enter text for accessibility or inaccessibility of freehand drawing.

  * Color palettes are visible but simple (5–8 options).

* **Step 2:** Submit & Place

  * After creating, user selects an available tile spot on the wall (current “view”), or the system auto-positions for them.

  * Upon submission, the interface gives immediate visual feedback (“Note Received! Moderating now…”).

  * In case of disallowed/repetitive entry (same cookie), display a gentle error (“Only one note per person per day!”).

* **Step 3:** Wall Navigation

  * User returns to browsing: scrolls or pinches/zooms around the wall, seeing newly added anonymous notes and a growing canvas of user expression.

  * Tapping or hovering on notes brings up larger preview (with moderation if note is hidden or flagged).

* **Step 4:** Moderation Feedback

  * Moderators/admins access a separate dashboard with high-contrast review tools.

  * End users reporting notes have a simple, accessible flag button; flagged notes are greyed until reviewed.

**Advanced Features & Edge Cases**

* Mobile: Gestures (pinch to zoom, drag) optimized for all major devices.

* Very high traffic: Wall “sharding”/lazy loading for smooth performance.

* Failed submissions: Retry UI and clear error copy in case of network issues.

* Accessibility: Users unable to draw are always offered a text input mode.

* Abuse/spam: Automated bans for repeated abuse per device/session.

**UI/UX Highlights**

* Mobile-first, responsive layout from smallest phones to desktop monitors.

* ADA-compliant color contrasts for sticky notes and backgrounds.

* Touch targets at least 44x44px; large submit/cancel controls.

* Zero-login/no-account experience; no personal data entry required.

* High-performance, jitter and lag-free navigation for both wall and art creation.

* Loading spinners or skeletons visible on slow network conditions.

---

## Narrative

The city can feel both electrifying and overwhelming—especially when voices are drowned out by the urban rush. After a divisive event, New Yorkers covered subway walls with thousands of handwritten sticky notes, sharing messages of hope, hurt, and unity. SubwayTherapy.net brings that spontaneous, communal creativity online, offering anyone, anywhere the chance to participate.

An anxious student logs in from her cell phone, feeling isolated in her new city. She drags her finger to write “We’re in this together” in neon pink, sticks it onto a virtual subway tile, and is immediately comforted as she browses hundreds of supportive notes around her. Moderators calmly review new submissions, keeping the space safe and welcoming.

In this digital community, everyone—regardless of location or ability—can share their words, draw their feelings, and be seen. The result is a living, ever-expanding art piece, powered by collective care and protected by thoughtful, transparent moderation. The wall connects, inspires, and documents this moment for both visitors and the wider world.

---

## Success Metrics

### User-Centric Metrics

* Sticky notes created (unique sessions per day)

* Portion of users who complete onboarding and post versus those who bounce

* Reports/flags submitted by users; satisfaction with moderation process (via optional survey)

### Business Metrics

* Earned media mentions & social media shares

* Demos/mentions in Vercel or partner channels

* Wall showcased at arts/tech events or in media

### Technical Metrics

* Wall load/render time under 1.5 seconds at 1,000 concurrent users

* Uptime/reliability (99.9%)

* Moderation queue handled within 30 minutes (avg.)

### Tracking Plan

* Track: page loads, add note button clicks, note submissions, moderation actions, flag/report usage, wall navigation (pan/zoom events), user device types, error rates.

---

## Technical Considerations

### Technical Needs

* **Front-End:** Responsive React or similar UI framework; custom canvas-based drawing/text tool optimized for mobile/touch.

* **Back-End:** Serverless APIs for note submission, wall data fetch, reporting/flagging, moderation queue, and admin tools. Use Vercel for deployment.

* **Data Model:** Each sticky note stores an image (drawing or rendered text), color, position, submission time, moderation status.

* **Deduplication:** Cookie-based session tracking; limits each user to a single note per 24h.

### Integration Points

* Hosting: Deployed on Vercel (leveraging fast edge/CDN).

* Storage: Fast, scalable image storage (Vercel Blob suggested).

* Metadata: Fast, global config (Vercel Edge Config).

* Moderation: Possible integration with simple automate tools (e.g., blocklists, AI API), but mainly human review.

### Data Storage & Privacy

* No user accounts or persistent data beyond anonymous note and a session cookie.

* All images and metadata stored securely and in compliance with privacy best practices (removal on moderation reject).

* No third-party analytics storing personal data.

### Scalability & Performance

* Wall and notes dynamically loaded; sharded or segmented for high load.

* Back-end and storage scale out automatically via Vercel deployment model.

* Image size limits on sticky notes for bandwidth control (e.g., <200KB/note).

### Potential Challenges

* Abuse/spam: Reliance on cookie/session is imperfect; may need light bot/spam mitigation.

* Performance: Rendering large, complex wall for thousands of users.

* Moderation backlogs during virality; UI/UX required for rapid review.

---

## Milestones & Sequencing

### Project Estimate

* **Small**: 1–2 weeks from start to soft launch.

### Team Size & Composition

* **Small Team**: 2 people

  * 1 Engineer/Developer (front-end, back-end, infra/devops)

  * 1 Designer/Product Lead (UI/UX, moderation/admin tools, testing)

  * (Optionally, Mods can be tapped ad hoc, but core team is 2 people)

### Suggested Phases

**1. Core Wall & Note Submission (2–3 days)**

* Key Deliverables: Engineer/Designer builds wall UI, navigation, initial sticky note creator (drawing/text input).

* Dependencies: Wall image assets, design direction.

**2. Storage, Placement, and Deduplication (2–3 days)**

* Key Deliverables: Engineer sets up image storage, metadata store, one-note-per-cookie logic.

* Dependencies: Vercel Blob/Edge Config access.

**3. Moderation Pipeline & Admin Dashboard (2–3 days)**

* Key Deliverables: Engineer/Designer implements review dashboard, email notifications, user flagging.

* Dependencies: Basic auto-moderation settings.

**4. Polish, Mobile/Accessibility, Soft Launch (3–5 days)**

* Key Deliverables: Finalize touch gestures, comprehensive testing, color/contrast, onboarding copy, performance checks.

* Dependencies: QA, possible additional testers.

**5. Launch & Iteration (2 days)**

* Key Deliverables: Go live, monitor metrics, adjust based on early user/mod feedback.

* Dependencies: Production domain, announcement plan.

---
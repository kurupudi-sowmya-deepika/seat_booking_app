# Bosch Seat Booking App - Design Document

## Overview

**Bosch Seat Booking App** is an enterprise workspace management and booking platform designed for Bosch employees.

The application provides a secure and modern experience for booking:

* Office seats
* Workspaces
* Meeting rooms
* Conference rooms
* Collaboration spaces
* Other bookable workplace resources

The application uses **Microsoft Azure AD / Microsoft Entra ID** for secure employee authentication and follows a clean Bosch-inspired enterprise design language.

---

# Design Tokens — "Bosch Light"

This is the canonical token set for the application. Every color, type size, radius, and spacing value used anywhere in the product should trace back to one of these — no one-off hex codes or ad-hoc pixel values in new work.

## Color

| Token       | Hex       | Role                                                              |
| ----------- | --------- | ------------------------------------------------------------------ |
| `primary`   | `#007BC0` | Bosch blue — links, focus states, hover on primary actions, the one strong color signal in the system |
| `secondary` | `#000000` | Black — headings, body copy, and the fill for the strongest interactive element (the primary button) |
| `tertiary`  | `#E5E7EB` | Soft gray — borders, dividers, low-emphasis surfaces (chips, secondary-button hover) |
| `neutral`   | `#FFFFFF` | Page background |
| `surface`   | `#FFFFFF` | Component background (cards, dialogs, forms) |
| `on-surface`| `#000000` | Text/icon color on light surfaces |
| `error`     | `#D00000` | Validation and destructive states only — used sparingly so blue stays the dominant accent |
| `muted`     | `#6B7280` | Practical addition, not in the base palette: secondary/caption copy where pure black is too heavy |

Bosch red is **not** part of this palette. Where earlier drafts of this document called for red as a "brand accent," that role is now served by restraint and black/blue contrast instead — see Design Principles.

## Typography

Single family — **Boschsans**, falling back to Helvetica Neue, Helvetica, Arial, sans-serif. Letter-spacing stays at `0px` throughout; the voice is direct and technical, not decorative.

| Style            | Size  | Weight | Line height |
| ---------------- | ----: | -----: | ----------: |
| Headline / Display| 64px |    700 |      76.8px |
| Headline / LG     | 45px |    700 |         54px |
| Headline / MD     | 32px |    700 |         38px |
| Headline / SM     | 23px |    600 |         28px |
| Body / LG         | 18px |    400 |         27px |
| Body / MD         | 16px |    400 |         24px |
| Body / SM         | 14px |    400 |         21px |
| Label / LG        | 16px |    400 |         24px |
| Label / MD        | 14px |    400 |         21px |
| Label / SM        | 12px |    400 |         18px |
| Caption           | 12px |    400 |         18px |

## Shape

| Token  | Value  | Use                                    |
| ------ | -----: | --------------------------------------- |
| `none` |   `0px`| Link buttons — no container to round |
| `sm`   |   `4px`| Buttons, inputs — small, engineered |
| `md`   |   `8px`| Cards |
| `lg`   |  `12px`| Large panels, modals |
| `xl`   |  `16px`| Hero/feature surfaces |
| `full` | `9999px`| Chips, pills |

## Spacing

An 8px-based stepped scale — `xs` 8px, `sm` 16px, `md` 32px, `lg` 56px, `xl` 80px. Use it for gaps between sections and major layout rhythm; component-internal padding follows the component tokens below.

## Component Tokens

| Component | Spec |
| --- | --- |
| **Button — primary** | `secondary` (black) fill, white text, `label-lg`, `sm` radius, `8px 16px` padding, 40px height. Hover → `primary` (blue) fill. |
| **Button — secondary** | `surface` (white) fill, black text, `label-lg`, `sm` radius, `8px 16px` padding, 40px height. Hover → `tertiary` fill. |
| **Button — link** | `surface` fill, `primary` (blue) text, `label-lg`, no radius, no padding. Text-only, for low-emphasis actions. |
| **Card** | `surface` fill, `on-surface` text, `md` radius, `16px` padding. |
| **Input** | `surface` fill, `on-surface` text, `body-md`, `sm` radius, `8px 16px` padding. |
| **Chip** | `tertiary` fill, `on-surface` text, `label-md`, `full` radius, `4px 12px` padding. |

## Elevation

The system is intentionally flat. Hierarchy comes from white-on-white layering, `tertiary` borders, bold type, and black-on-white contrast — not shadow depth. Where a shadow is unavoidable (a floating panel over page content), keep it a single soft, low-opacity layer; never stack shadows or use color-tinted glows.

---

## Design Goals

* Simple and professional enterprise experience
* Consistent Bosch visual identity
* Secure Azure AD / Microsoft Entra ID authentication
* Easy seat and workspace booking
* Meeting and conference room booking
* Clear booking availability
* Responsive design across desktop, tablet, and mobile
* Accessible and keyboard-friendly interface
* Centralized booking management for employees and administrators

---

# Branding Assets

## Bosch Logo

Use the official Bosch corporate logo as the primary brand element.

### Placement

* Top-left section of the login card
* Maintain sufficient whitespace around the logo
* Preserve the original aspect ratio
* Never stretch or distort the logo

---

## Corporate Ribbon (Supergraphic)

The multi-color Bosch supergraphic bar is the application's one signature visual element — everything else in "Bosch Light" is deliberately quiet (flat, black/white/blue), so this is where the brand gets to be loud. It appears as a full-width strip at the very top of every top-level screen: login, the employee portal, and the admin portal alike. Implemented as a CSS gradient (six equal segments) rather than a raster image, so it stays crisp at any width.

### Purpose

* The one place brand identity is allowed to be colorful
* Reinforces that the employee and admin portals are the same product
* Provides a consistent visual anchor independent of page content

### Placement

* Full-width, top of viewport, above any header/nav chrome
* Height: `8px` (thin — a signature accent, not a banner)
* Present on: Login, `MainLayout` (employee portal), `AdminLayout` (admin portal)

---

# Layout Structure

## Login Page Layout

The login screen is divided into two panels.

| Section     | Width | Purpose                              |
| ----------- | ----: | ------------------------------------ |
| Left Panel  |   50% | Branding and application information |
| Right Panel |   50% | Authentication                       |

---

## Visual Hierarchy

```text
+----------------------------------------------------------------+
|                        Corporate Ribbon                         |
+----------------------------------------------------------------+

+----------------------------------------------------------------+
|                         Login Card                              |
|                                                                |
|  LEFT PANEL                         RIGHT PANEL                |
|  -------------------------------    -------------------------- |
|                                                                |
|  Bosch Logo                         Secure Authentication      |
|                                                                |
|  Bosch Seat                         Welcome to                 |
|  Booking App                        Bosch Seat Booking App     |
|                                                                |
|  Workplace Management               Sign in with your Bosch    |
|  Badge                              account                    |
|                                                                |
|                                     [ Sign in with Microsoft ]  |
|                                                                |
|  Copyright                          Terms & Privacy             |
|                                                                |
+----------------------------------------------------------------+
```

---

# Left Panel Design

## Background

Use a light blue-gray background:

```css
background: #F4F8FB;
```

The panel should contain subtle decorative circular elements using low-opacity Bosch blue (`primary` at ~12% opacity).

```css
background: rgba(0, 123, 192, 0.12);
```

---

## Logo

Position:

* Top-left
* Maintain consistent spacing
* Recommended width: `200px–220px`

---

## Product Name

Display:

```text
Bosch Seat
Booking App
```

Alternative compact representation:

```text
Bosch Seat Booking App
```

Typography (headline-lg/display):

* Font: Boschsans
* Weight: 700
* Desktop size: `45px–64px`
* Color: `#000000` (on-surface)

---

## Product Badge

Display:

```text
WORKSPACE MANAGEMENT
```

This is one of the few places the app spends its accent: a `primary`-filled pill on the hero, distinct from the neutral `tertiary` chips used for status elsewhere in the app.

```css
background: #007BC0; /* primary */
color: #FFFFFF;
border-radius: 9999px; /* full */
```

---

## Application Description

Optional supporting text:

```text
Book seats, meeting rooms and collaborative
workspaces with ease.
```

The description should use muted gray text and should not compete with the product title.

---

## Footer

Display:

```text
© 2026 Robert Bosch GmbH. All rights reserved.
```

Use:

* Font size: `12px`
* Color: `#6B7280`

---

# Right Panel Design

## Header Badge

Display:

```text
SECURE AUTHENTICATION
```

Style:

* Bosch blue background
* White text
* Rounded pill
* Small uppercase typography

---

## Welcome Section

### Heading

```text
Welcome to
Bosch Seat Booking App
```

Typography (headline-md):

* Font: Boschsans
* Weight: 700
* Size: `32px–45px`
* Color: `#000000` (on-surface)

---

## Description

Display:

```text
Sign in with your Bosch account to book
seats, meeting rooms and workspaces.
```

Color:

```text
#6B7280
```

Recommended size:

```text
18px
```

---

# Authentication

## Primary CTA

Button text:

```text
Sign in with Microsoft
```

The button should use the Microsoft logo/icon.

### Features

* Full-width authentication button
* Microsoft logo
* Clear hover state
* Disabled state during authentication
* Loading indicator while redirecting
* Keyboard accessibility
* Elevated shadow

### Colors

This is the login page's one primary action, so it follows the `button-primary` token: black fill at rest, blue on hover — the same hierarchy every primary button in the app uses.

| Property   | Value     |
| ---------- | --------- |
| Background | `#000000` (secondary) |
| Text       | `#FFFFFF` |
| Hover      | `#007BC0` (primary) |
| Disabled   | `#9CA3AF` |

### Dimensions

```css
height: 56px;
border-radius: 8px;
width: 100%;
```

---

# Authentication States

## Default

```text
[  Microsoft  Sign in with Microsoft  ]
```

---

## Loading

```text
[  ◌ Signing in...  ]
```

The button should be temporarily disabled to prevent duplicate authentication requests.

---

## Authentication Failure

Display a user-friendly message:

```text
Unable to sign you in.

Please try again or contact your administrator.
```

Do not expose raw Azure authentication errors to normal users.

---

## Unauthorized User

If authentication succeeds but the employee is not authorized:

```text
Your account is not authorized to access
the Bosch Seat Booking App.

Please contact your administrator.
```

---

# Seat Booking Application

After successful authentication, users are redirected to the main dashboard.

```text
Azure AD Login
      ↓
Identity Validation
      ↓
Employee Validation
      ↓
Seat Booking Dashboard
```

---

# Dashboard Design

The dashboard should provide a quick overview of workspace availability.

```text
+----------------------------------------------------------------+
| Bosch Seat Booking App                         User Profile    |
+----------------------------------------------------------------+
|                                                                |
|  Welcome, Employee                                             |
|                                                                |
|  [ Book a Seat ]  [ Meeting Room ]  [ Conference Room ]        |
|                                                                |
|----------------------------------------------------------------|
|                                                                |
|  Today's Availability                                          |
|                                                                |
|  Available Seats     Meeting Rooms     Conference Rooms        |
|       42                  8                    3                |
|                                                                |
|----------------------------------------------------------------|
|                                                                |
|  My Upcoming Bookings                                          |
|                                                                |
|  Seat A-102     Today       09:00 - 18:00                     |
|  Room Atlas     Tomorrow    10:00 - 11:00                     |
|                                                                |
+----------------------------------------------------------------+
```

---

# Booking Types

The application should support multiple workplace booking types.

## 1. Seat Booking

Employees can:

* Search available seats
* Select a floor
* Select a building
* Select a date
* Select time
* View seat availability
* Book a seat
* Cancel a booking
* Modify an existing booking

---

## 2. Meeting Room Booking

Employees can:

* Search meeting rooms
* Select date and time
* Specify meeting duration
* Select capacity
* View room facilities
* Book a meeting room
* Cancel or modify bookings

Example room facilities:

```text
Projector
Video Conference
Whiteboard
Display
Speaker System
Wi-Fi
```

---

## 3. Conference Room Booking

Conference rooms should support larger meetings and events.

Search filters can include:

```text
Building
Floor
Capacity
Date
Start Time
End Time
Equipment
Availability
```

---

## 4. Collaboration Space

Support flexible workspace options such as:

```text
Collaboration Area
Focus Room
Training Room
Lounge Area
Project Space
Workshop Area
```

---

# My Bookings

Users should have a dedicated **My Bookings** section.

```text
+--------------------------------------------------------------+
| My Bookings                                                  |
+--------------------------------------------------------------+
|                                                              |
|  Upcoming                                                   |
|                                                              |
|  Seat A-102                                                 |
|  Today | 09:00 - 18:00                          [Cancel]    |
|                                                              |
|  Meeting Room Atlas                                         |
|  Tomorrow | 10:00 - 11:00                       [Modify]    |
|                                                              |
+--------------------------------------------------------------+
```

Booking types should be clearly identified using icons or badges.

---

# Booking Status

Use consistent status indicators.

| Status      | Meaning                          |
| ----------- | -------------------------------- |
| Available   | Resource can be booked           |
| Booked      | Resource is currently reserved   |
| Pending     | Booking is awaiting confirmation |
| Cancelled   | Booking was cancelled            |
| Completed   | Booking period has ended         |
| Unavailable | Resource cannot be booked        |

---

# Search and Filters

The application should provide centralized search.

Recommended filters:

```text
Building
Floor
Date
Time
Booking Type
Capacity
Availability
Facilities
```

The search interface should remain simple and avoid unnecessary filters until requested by the user.

---

# Admin Portal

Administrators should have additional functionality.

## Admin Capabilities

* Manage buildings
* Manage floors
* Manage seats
* Manage meeting rooms
* Manage conference rooms
* Manage workspace types
* Manage facilities
* Manage employees
* View all bookings
* Cancel bookings
* Configure booking rules
* View utilization reports
* Manage application settings

---

# Admin Dashboard

```text
+--------------------------------------------------------------+
| Admin Dashboard                                              |
+--------------------------------------------------------------+
|                                                              |
|  Total Seats       Meeting Rooms       Today's Bookings       |
|      250                32                  186              |
|                                                              |
|--------------------------------------------------------------|
|                                                              |
|  Resource Management                                         |
|                                                              |
|  [ Buildings ] [ Floors ] [ Seats ] [ Rooms ]               |
|                                                              |
|  Booking Management                                          |
|                                                              |
|  [ All Bookings ] [ Reports ] [ Users ]                     |
|                                                              |
+--------------------------------------------------------------+
```

---

# Chatbot

The application can include an AI-powered booking assistant.

## Chatbot Purpose

The chatbot should help users:

* Find available seats
* Find meeting rooms
* Find conference rooms
* Check existing bookings
* Explain booking policies
* Guide users through the booking process

Example:

```text
User:
Find me a meeting room for 8 people tomorrow at 10 AM.

Assistant:
I found 3 available rooms.

1. Atlas - 10 seats
2. Bosch Room - 12 seats
3. Innovation Room - 10 seats

Would you like to book one?
```

The chatbot should never confirm a booking without explicit user confirmation.

---

# Navigation

Recommended navigation:

```text
Dashboard
│
├── Book a Seat
│
├── Meeting Rooms
│
├── Conference Rooms
│
├── My Bookings
│
├── Calendar
│
└── Profile
```

For administrators:

```text
Admin
│
├── Dashboard
├── Buildings
├── Floors
├── Seats
├── Rooms
├── Bookings
├── Users
└── Reports
```

---

# Color Palette

See **Design Tokens — "Bosch Light"** above for the canonical set. Quick reference:

| Color      | Hex       | Usage                  |
| ---------- | --------- | ---------------------- |
| Primary (Bosch Blue) | `#007BC0` | Links, focus, hover on primary actions — the one strong accent |
| Secondary (Black)    | `#000000` | Headings, body text, primary-button fill |
| Tertiary (Gray)      | `#E5E7EB` | Borders, dividers, chips |
| Neutral / Surface    | `#FFFFFF` | Page and component backgrounds |
| Error                | `#D00000` | Validation and destructive states only |

There is no red "brand accent" in this palette — destructive actions use `error`, sparingly, and everything else stays black, white, or blue.

---

# Typography

Primary font:

```text
Boschsans
```

Fallback:

```css
font-family:
'Boschsans',
'Helvetica Neue',
Helvetica,
Arial,
sans-serif;
```

Letter-spacing is `0px` across every style — see the full type scale in Design Tokens above (headline-display through caption).

## Text Styles (legacy names → token)

| Element           | Token             |    Size |  Weight |
| ----------------- | ----------------- | ------: | ------: |
| Application Title | headline-display   |    64px |     700 |
| Page Heading      | headline-lg/md      | 32–45px | 700 |
| Section Heading   | headline-sm        |    23px |     600 |
| Body              | body-md            |    16px |     400 |
| Subtitle          | body-lg            |    18px |     400 |
| Button            | label-lg           |    16px |     400 |
| Badge / Chip      | label-md           |    14px |     400 |
| Footer / Caption  | caption            |    12px |     400 |

---

# Cards and Surfaces

Application cards follow the `card` component token: flat, bordered, minimally shadowed.

```css
background: #FFFFFF;   /* surface */
border: 1px solid #E5E7EB; /* tertiary */
border-radius: 8px;    /* md */
padding: 16px;
```

Avoid heavy or stacked shadows — see Elevation in Design Tokens. Hierarchy comes from the border and bold type, not depth.

Cards should primarily be used for:

* Seat availability
* Room availability
* Booking summaries
* Dashboard statistics
* User information

---

# Buttons

Three button roles, per the Design Tokens component table — never invent a fourth.

## Primary Button

```text
Book Now
```

Black (`secondary`) fill, white text, `sm` (4px) radius, 40px height. Hover → blue (`primary`) fill. This is the strongest action in a flow — one per view.

## Secondary Button

```text
View Details
```

White (`surface`) fill, black text and border, same radius and height as primary. Hover → `tertiary` gray fill.

## Link Button

```text
Manage Notification Settings
```

Text-only, blue (`primary`), no fill or border — for low-emphasis actions like settings or policy links.

## Destructive Button

```text
Cancel Booking
```

Same shape as the secondary button, but text and border in `error` (`#D00000`) — used sparingly so it doesn't compete with blue as the system's one loud color.

---

# Accessibility

The application should target **WCAG 2.1 AA**.

## Requirements

* Keyboard navigation
* Visible focus indicators
* Screen-reader-compatible labels
* Sufficient color contrast
* Accessible buttons
* Accessible form controls
* Clear validation messages
* Do not rely only on color to indicate booking status

Authentication button:

```html
aria-label="Sign in with Microsoft"
```

---

# Responsive Behavior

## Desktop ≥1200px

* Two-column login screen
* Full dashboard navigation
* Multi-column resource cards
* Calendar and booking information displayed side-by-side

---

## Tablet 768px–1199px

* Reduced card width
* Responsive navigation
* Two-column resource cards where space permits
* Reduced spacing

---

## Mobile <768px

Login:

```text
Branding
   ↓
Authentication
```

Application:

```text
Dashboard
   ↓
Booking Type
   ↓
Search
   ↓
Available Resources
   ↓
Booking Details
```

The booking button should remain easily accessible.

---

# User Flow

## Employee Booking Flow

```text
User Opens Application
        ↓
Bosch Login Page
        ↓
Sign in with Microsoft
        ↓
Microsoft Entra ID
        ↓
Identity Validation
        ↓
Dashboard
        ↓
Select Booking Type
        ↓
Search Availability
        ↓
Select Seat / Room
        ↓
Select Date & Time
        ↓
Review Booking
        ↓
Confirm Booking
        ↓
Booking Created
        ↓
My Bookings
```

---

# Security Considerations

The application should use enterprise security best practices.

* Microsoft Entra ID / Azure AD SSO
* HTTPS-only production deployment
* Backend token validation
* Secure session management
* Authorization based on user roles
* Admin access control
* CSRF protection where applicable
* Secure API communication
* No client secrets in frontend code
* No password storage
* Audit logging for administrative actions
* Booking ownership validation
* Server-side availability validation

---

# Booking Conflict Prevention

The backend must always validate availability before creating a booking.

```text
User selects resource
        ↓
Frontend sends booking request
        ↓
Backend checks availability
        ↓
Resource available?
      /       \
    YES        NO
     ↓          ↓
Create       Reject
Booking      Booking
     ↓          ↓
Success      Show conflict
```

Frontend availability should not be treated as the final source of truth.

The backend/database must prevent duplicate or overlapping bookings.

---

# Design Principles

The application should follow these principles:

### Clean

Avoid unnecessary visual elements.

### Professional

Maintain an enterprise application appearance.

### Bosch-Inspired

Use Bosch colors and branding consistently without overusing brand accents.

### Simple

Users should be able to book a seat or room with minimal steps.

### Accessible

Ensure keyboard and screen-reader compatibility.

### Responsive

The application should work across desktop, tablet, and mobile.

### Consistent

Use the same colors, typography, spacing, buttons, cards, and status indicators throughout the application.

---

# Future Enhancements

Potential future features include:

1. Interactive office floor map
2. Visual seat selection
3. QR-code check-in
4. Automatic booking cancellation for no-shows
5. Calendar integration
6. Outlook integration
7. Teams meeting integration
8. Email notifications
9. Microsoft Teams notifications
10. Recurring bookings
11. Favorite seats and rooms
12. Workspace recommendations
13. Occupancy analytics
14. Booking utilization reports
15. AI-powered workspace recommendations
16. Visitor booking
17. Parking booking
18. Equipment booking
19. Employee location/status integration
20. Mobile/PWA support

---

# Design Summary

The **Bosch Seat Booking App** should provide a clean, modern, and enterprise-focused workspace booking experience.

The design combines:

```text
Bosch Branding
      +
Microsoft Entra ID
      +
Seat Booking
      +
Meeting Room Booking
      +
Conference Room Booking
      +
Workspace Management
      +
AI Booking Assistant
      +
Responsive Enterprise UI
```

The primary experience should follow:

**Discover → Select → Review → Confirm → Manage**

The interface should remain simple for employees while providing administrators with powerful resource and booking management capabilities.

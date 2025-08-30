# Wireframes and Screen Layouts - RegularTravelManager

**Date:** 2025-08-30
**Created by:** UX Design Session via Claude Code

## Overview

This document presents wireframes for all core screens in the RegularTravelManager application, organized by user type and workflow stage. Each wireframe includes layout specifications, component placement, and responsive considerations.

**Design System:** Angular Material v17
**Grid System:** 24-column grid with responsive breakpoints
**Breakpoints:** xs (< 576px), sm (≥ 576px), md (≥ 768px), lg (≥ 992px), xl (≥ 1200px), xxl (≥ 1600px)

---

## Screen Inventory

### Authentication Screens
1. Login Screen
2. Password Reset Screen

### Employee Screens  
3. Employee Dashboard
4. New Request Form
5. Request Details View
6. Request History

### Manager Screens
7. Manager Dashboard  
8. Employee Search & Overview
9. Request Review Screen
10. Decision History

### Shared Screens
11. Profile Settings
12. Notifications Center

---

## Wireframes

### 1. Login Screen

```
┌─────────────────────────────────────────────────────────────┐
│                    RegularTravelManager                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                      [LOGO/BRAND]                          │
│                                                             │
│                Travel Allowance Management                   │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  Email/Username                 │           │
│              │  ┌─────────────────────────────┐ │           │
│              │  │                             │ │           │
│              │  └─────────────────────────────┘ │           │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  Password                       │           │
│              │  ┌─────────────────────────────┐ │           │
│              │  │  ••••••••••••••••••••••••  │ │           │
│              │  └─────────────────────────────┘ │           │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ☐ Remember me       [Forgot Password?]        │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │           Sign In               │           │
│              └─────────────────────────────────────┘           │
│                                                             │
│                 Powered by AWS Cognito                     │
└─────────────────────────────────────────────────────────────┘
```

**Components:**
- `mat-form-field` (Angular Material)
- `mat-input` with icons
- `input[matInput]` type="password"
- `mat-checkbox` for remember me
- `button[mat-raised-button]` color="primary" for sign in
- `a[mat-button]` for forgot password

**Responsive Behavior:**
- Mobile: Full width form, larger touch targets
- Desktop: Centered form with max-width 400px

---

### 2. Employee Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ [☰] RegularTravelManager    [🔔] [Sarah Mueller ▼] [Logout] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Welcome back, Sarah!                           [+ New Request]│
│                                                             │
│ ┌─── Quick Stats ──────────────────────────────────────────┐ │
│ │ Pending: 2    Approved: 12    This Month: CHF 450      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─── Recent Requests ─────────────────────────────────────┐ │
│ │                                                         │ │
│ │ Project Alpha - Subproject A              [Pending]     │ │
│ │ 3 days/week | Thomas Weber | CHF 120      [View]       │ │
│ │ ────────────────────────────────────────────────────────│ │
│ │ Project Beta - Development                [Approved]    │ │
│ │ 2 days/week | Thomas Weber | CHF 80       [View]       │ │
│ │ ────────────────────────────────────────────────────────│ │
│ │ Project Gamma - Testing                   [Rejected]    │ │
│ │ 4 days/week | Maria Schmidt | CHF 160     [View]       │ │
│ │                                                         │ │
│ │                                      [View All History] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─── Notifications ───────────────────────────────────────┐ │
│ │ • Your request for Project Alpha has been approved      │ │
│ │ • Reminder: Project Beta travel starts Monday          │ │
│ │                                         [Mark All Read] │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Components:**
- `mat-toolbar` with navigation
- `mat-sidenav` for mobile navigation
- `mat-card` with statistics
- `mat-list` for recent requests
- `mat-chip` for status indicators
- `mat-button` for actions
- `mat-card` for content sections

**Responsive Behavior:**
- Mobile: Stack cards vertically, hamburger menu, bottom action button
- Desktop: Two-column layout for stats and notifications

---

### 3. New Request Form

```
┌─────────────────────────────────────────────────────────────┐
│ [←] Submit Travel Allowance Request                [Cancel] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─── Project Information ────────────────────────────────┐  │
│ │                                                        │  │
│ │ Project *                                              │  │
│ │ ┌────────────────────────────────────┐ [Search...]    │  │
│ │ │ Project Alpha                      ▼│                │  │
│ │ └────────────────────────────────────┘                │  │
│ │                                                        │  │
│ │ Subproject *                                           │  │
│ │ ┌────────────────────────────────────┐                │  │
│ │ │ Subproject A - Zurich Office       ▼│                │  │
│ │ └────────────────────────────────────┘                │  │
│ │                                                        │  │
│ │ ✓ Project location: Zurich, Switzerland               │  │
│ │ ✓ Distance from home: ~45 km                          │  │
│ │ ✓ Estimated allowance: CHF 2.50/km = CHF 112.50/day  │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─── Request Details ────────────────────────────────────┐  │
│ │                                                        │  │
│ │ Days per Week *                                        │  │
│ │ ┌─┐ ┌─┐ ┌─┐ ┌─┐ ┌─┐                                  │  │
│ │ │1│ │2│ │3│ │4│ │5│                                  │  │
│ │ └─┘ └─┘ └─┘ └─┘ └─┘                                  │  │
│ │                                                        │  │
│ │ Approving Manager *                                    │  │
│ │ ┌────────────────────────────────────┐                │  │
│ │ │ Thomas Weber                        │                │  │
│ │ └────────────────────────────────────┘                │  │
│ │                                                        │  │
│ │ Justification *                                        │  │
│ │ ┌────────────────────────────────────┐                │  │
│ │ │ Required for daily client meetings │                │  │
│ │ │ and project coordination at the    │                │  │
│ │ │ Zurich office location.            │                │  │
│ │ │                                    │                │  │
│ │ └────────────────────────────────────┘                │  │
│ │                                                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─── Summary ────────────────────────────────────────────┐  │
│ │ Weekly allowance: CHF 337.50 (3 days × CHF 112.50)   │  │
│ │ Monthly estimate: CHF 1,350.00                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│                           [Submit Request] [Save Draft]     │
└─────────────────────────────────────────────────────────────┘
```

**Components:**
- `Form` with validation
- `Select` with search for project selection
- `Cascader` for project/subproject relationship
- `Radio.Group` for days per week
- `AutoComplete` for manager name
- `Input.TextArea` for justification
- `Alert` for calculation preview
- `Button` group for actions

**Responsive Behavior:**
- Mobile: Single column, larger form fields, sticky submit button
- Desktop: Optimal form width, side-by-side layout for related fields

---

### 4. Manager Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ [☰] RegularTravelManager    [🔔] [Thomas Weber ▼] [Logout]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Manager Dashboard                        [Search Employees] │
│                                                             │
│ ┌─── Pending Approvals ──────────────────────────────────┐  │
│ │                                                        │  │
│ │ 🔴 URGENT (3)                                         │  │
│ │ Sarah Mueller - Project Alpha         CHF 337.50/wk   │  │
│ │ 3 days/week | 2 days ago            [Review] [Quick ✓] │  │
│ │ ────────────────────────────────────────────────────── │  │
│ │ Mark Johnson - Project Beta          CHF 200.00/wk    │  │
│ │ 2 days/week | 1 day ago             [Review] [Quick ✓] │  │
│ │ ────────────────────────────────────────────────────── │  │
│ │ Lisa Chen - Project Gamma            CHF 450.00/wk    │  │
│ │ 4 days/week | 5 hours ago           [Review] [Quick ✓] │  │
│ │                                                        │  │
│ │                                          [View All (8)] │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─── Quick Stats ────────────────────────────────────────┐  │
│ │ This Month Approved: CHF 4,250    Team Members: 12    │  │
│ │ Pending Reviews: 8                Average: CHF 354/wk │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─── Recent Decisions ───────────────────────────────────┐  │
│ │ ✅ Approved: Mike Davis - Project Delta | CHF 225/wk  │  │
│ │ ❌ Rejected: Anna Weber - Project Echo | See comments  │  │
│ │ ✅ Approved: Tom Smith - Project Foxtrot | CHF 180/wk │  │
│ │                                      [View All History] │  │
│ └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Components:**
- `Layout` with responsive header
- `Badge` for urgent items count
- `List` with custom item rendering
- `Statistic` for dashboard metrics
- `Button` with different types for actions
- `Timeline` for recent decisions
- `Tag` for status indicators

**Responsive Behavior:**
- Mobile: Single column layout, collapsible sections
- Desktop: Multi-column dashboard with side panels

---

### 5. Request Review Screen (Manager)

```
┌─────────────────────────────────────────────────────────────┐
│ [←] Review Request: Sarah Mueller                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─── Employee Information ───────────────────────────────┐  │
│ │ Sarah Mueller                              📧 Contact   │  │
│ │ Project Manager | Marketing Department                  │  │
│ │ Home: 8001 Zurich | Started: Jan 2023                 │  │
│ │                                                        │  │
│ │ Recent Travel History:                                 │  │
│ │ • Project Beta: CHF 1,200 (approved 3 months ago)    │  │
│ │ • Project Delta: CHF 800 (approved 1 month ago)      │  │
│ │ Total this year: CHF 3,450                           │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─── Request Details ────────────────────────────────────┐  │
│ │                                                        │  │
│ │ Project: Project Alpha                                 │  │
│ │ Subproject: Subproject A - Zurich Office             │  │
│ │ Location: Bahnhofstrasse 15, 8001 Zurich             │  │
│ │                                                        │  │
│ │ 📍 Distance Calculation:                              │  │
│ │ From: Employee home (8001 Zurich)                     │  │
│ │ To: Project location (Bahnhofstrasse 15, 8001 Zurich)│  │
│ │ Straight-line distance: 4.2 km                       │  │
│ │ Rate: CHF 2.50 per km                                │  │
│ │ Daily allowance: CHF 10.50                           │  │
│ │                                                        │  │
│ │ Frequency: 3 days per week                           │  │
│ │ Weekly allowance: CHF 31.50                          │  │
│ │ Monthly estimate: CHF 126.00                         │  │
│ │                                                        │  │
│ │ Employee Justification:                               │  │
│ │ "Required for daily client meetings and project       │  │
│ │ coordination at the Zurich office location."          │  │
│ │                                                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─── Decision ───────────────────────────────────────────┐  │
│ │                                                        │  │
│ │ ○ Approve Request                                      │  │
│ │ ● Reject Request                                       │  │
│ │                                                        │  │
│ │ Comments (required for rejection):                     │  │
│ │ ┌────────────────────────────────────────────────────┐ │  │
│ │ │ The distance seems too short to justify travel    │ │  │
│ │ │ allowance. Consider using public transport or     │ │  │
│ │ │ virtual meetings for this location.               │ │  │
│ │ └────────────────────────────────────────────────────┘ │  │
│ │                                                        │  │
│ │                    [Submit Decision] [Cancel]          │  │
│ └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Components:**
- `Descriptions` for employee information
- `Card` for organized content sections
- `Radio.Group` for approve/reject decision
- `Input.TextArea` for comments
- `Alert` for calculation details
- `Button` group for final actions
- `Typography.Text` for formatted content

**Responsive Behavior:**
- Mobile: Single column, expandable sections, sticky decision panel
- Desktop: Two-column layout with employee info sidebar

---

### 6. Mobile-First Responsive Layouts

#### Mobile Navigation Pattern (< 768px)
```
┌─────────────────────────┐
│ [☰] TravelMgr    [🔔]   │
├─────────────────────────┤
│                         │
│ Drawer Menu:            │
│ ┌─────────────────────┐ │
│ │ 🏠 Dashboard        │ │
│ │ ➕ New Request      │ │
│ │ 📋 My Requests      │ │
│ │ 👤 Profile          │ │
│ │ 🔔 Notifications    │ │
│ │ ⚙️ Settings         │ │
│ │ 🚪 Sign Out         │ │
│ └─────────────────────┘ │
└─────────────────────────┘
```

#### Tablet Layout (768px - 992px)
- Collapsed sidebar navigation
- Two-column content layout
- Touch-friendly form elements

#### Desktop Layout (> 992px)  
- Full sidebar navigation
- Multi-column dashboard
- Hover states and tooltips

---

## Component Specifications Summary

### Form Components
- **Input validation:** Real-time validation with clear error messages
- **Required field indicators:** Asterisk (*) with red color
- **Help text:** Contextual guidance below form fields
- **Loading states:** Spinner overlays during submission

### Navigation Components  
- **Breadcrumbs:** For deep navigation paths
- **Active states:** Clear indication of current page/section
- **Mobile menu:** Hamburger menu with slide-out drawer

### Data Display
- **Status indicators:** Color-coded badges (pending=orange, approved=green, rejected=red)
- **Currency formatting:** CHF with proper decimal places
- **Date formatting:** Relative dates (2 days ago) with absolute on hover

### Action Components
- **Primary actions:** Filled buttons in brand color
- **Secondary actions:** Outlined buttons
- **Destructive actions:** Red color with confirmation modals

---

## Accessibility Considerations

### WCAG 2.1 AA Compliance
- **Color contrast:** Minimum 4.5:1 ratio for normal text
- **Focus indicators:** Clear focus states for keyboard navigation  
- **Screen reader support:** Proper ARIA labels and descriptions
- **Keyboard navigation:** All functions accessible via keyboard

### Form Accessibility
- **Label association:** Explicit label-input relationships
- **Error announcements:** Screen reader alerts for validation errors
- **Required field indication:** Both visual and programmatic indicators

---

## Next Steps

1. **Interactive Prototypes** - Create clickable prototypes using design tools
2. **Component Library** - Build Angular Material component specifications
3. **Design Tokens** - Define color palette, typography, spacing system
4. **User Testing** - Validate wireframes with actual users
5. **Development Handoff** - Create detailed specifications for developers

These wireframes provide a solid foundation for building an intuitive, efficient travel allowance management system that serves both employee and manager needs effectively.
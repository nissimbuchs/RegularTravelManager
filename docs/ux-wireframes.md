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

### Epic 5.1: User Management Screens
13. User Registration Form (Multi-Step Implementation - Story 5.1 ✅)
14. Email Verification Component (Story 5.1 ✅)
15. Admin User Management Dashboard
16. User Role Assignment
17. Manager Team Management
18. Employee Profile Management

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

## Epic 5.1: User Management Wireframes

### 13. User Registration Form (Story 5.1 Implementation)

**Multi-Step Registration Process with State Management**

#### Step 1: Registration Form
```
┌─────────────────────────────────────────────────────────────┐
│                     RegularTravelManager                    │
│                    [🔲 ELCA SQUARE LOGO]                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                   Create Your Account                       │
│           Join RegularTravelManager to manage your         │
│                    travel allowances                        │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  First Name *                   │           │
│              │  ┌─────────────────────────────┐ │           │
│              │  │                             │ │           │
│              │  └─────────────────────────────┘ │           │
│              │  ⚠ First name is required                  │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  Last Name *                    │           │
│              │  ┌─────────────────────────────┐ │           │
│              │  │                             │ │           │
│              │  └─────────────────────────────┘ │           │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  Email *                        │           │
│              │  ┌─────────────────────────────┐ │           │
│              │  │                             │ │           │
│              │  └─────────────────────────────┘ │           │
│              │  ⚠ Please enter a valid email             │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  Password *                     │           │
│              │  ┌─────────────────────────────┐ │           │
│              │  │  ••••••••••••••••••••••••  │ │           │
│              │  └─────────────────────────────┘ │           │
│              │  Minimum 8 characters with uppercase,      │
│              │  lowercase, number, and special character  │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  Confirm Password *             │           │
│              │  ┌─────────────────────────────┐ │           │
│              │  │  ••••••••••••••••••••••••  │ │           │
│              │  └─────────────────────────────┘ │           │
│              │  ⚠ Passwords don't match                   │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ─────── Home Address ──────                   │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  Street Address *               │           │
│              │  ┌─────────────────────────────┐ │           │
│              │  │                             │ │           │
│              │  └─────────────────────────────┘ │           │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  City *                         │           │
│              │  ┌─────────────────────────────┐ │           │
│              │  │                             │ │           │
│              │  └─────────────────────────────┘ │           │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  Postal Code *                  │           │
│              │  ┌─────────────────────────────┐ │           │
│              │  │ 1234                        │ │           │
│              │  └─────────────────────────────┘ │           │
│              │  Swiss postal code (4 digits)              │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  Country *                      │           │
│              │  ┌─────────────────────────────┐ │           │
│              │  │ Switzerland                 │ │ [READ-ONLY]
│              │  └─────────────────────────────┘ │           │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ☐ I accept the Terms of Service              │
│              ☐ I accept the Privacy Policy               │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  👤 Create Account              │ [ELCA RED] │
│              └─────────────────────────────────────┘           │
│                                                             │
│           Already have an account? [Sign In]               │
└─────────────────────────────────────────────────────────────┘
```

#### Step 2: Processing State
```
┌─────────────────────────────────────────────────────────────┐
│                     RegularTravelManager                    │
│                    [🔲 ELCA SQUARE LOGO]                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                         ⏳                                  │
│                                                             │
│                  Creating Your Account...                   │
│                                                             │
│          Please wait while we process your registration.    │
│                                                             │
│                    [LOADING SPINNER]                        │
│                                                             │
│                                                             │
│              Debug: Current step = submitting              │
│              Loading = true                                 │
└─────────────────────────────────────────────────────────────┘
```

#### Step 3: Email Verification Sent
```
┌─────────────────────────────────────────────────────────────┐
│                     RegularTravelManager                    │
│                    [🔲 ELCA SQUARE LOGO]                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                         📧                                  │
│                                                             │
│                   Check Your Email                          │
│                                                             │
│       Registration successful! Please check your email     │
│       for verification instructions. The verification      │
│       link will expire in 24 hours.                       │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  ↻ Resend Email                 │           │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  ← Back to Form                 │           │
│              └─────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

#### Step 4: Registration Complete
```
┌─────────────────────────────────────────────────────────────┐
│                     RegularTravelManager                    │
│                    [🔲 ELCA SQUARE LOGO]                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                         ✅                                  │
│                                                             │
│                 Registration Complete!                      │
│                                                             │
│         Your email has been verified and your account      │
│            is now active. You can now log in.             │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  🚪 Go to Login                 │ [ELCA RED] │
│              └─────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

#### Step 5: Error State
```
┌─────────────────────────────────────────────────────────────┐
│                     RegularTravelManager                    │
│                    [🔲 ELCA SQUARE LOGO]                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                         ❌                                  │
│                                                             │
│                 Registration Failed                         │
│                                                             │
│          An account with this email address already        │
│       exists. Please try logging in or use the password    │
│                    reset feature.                          │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  ← Try Again                    │           │
│              └─────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Components:**
- `mat-card` with centered content and gradient background
- `mat-form-field` with "outline" appearance for all inputs
- `mat-checkbox` for terms/privacy acceptance
- `mat-button` with Material icons for actions
- `mat-spinner` for loading states
- `mat-icon` for status indicators (success, error, email)
- State-driven template rendering with `*ngIf` conditions
- Real-time form validation with `mat-error` messages
- Responsive design with mobile-first approach

**Key Features Implemented:**
- ✅ Multi-step wizard with state management
- ✅ Swiss postal code validation (4 digits)
- ✅ Password strength validation with hints
- ✅ Email verification flow with 24-hour expiration
- ✅ Comprehensive error handling with user-friendly messages
- ✅ Debug information for development mode
- ✅ ELCA branding integration with coral-red primary color
- ✅ Angular Material design system compliance
- ✅ Mobile-responsive layout with gradient background

### 14. Email Verification Component (Story 5.1 Implementation)

**Standalone Email Verification Handler with URL Token Processing**

#### Email Verification Success
```
┌─────────────────────────────────────────────────────────────┐
│                     RegularTravelManager                    │
│                    [🔲 ELCA SQUARE LOGO]                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                         ✅                                  │
│                                                             │
│               Email Successfully Verified!                  │
│                                                             │
│         Your email has been successfully verified!         │
│         You can now log in to your account.               │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  🚪 Go to Login                 │ [ELCA RED] │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  ← Back to Home                 │           │
│              └─────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

#### Email Verification Expired
```
┌─────────────────────────────────────────────────────────────┐
│                     RegularTravelManager                    │
│                    [🔲 ELCA SQUARE LOGO]                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                         ⏰                                  │
│                                                             │
│               Verification Link Expired                     │
│                                                             │
│         Your verification link has expired. Please         │
│         request a new verification email.                  │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  📧 Request New Email           │ [ELCA RED] │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  ← Back to Registration         │           │
│              └─────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

#### Email Verification Error
```
┌─────────────────────────────────────────────────────────────┐
│                     RegularTravelManager                    │
│                    [🔲 ELCA SQUARE LOGO]                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                         ❌                                  │
│                                                             │
│               Email Verification Failed                     │
│                                                             │
│         The verification link is invalid. Please           │
│         check your email for the correct link.            │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  ↻ Try Again                    │           │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  📧 Resend Verification         │           │
│              └─────────────────────────────────────┘           │
│                                                             │
│              ┌─────────────────────────────────┐           │
│              │  ← Back to Registration         │           │
│              └─────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

#### Email Verification Loading
```
┌─────────────────────────────────────────────────────────────┐
│                     RegularTravelManager                    │
│                    [🔲 ELCA SQUARE LOGO]                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                         ⏳                                  │
│                                                             │
│                 Verifying Your Email...                     │
│                                                             │
│          Please wait while we verify your email            │
│                      address.                              │
│                                                             │
│                    [LOADING SPINNER]                        │
│                                                             │
│              Current Status: Verifying token               │
│              Token: abc123...                              │
│              Email: user@example.com                       │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Features:**
- Automatic token processing from URL parameters
- Real-time verification API calls
- Comprehensive error handling for expired/invalid tokens
- Swiss business email integration
- ELCA branding consistency
- Mobile-responsive design with centered layout
- Angular Material components (`mat-card`, `mat-spinner`, `mat-icon`)
- State management with loading/success/error states
- Integration with Cognito for production and mock for local development

**Key Components Implemented:**
- ✅ URL parameter token extraction and validation
- ✅ Real-time API verification with proper error handling
- ✅ Token expiration detection (24-hour limit)
- ✅ User-friendly status messages for all scenarios
- ✅ Navigation options for next steps (login, resend, retry)
- ✅ Professional Swiss business email templates
- ✅ Environment-aware verification (local bypass)
- ✅ Complete integration with registration flow

### 15. Admin User Management Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ [☰] 🔲 ELCA TravelManager   [🔔] [Admin User ▼] [Logout]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ User Management                     [+ Invite New User]     │  [ELCA RED]
│                                                             │
│ ┌─── Search & Filter ────────────────────────────────────┐  │
│ │ Search: [____________________] [🔍]                    │  │
│ │ Role: [All ▼] Status: [Active ▼] Department: [All ▼]  │  │
│ │                                            [Export CSV] │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─── User List ──────────────────────────────────────────┐  │
│ │ ┌─┐ Name              Role        Status    Last Login │  │
│ │ │☐│ ──────────────────────────────────────────────────│  │
│ │ │☐│ Sarah Mueller     Employee    Active    2 hours ago│  │
│ │ │ │ sarah.mueller@company.ch              [Edit] [View]│  │
│ │ │☐│ ──────────────────────────────────────────────────│  │
│ │ │☐│ Thomas Weber      Manager     Active    1 day ago │  │
│ │ │ │ thomas.weber@company.ch    👥 12 employees        │  │
│ │ │ │                                       [Edit] [View]│  │
│ │ │☐│ ──────────────────────────────────────────────────│  │
│ │ │☐│ Maria Schmidt     Admin       Active    Just now  │  │
│ │ │ │ maria.schmidt@company.ch              [Edit] [View]│  │
│ │ │☐│ ──────────────────────────────────────────────────│  │
│ │ │☐│ John Inactive     Employee    Inactive  30 days   │  │
│ │ │ │ john.inactive@company.ch              [Edit] [View]│  │
│ │ │☐│ ──────────────────────────────────────────────────│  │
│ │                                                        │  │
│ │ [Bulk Actions ▼] [3 selected]            Page 1 of 5 │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─── Quick Stats ────────────────────────────────────────┐  │
│ │ Total Users: 124      Active: 118      Pending: 6    │  │
│ │ Employees: 98         Managers: 20     Admins: 6     │  │
│ └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 15. User Role Assignment Modal

```
┌─────────────────────────────────────────────────────────────┐
│                     Edit User: Sarah Mueller               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─── Basic Information ──────────────────────────────────┐  │
│ │                                                        │  │
│ │ Name: Sarah Mueller                                    │  │
│ │ Email: sarah.mueller@company.ch                        │  │
│ │ Status: ● Active  ○ Inactive                          │  │
│ │ Last Login: 2 hours ago                               │  │
│ │                                                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─── Role Assignment ────────────────────────────────────┐  │
│ │                                                        │  │
│ │ Current Role: Employee                                 │  │
│ │                                                        │  │
│ │ Change to: ● Employee  ○ Manager  ○ Administrator     │  │
│ │                                                        │  │
│ │ ⚠️  Role changes take effect immediately              │  │
│ │                                                        │  │
│ │ Manager Assignment:                                    │  │
│ │ ┌────────────────────────────────────┐                │  │
│ │ │ Thomas Weber                       ▼│                │  │
│ │ └────────────────────────────────────┘                │  │
│ │                                                        │  │
│ │ Department:                                           │  │
│ │ ┌────────────────────────────────────┐                │  │
│ │ │ Marketing                          ▼│                │  │
│ │ └────────────────────────────────────┘                │  │
│ │                                                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─── Travel Information ─────────────────────────────────┐  │
│ │                                                        │  │
│ │ Home Address: Bahnhofstrasse 1, 8001 Zurich          │  │
│ │ Coordinates: 47.3769, 8.5417                         │  │
│ │ Active Requests: 2 pending, 15 approved this year    │  │
│ │                                                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│                    [Save Changes] [Cancel]                 │
└─────────────────────────────────────────────────────────────┘
```

### 16. Manager Team Management

```
┌─────────────────────────────────────────────────────────────┐
│ [☰] 🔲 ELCA TravelManager   [🔔] [Thomas Weber ▼] [Logout] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ My Team Management                          [Team Report]   │
│                                                             │
│ ┌─── Team Overview ──────────────────────────────────────┐  │
│ │ Team Size: 12 members    Active Requests: 8           │  │
│ │ This Month Expenses: CHF 4,250    Budget: CHF 6,000   │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─── Team Members ───────────────────────────────────────┐  │
│ │                                                        │  │
│ │ Sarah Mueller                              [💼 Employee] │  │
│ │ sarah.mueller@company.ch | Marketing Dept             │  │
│ │ Home: 8001 Zurich | Active Requests: 2               │  │
│ │ This Month: CHF 450 | Last Request: 2 days ago       │  │
│ │                                  [View Profile] [Edit] │  │
│ │ ────────────────────────────────────────────────────── │  │
│ │                                                        │  │
│ │ Mark Johnson                               [💼 Employee] │  │
│ │ mark.johnson@company.ch | Sales Dept                  │  │
│ │ Home: 8002 Zurich | Active Requests: 1               │  │
│ │ This Month: CHF 300 | Last Request: 1 week ago       │  │
│ │                                  [View Profile] [Edit] │  │
│ │ ────────────────────────────────────────────────────── │  │
│ │                                                        │  │
│ │ Lisa Chen                                  [💼 Employee] │  │
│ │ lisa.chen@company.ch | Marketing Dept                 │  │
│ │ Home: 8003 Zurich | Active Requests: 0               │  │
│ │ This Month: CHF 200 | Last Request: 2 weeks ago      │  │
│ │                                  [View Profile] [Edit] │  │
│ │ ────────────────────────────────────────────────────── │  │
│ │                                                        │  │
│ │                                     [Show All 12 ▼]   │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─── Team Insights ──────────────────────────────────────┐  │
│ │ Top Travelers: Sarah (CHF 450), Mark (CHF 300)       │  │
│ │ Avg Request Value: CHF 285  |  Approval Rate: 94%    │  │
│ │ Most Active Projects: Alpha (5), Beta (3), Gamma (2) │  │
│ └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 17. Employee Profile Management (Enhanced)

```
┌─────────────────────────────────────────────────────────────┐
│ [←] Profile Settings                               [Save]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─── Personal Information ───────────────────────────────┐  │
│ │                                                        │  │
│ │ First Name *                                           │  │
│ │ ┌────────────────────────────────────┐                │  │
│ │ │ Sarah                              │                │  │
│ │ └────────────────────────────────────┘                │  │
│ │                                                        │  │
│ │ Last Name *                                            │  │
│ │ ┌────────────────────────────────────┐                │  │
│ │ │ Mueller                            │                │  │
│ │ └────────────────────────────────────┘                │  │
│ │                                                        │  │
│ │ Email Address                                          │  │
│ │ ┌────────────────────────────────────┐                │  │
│ │ │ sarah.mueller@company.ch           │ [🔒 Protected] │  │
│ │ └────────────────────────────────────┘                │  │
│ │ Email changes require verification                     │  │
│ │                                                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─── Home Address ───────────────────────────────────────┐  │
│ │                                                        │  │
│ │ Street Address *                                       │  │
│ │ ┌────────────────────────────────────┐                │  │
│ │ │ Bahnhofstrasse 1                   │                │  │
│ │ └────────────────────────────────────┘                │  │
│ │                                                        │  │
│ │ City *                   Postal Code *                 │  │
│ │ ┌──────────────────┐    ┌──────────────────┐           │  │
│ │ │ Zurich           │    │ 8001             │           │  │
│ │ └──────────────────┘    └──────────────────┘           │  │
│ │                                                        │  │
│ │ Country *                                              │  │
│ │ ┌────────────────────────────────────┐                │  │
│ │ │ Switzerland                        ▼│                │  │
│ │ └────────────────────────────────────┘                │  │
│ │                                                        │  │
│ │ 📍 Coordinates: 47.3769, 8.5417                      │  │
│ │ ⚠️ Address changes recalculate pending requests       │  │
│ │                                                        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│ ┌─── Account Settings ───────────────────────────────────┐  │
│ │                                                        │  │
│ │ ☐ Email notifications for request updates             │  │
│ │ ☐ Weekly travel expense summaries                     │  │
│ │ ☐ Manager decision notifications                      │  │
│ │                                                        │  │
│ │ Account Role: Employee                                 │  │
│ │ Manager: Thomas Weber                                  │  │
│ │ Member Since: January 2024                            │  │
│ │                                                        │  │
│ │                              [Change Password]        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                             │
│                        [Save Changes] [Cancel]             │
└─────────────────────────────────────────────────────────────┘
```

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
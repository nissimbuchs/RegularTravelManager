# User Journey Maps - RegularTravelManager

**Date:** 2025-08-30
**Created by:** UX Design Session via Claude Code

## Executive Summary

This document outlines the complete user journeys for both Employee and Manager personas in the RegularTravelManager system. These journeys are based on the brainstorming session results and technical architecture, focusing on the core workflow: Submit → Review → Approve/Reject → Notify.

## User Personas

### Employee Persona: "Traveling Professional"
- **Name:** Sarah Mueller
- **Role:** Project Manager
- **Goals:** Submit travel allowance requests efficiently, track approval status, receive clear communication about decisions
- **Pain Points:** Manual processes, unclear approval timelines, lack of transparency in decision-making
- **Tech Comfort:** Medium-High (uses business applications daily)

### Manager Persona: "Approval Decision Maker"
- **Name:** Thomas Weber
- **Role:** Department Manager
- **Goals:** Review requests efficiently, make informed decisions, maintain team productivity
- **Pain Points:** Information scattered across systems, difficult to see full context, approval bottlenecks
- **Tech Comfort:** Medium (focuses on core functionality over complex features)

---

## Employee User Journey: Travel Allowance Request

### Journey Overview
**Goal:** Successfully submit and track a travel allowance request
**Duration:** 5-10 minutes for submission + ongoing tracking
**Frequency:** Weekly/bi-weekly depending on project assignments

### Journey Stages

#### Stage 1: Pre-Request Planning
**Touchpoint:** Email notification or project assignment

**User Actions:**
- Receives new project assignment or realizes need for travel allowance
- Gathers project details (name, subproject, location)
- Considers travel frequency (days per week)

**User Thoughts:**
- "I need to request travel allowance for this new project"
- "What information will I need to provide?"

**Emotional State:** Neutral → Slightly motivated
**Pain Points:** Uncertainty about required information

#### Stage 2: Request Initiation
**Touchpoint:** RegularTravelManager web application

**User Actions:**
- Logs into the system (Cognito authentication)
- Navigates to "Submit New Request" page
- Begins filling out request form

**User Thoughts:**
- "The login should be quick and familiar"
- "I hope the form is straightforward"

**Emotional State:** Focused
**Pain Points:** Slow authentication, complex form layout

#### Stage 3: Form Completion
**Touchpoint:** Travel allowance request form

**User Actions:**
- Selects project from dropdown/autocomplete
- Selects subproject (filtered based on project)
- Enters days per week (1-5)
- Types manager name in text field
- Writes justification for travel necessity
- Reviews calculated distance and allowance (if available)

**User Thoughts:**
- "I need to provide clear justification"
- "Is this the right manager for approval?"
- "The calculated amount should be accurate"

**Emotional State:** Concentrated → Slightly anxious (accuracy concerns)
**Pain Points:** Unclear project/subproject relationships, manager selection uncertainty

#### Stage 4: Review and Submit
**Touchpoint:** Form review screen

**User Actions:**
- Reviews all entered information
- Confirms calculated allowance amount
- Checks manager assignment
- Submits request

**User Thoughts:**
- "Everything looks correct"
- "When will I hear back about this?"

**Emotional State:** Cautiously optimistic
**Pain Points:** No clear timeline expectations

#### Stage 5: Confirmation and Waiting
**Touchpoint:** Confirmation screen + dashboard

**User Actions:**
- Receives submission confirmation
- Notes request ID/reference
- Checks personal dashboard for status

**User Thoughts:**
- "My request was submitted successfully"
- "I can track this on my dashboard"

**Emotional State:** Relieved → Neutral
**Pain Points:** Unclear what happens next

#### Stage 6: Status Monitoring
**Touchpoint:** Personal request dashboard

**User Actions:**
- Periodically checks dashboard for status updates
- Reviews pending, approved, and rejected requests
- Checks email for notifications

**User Thoughts:**
- "Has my manager seen this yet?"
- "When might I get a decision?"

**Emotional State:** Neutral → Impatient (if delayed)
**Pain Points:** No visibility into manager review process

#### Stage 7: Decision Notification
**Touchpoint:** Email notification + dashboard update

**User Actions:**
- Receives email notification about decision
- Clicks link to view details in system
- Reviews approval/rejection with comments

**User Thoughts (Approved):**
- "Great! My allowance is approved"
- "I can see the exact amount I'll receive"

**User Thoughts (Rejected):**
- "Why was this rejected?"
- "What do I need to change to get approval?"

**Emotional State (Approved):** Satisfied → Happy
**Emotional State (Rejected):** Disappointed → Determined
**Pain Points:** Insufficient rejection explanations

#### Stage 8A: Post-Approval (Happy Path)
**Touchpoint:** Dashboard with approved requests

**User Actions:**
- Views approved allowance amount
- Plans travel based on approval
- Refers back to system as needed

**User Thoughts:**
- "I have the allowance I need"
- "The system worked as expected"

**Emotional State:** Satisfied
**Pain Points:** None significant

#### Stage 8B: Post-Rejection (Recovery Path)
**Touchpoint:** Rejection details + resubmission form

**User Actions:**
- Reviews rejection comments
- Decides to resubmit or withdraw
- If resubmitting: modifies original request
- Resubmits with changes

**User Thoughts:**
- "I understand why this was rejected"
- "I can fix this and resubmit"
- "I hope the changes address the concerns"

**Emotional State:** Determined → Hopeful
**Pain Points:** Starting over vs. editing existing request

---

## Manager User Journey: Request Review and Approval

### Journey Overview
**Goal:** Efficiently review and decide on employee travel allowance requests
**Duration:** 2-5 minutes per request
**Frequency:** Daily/weekly depending on team size

### Journey Stages

#### Stage 1: Notification Awareness
**Touchpoint:** Email notification

**User Actions:**
- Receives email about new travel allowance request
- Reviews basic request information in email
- Clicks link to access full details

**User Thoughts:**
- "I have a new request to review"
- "Let me see the details before deciding"

**Emotional State:** Neutral → Focused
**Pain Points:** Email overload, unclear priority level

#### Stage 2: System Access
**Touchpoint:** RegularTravelManager login

**User Actions:**
- Logs into system (potentially from email link)
- Navigates to pending requests view
- Locates specific request or reviews all pending

**User Thoughts:**
- "I need to see all pending requests, not just one"
- "What's the full context for this employee?"

**Emotional State:** Task-oriented
**Pain Points:** Multiple logins, slow access

#### Stage 3: Employee Context Review
**Touchpoint:** Employee search and history view

**User Actions:**
- Searches for employee by name
- Reviews employee's current and past requests
- Checks employee's total approved allowances
- Views employee's home location and typical projects

**User Thoughts:**
- "What's this employee's normal travel pattern?"
- "Are they requesting reasonable amounts?"
- "Do I know their home location and typical projects?"

**Emotional State:** Analytical
**Pain Points:** Information scattered, incomplete employee context

#### Stage 4: Request Detail Analysis
**Touchpoint:** Individual request detail screen

**User Actions:**
- Reviews project and subproject details
- Checks calculated distance and allowance amount
- Reads employee's justification
- Verifies days per week requested
- Compares to similar approved requests

**User Thoughts:**
- "Is this project legitimate and current?"
- "Does the calculated distance seem accurate?"
- "Is the justification sufficient?"
- "Is the frequency reasonable?"

**Emotional State:** Evaluative → Decision-making
**Pain Points:** Insufficient project context, unclear distance calculation

#### Stage 5: Decision Making
**Touchpoint:** Approval/rejection interface

**User Actions:**
- Weighs project necessity vs. cost
- Considers team budget implications
- Decides to approve or reject
- If rejecting: prepares explanation comment

**User Thoughts (Approving):**
- "This seems reasonable and necessary"
- "The employee provided good justification"

**User Thoughts (Rejecting):**
- "This doesn't seem necessary right now"
- "I need to explain why this isn't approved"

**Emotional State:** Decisive
**Pain Points:** No budget context, difficult rejection explanations

#### Stage 6: Action Execution
**Touchpoint:** Approval/rejection form

**User Actions:**
- Clicks approve or reject
- If rejecting: writes clear explanation comment
- Confirms decision
- Reviews confirmation

**User Thoughts:**
- "My decision has been recorded"
- "The employee will be notified appropriately"

**Emotional State:** Completion-focused
**Pain Points:** Unclear what employee sees, notification timing

#### Stage 7: Follow-up and Tracking
**Touchpoint:** Manager dashboard with decision history

**User Actions:**
- Reviews recent decisions made
- Monitors for resubmissions (if rejected)
- Checks for new requests from team
- Reviews team travel allowance totals

**User Thoughts:**
- "I can see my recent decisions"
- "Are there patterns I should be aware of?"
- "How much am I approving for my team overall?"

**Emotional State:** Reflective → Neutral
**Pain Points:** No aggregate reporting, difficult pattern recognition

---

## Critical User Experience Insights

### Employee Journey Key Insights
1. **Transparency is crucial** - Employees need visibility into process timing and decision criteria
2. **Form simplicity matters** - Complex forms create abandonment and errors
3. **Status tracking reduces anxiety** - Clear dashboard view prevents frequent manager interruptions
4. **Rejection recovery** - Clear path to understand and fix rejection reasons

### Manager Journey Key Insights
1. **Context is king** - Managers need full employee and project context for good decisions
2. **Efficiency over features** - Quick access to key information trumps advanced functionality
3. **Decision support** - Clear data presentation aids confident decision-making
4. **Batch processing potential** - Ability to review multiple requests efficiently

### Cross-Journey Insights
1. **Communication clarity** - Both users need clear, timely notifications
2. **System performance** - Slow responses hurt both user experiences significantly
3. **Mobile responsiveness** - Both personas likely to use mobile devices
4. **Trust through transparency** - Open process builds user confidence

---

## UX Design Principles for Implementation

### 1. Progressive Disclosure
- Show essential information first
- Provide drill-down options for details
- Avoid overwhelming users with data

### 2. Clear Information Hierarchy
- Use consistent visual patterns
- Highlight actionable items
- Group related information logically

### 3. Immediate Feedback
- Confirm user actions instantly
- Show loading states for longer operations
- Provide clear error messages

### 4. Contextual Help
- Inline guidance where needed
- Clear labeling and descriptions
- Examples for complex fields

### 5. Responsive Design
- Mobile-first approach
- Touch-friendly interface elements
- Readable text on all screen sizes

---

## Next Steps for UI Design

1. **Wireframe Creation** - Low-fidelity layouts for each journey stage
2. **Component Specification** - Detailed Angular Material component usage
3. **Responsive Breakpoints** - Mobile, tablet, and desktop layouts
4. **Interaction Patterns** - Hover states, transitions, and animations
5. **Accessibility Compliance** - WCAG 2.1 AA standard adherence

This user journey analysis provides the foundation for creating intuitive, efficient interfaces that serve both employee and manager needs effectively.
# SABA Secure App — Security Testing Evidence

This document provides evidence of security controls, Firestore rule validation, and role-based access control (RBAC) enforcement within the SABA Secure App.

## 1. Security Testing Matrix

| Security ID | Security Control | Scenario | Expected Result | Actual Result | Status | Evidence |
|:---|:---|:---|:---|:---|:---|:---|
| SEC-01 | Default Deny | Access undefined collection | Request should be blocked by default rules | Access denied by Firestore | Pass | [Check firestore.rules] |
| SEC-02 | Auth Guard | Unauthenticated access | Redirect to /login when accessing protected routes | Redirected automatically | Pass | [Add screenshot] |
| SEC-03 | RBAC | Staff admin access | Staff blocked from Admin Dashboard direct URL | Redirected to /unauthorized | Pass | [Add screenshot] |
| SEC-04 | User Status | Disabled user access | Login blocked or immediate redirect for disabled users | Redirected to /unauthorized | Pass | [Add screenshot] |
| SEC-05 | UI UX | Unauthorized message | Disabled users see "Account Disabled" specific message | Clear messaging displayed | Pass | [Add screenshot] |
| SEC-06 | Firestore | Active Profile check | Write rejected if user status is not 'active' | Rules enforced active status | Pass | [Check firestore.rules] |
| SEC-07 | Field Protection | Sensitive inventory fields | Staff cannot edit 'buyingPrice' or 'sku' | Update rejected by Firestore | Pass | [Check firestore.rules] |
| SEC-08 | Write Safety | Sale creation | Staff can update stock quantity during valid transaction | Stock reduced correctly | Pass | [Add screenshot] |
| SEC-09 | RBAC | User management | Staff cannot modify user roles or status | UI hidden and Firestore write blocked | Blocked by rules | Pass | [Check firestore.rules] |
| SEC-10 | Immutability | Audit logs | Users cannot edit or delete audit log entries | Delete/Update operations denied | Pass | [Check firestore.rules] |
| SEC-11 | Admin Control | Account management | Admin can disable/activate any user account | Profile status updated in Firestore | Functional | Pass | [Add screenshot] |
| SEC-12 | Traceability | User actions | User status/role changes recorded in Audit Logs | Logs show who performed change | Traceable | Pass | [Add screenshot] |
| SEC-13 | UX Safety | Delete confirmation | Delete requires explicit click on Confirm Modal | Prevented accidental deletion | Working | Pass | [Add screenshot] |
| SEC-14 | Step-up Auth | Risky actions re-auth | Delete/Role change requires password entry | Secondary auth modal appears | Enforced | Pass | [Add screenshot] |
| SEC-15 | Step-up Auth | Wrong password check | Wrong admin password blocks the risky write | Re-auth fails, action blocked | Blocked | Pass | [Add screenshot] |
| SEC-16 | Step-up Auth | Correct password check | Correct admin password allows the risky write | Re-auth succeeds, write completed | Authorized | Pass | [Add screenshot] |
| SEC-17 | Monitoring | Anomaly review log | Audit log created when anomaly is reviewed | Log entry shows reviewer details | Audit ready | Pass | [Add screenshot] |
| SEC-18 | Monitoring | Anomaly resolve log | Audit log created when anomaly is resolved | Log entry shows resolver details | Audit ready | Pass | [Add screenshot] |
| SEC-19 | Privacy | Notifications access | Users can only read their own notifications | Firestore rules filter by targetUid | Data isolated | Pass | [Check firestore.rules] |
| SEC-20 | Integrity | Build integrity | Production build generates correct hashes | Build passes security checks | Bundle verified | Pass | [Check build log] |

## 2. Security Evaluation Summary

### Authentication & Authorization
The system utilizes **Firebase Authentication** for secure identity management, supporting email/password and Google OAuth. **Role-Based Access Control (RBAC)** is strictly enforced at both the frontend (via ProtectedRoute/RoleRoute) and the backend (via Firestore Security Rules).

### Firestore Security Rules
A **"Default Deny"** posture is implemented. Access to any collection requires:
1.  A valid Firebase Auth session.
2.  A corresponding Firestore user profile document.
3.  An 'active' status flag.
Admin roles have expanded permissions, while staff roles are restricted to specific field-level updates (e.g., stock reduction) and prohibited from accessing sensitive financial or administrative data.

### Defense in Depth
-   **Disabled-User Kill Switch**: Centrally managed status in Firestore that immediately revokes all data access and redirects users to an unauthorized page.
-   **Admin Re-authentication**: High-risk actions (item deletion, role modification) require a secondary password verification ("Step-up Authentication").
-   **Anomaly Monitoring**: A rule-based engine monitors for suspicious activities (high discounts, large sales) and generates alerts for admin review.
-   **Audit Logging**: Every sensitive operation is logged to an immutable `auditLogs` collection, providing a clear trail of accountability.

### Future Enhancements
-   **Multi-Factor Authentication (MFA)**: Future implementation of SMS or Email OTP is planned. SMS OTP was deferred in this version due to Firebase SMS costs, but the architecture is ready to integrate it once funding/credits are secured.
-   **Cloud Functions**: Moving sensitive logic to backend functions for even stricter isolation.

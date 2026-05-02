# SABA Secure App — Final Screenshot & Evidence Checklist

Use this checklist to ensure all visual evidence is collected for the final project report and presentation.

## A. Authentication & Onboarding
- [ ] Home/Welcome page (Landing)
- [ ] Login page (Dark mode theme)
- [ ] Register page
- [ ] Forgot Password modal/page
- [ ] Google Sign-in popup/success

## B. Admin Dashboard
- [ ] Main Admin Dashboard (Charts, KPIs)
- [ ] Inventory stats cards (Low stock count, value)
- [ ] Sales analytics charts (Revenue trend, top items)
- [ ] User management list (Active/Disabled status)

## C. Staff Dashboard
- [ ] Main Staff Dashboard (Focused on Sales)
- [ ] Personal performance stats
- [ ] Quick access to New Sale

## D. Inventory Management
- [ ] Inventory Table (Search and Filter)
- [ ] Add New Item modal
- [ ] Edit Item modal (Restricted fields for staff)
- [ ] Delete confirmation modal (Basic)
- [ ] **Admin Re-authentication modal** (Password prompt for delete)
- [ ] Bulk CSV Import modal
- [ ] Bulk Import success/mapping preview

## E. Sales & Invoice System
- [ ] New Sale / POS screen
- [ ] Customer selection dropdown
- [ ] Cart with multiple items
- [ ] Discount selection (Loyalty, Manual)
- [ ] Sale success confirmation
- [ ] **Invoice Preview Modal** (Professional layout)
- [ ] PDF Export / Print view of invoice
- [ ] Sales History table (All transactions)

## F. Returns & Cancellations
- [ ] Return Sale modal (Item selection)
- [ ] Refund calculation preview
- [ ] Cancel Sale confirmation
- [ ] History showing "Returned" or "Cancelled" tags

## G. Customers & Suppliers
- [ ] Customer list with spend/loyalty tiers
- [ ] Add/Edit Customer modal
- [ ] Supplier list with contact details
- [ ] Add/Edit Supplier modal

## H. Reports & AI Analytics
- [ ] Main Reports page (Full dashboard)
- [ ] **AI Business Summary Panel** (Rule-based insights)
- [ ] **AI Sales Forecasting Section** (7/30 day predictions)
- [ ] Reorder Intelligence table (AI suggested qty)
- [ ] Top Customers report
- [ ] Profit by Item report
- [ ] CSV Export download confirmation

## I. Notifications & Anomaly Alerts
- [ ] Notification dropdown / Sidebar count
- [ ] Notifications page (Anomaly Alerts tab)
- [ ] Anomaly alert cards (Severity: High/Med/Low)
- [ ] Anomaly "Mark Reviewed" success
- [ ] Anomaly "Resolve" confirmation and success
- [ ] Resolved alerts in Reports / Audit Logs

## J. Audit Logs
- [ ] Audit Logs page
- [ ] Audit Search/Filter (By action or user)
- [ ] Audit entries for ANOMALY_REVIEWED / ANOMALY_RESOLVED
- [ ] Audit entries for ADMIN_REAUTHENTICATED
- [ ] Audit CSV export

## K. Security & Unauthorized Access
- [ ] Staff attempting to access Admin page (Unauthorized page)
- [ ] **Disabled user unauthorized page** (Specific logout button)
- [ ] Admin Re-authentication "Wrong Password" error state
- [ ] Firestore Security Rules snippet (Optional for report)

## L. Build & Deployment
- [ ] Terminal screenshot: `npm run build` Success
- [ ] Terminal screenshot: `firebase deploy` Success
- [ ] Browser screenshot: App running on Live Hosting URL (e.g., .web.app or .firebaseapp.com)

# SABA Secure App — Testing and Evaluation Evidence

This document provides a comprehensive log of the functional testing and evaluation performed on the SABA Secure App. It serves as evidence for final year project submission and supervisor review.

## 1. Functional Testing Table

| Test ID | Test Area | Test Scenario | Steps | Expected Result | Actual Result | Status | Evidence |
|:---|:---|:---|:---|:---|:---|:---|:---|
| TST-01 | Auth | User registration | 1. Navigate to Register page<br>2. Enter valid details<br>3. Submit | Account created and profile document exists in Firestore | Account created and Firestore profile synced | Pass | [Add screenshot: Registration Success] |
| TST-02 | Auth | Email/password login | 1. Navigate to Login page<br>2. Enter valid credentials<br>3. Submit | Access granted to correct dashboard based on role | Dashboard loaded successfully | Pass | [Add screenshot: Login Success] |
| TST-03 | Auth | Google sign-in | 1. Click Google Sign-in button<br>2. Authenticate with Google | Account linked and dashboard loaded | Signed in with Google successfully | Pass | [Add screenshot: Google Sign-in] |
| TST-04 | Auth | Logout | 1. Click Logout in Sidebar | Session cleared, redirected to Login | Redirected to Login page | Pass | [Add screenshot: Logout Action] |
| TST-05 | Security | Protected route access | 1. Enter dashboard URL while logged out | Redirected to Login page | Redirected automatically | Pass | [Add screenshot: Access Blocked] |
| TST-06 | Dashboard | Admin dashboard load | 1. Login as Admin | Admin analytics, inventory, and users modules visible | Full admin panel loaded | Pass | [Add screenshot: Admin Dashboard] |
| TST-07 | Dashboard | Staff dashboard load | 1. Login as Staff | Sales interface and staff stats visible | Staff dashboard loaded | Pass | [Add screenshot: Staff Dashboard] |
| TST-08 | Inventory | Add item | 1. Open Add Item modal<br>2. Submit details | Item saved to Firestore and visible in table | Item added successfully | Pass | [Add screenshot: Add Inventory] |
| TST-09 | Inventory | Edit item | 1. Click Edit on item<br>2. Update and save | Item details updated in Firestore | Changes reflected immediately | Pass | [Add screenshot: Edit Inventory] |
| TST-10 | Inventory | Delete item | 1. Click Delete<br>2. Confirm via Re-auth | Item removed after password verification | Deleted after Admin Re-auth | Pass | [Add screenshot: Re-auth Delete] |
| TST-11 | Inventory | Bulk CSV import | 1. Upload CSV in Bulk Modal | Multiple items imported simultaneously | Items imported correctly | Pass | [Add screenshot: Bulk Import] |
| TST-12 | Suppliers | CRUD operations | 1. Add/Edit/Delete supplier | Supplier database updated correctly | Supplier management functional | Pass | [Add screenshot: Supplier Page] |
| TST-13 | Customers | CRUD operations | 1. Add/Edit/Delete customer | Customer database updated correctly | Customer management functional | Pass | [Add screenshot: Customer Page] |
| TST-14 | Sales | Customer selection | 1. Start sale<br>2. Select customer from dropdown | Customer details and loyalty tier loaded | Customer linked to sale | Pass | [Add screenshot: Customer Link] |
| TST-15 | Sales | Multi-item sale | 1. Add multiple items to cart<br>2. Complete sale | Sale transaction records multiple items | Invoice shows all items | Pass | [Add screenshot: Multi-item Sale] |
| TST-16 | Sales | Stock reduction | 1. Complete sale<br>2. Verify inventory quantity | Stock count reduced by sold quantity | Stock decremented correctly | Pass | [Add screenshot: Stock Update] |
| TST-17 | Sales | Invoice preview | 1. View completed sale details | Professional invoice modal displayed | Invoice preview loaded | Pass | [Add screenshot: Invoice Preview] |
| TST-18 | Sales | PDF export | 1. Click Print/PDF on invoice | PDF generated with business branding | PDF saved successfully | Pass | [Add screenshot: PDF Export] |
| TST-19 | History | Sales history update | 1. View sales history table | Transactions visible with status tags | History log updated | Pass | [Add screenshot: Sales History] |
| TST-20 | Returns | Full return | 1. Process full return for sale | Sale marked 'returned', stock replenished | Full refund recorded | Pass | [Add screenshot: Full Return] |
| TST-21 | Returns | Partial return | 1. Process return for specific items | Stock updated, refund calculated partially | Partial return success | Pass | [Add screenshot: Partial Return] |
| TST-22 | Sales | Sale cancellation | 1. Process cancellation | Sale marked 'cancelled', stock restored | Cancellation recorded | Pass | [Add screenshot: Cancellation] |
| TST-23 | Reports | Revenue calculation | 1. View Reports dashboard | Revenue and profit match transaction data | Calculations accurate | Pass | [Add screenshot: Revenue Reports] |
| TST-24 | Reports | CSV/PDF export | 1. Export analytics reports | CSV/PDF files contain correct business data | Data exported successfully | Pass | [Add screenshot: Report Exports] |
| TST-25 | AI | Slow moving stock | 1. Check AI insights | Items with no sales flagged as dead stock | AI detected slow stock | Pass | [Add screenshot: Dead Stock AI] |
| TST-26 | AI | Reorder intelligence | 1. Check AI recommended actions | AI suggests reorder qty based on velocity | Reorder advice visible | Pass | [Add screenshot: Reorder AI] |
| TST-27 | System | Notification center | 1. Trigger low stock/status change | Alert appears in notification dropdown | Real-time alerts working | Pass | [Add screenshot: Notification Center] |
| TST-28 | Logs | Audit log filter | 1. Search audit logs by type/email | Filtered results display correctly | Search functional | Pass | [Add screenshot: Audit Filters] |
| TST-29 | Logs | Log exports | 1. Export audit trail to CSV/PDF | Full evidence of system activity exported | Logs exported correctly | Pass | [Add screenshot: Audit Exports] |
| TST-30 | Security | Anomaly creation | 1. Trigger high discount (≥15%) | Anomaly alert generated in Firestore | Anomaly detected | Pass | [Add screenshot: Anomaly Alert] |
| TST-31 | Security | Anomaly review | 1. Mark alert as 'Reviewed' | Status updates and audit log created | Alert marked Reviewed | Pass | [Add screenshot: Reviewed Alert] |
| TST-32 | Security | Anomaly resolve | 1. Resolve alert via modal | Alert marked 'Resolved' and archived | Alert resolved successfully | Pass | [Add screenshot: Resolved Alert] |
| TST-33 | AI | Business Summary | 1. View AI Business Summary panel | Automated summary of business health visible | Summary generated correctly | Pass | [Add screenshot: Business Summary AI] |
| TST-34 | AI | Sales Forecasting | 1. View AI Sales Forecast section | Estimated 7/30 day revenue and trends visible | Forecast generated | Pass | [Add screenshot: Sales Forecast AI] |
| TST-35 | Security | Admin Re-auth | 1. Delete item/change role<br>2. Enter password | Action requires secondary auth check | Re-auth required and functional | Pass | [Add screenshot: Admin Re-auth Modal] |
| TST-36 | Build | Build verification | 1. Run npm run build | Production bundle generated without error | Build passed | Pass | [Add screenshot: Build Success] |
| TST-37 | Deploy | Firebase deployment | 1. Run firebase deploy | App hosted at live URL | Deployment successful | Pass | [Add screenshot: Deploy Success] |

## 2. Evaluation Summary

The system successfully meets all core functional requirements outlined in the project specification. The integration of Firebase for real-time data and authentication provides a robust foundation, while the rule-based AI components (Summary and Forecasting) provide significant business value through decision support. The security implementation, particularly the anomaly detection and admin re-authentication, ensures the system is resilient against unauthorized actions and internal risks.

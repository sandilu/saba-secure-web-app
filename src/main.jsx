import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";

import AppLayout from "./App";
import { AuthProvider } from "./auth/AuthContext";
import ProtectedRoute from "./auth/ProtectedRoute";
import RoleRoute from "./auth/RoleRoute";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import StaffDashboard from "./pages/StaffDashboard";
import Unauthorized from "./pages/Unauthorized";
import SalesPage from "./pages/SalesPage";
import SalesHistory from "./pages/SalesHistory";
import ReportsPage from "./pages/ReportsPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import CustomersPage from "./pages/CustomersPage";
import SuppliersPage from "./pages/SuppliersPage";
import NotificationsPage from "./pages/NotificationsPage";
import LoginActivityPage from "./pages/LoginActivityPage";
import StaffInventoryPage from "./pages/StaffInventoryPage";
import StaffMySalesPage from "./pages/StaffMySalesPage";
import StaffCustomersPage from "./pages/StaffCustomersPage";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            {/* Public */}
            <Route path="/" element={<Home />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/unauthorized" element={<Unauthorized />} />

            {/* Shared protected */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />

            <Route
              path="/sales"
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["admin", "staff"]}>
                    <SalesPage />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/sales-history"
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["admin", "staff"]}>
                    <SalesHistory />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["admin", "staff"]}>
                    <NotificationsPage />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            {/* Admin only */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["admin"]}>
                    <AdminDashboard />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["admin"]}>
                    <ReportsPage />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/audit-logs"
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["admin"]}>
                    <AuditLogsPage />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/login-activity"
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["admin"]}>
                    <LoginActivityPage />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/customers"
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["admin"]}>
                    <CustomersPage />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/suppliers"
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["admin"]}>
                    <SuppliersPage />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            {/* Staff and admin */}
            <Route
              path="/staff"
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["staff", "admin"]}>
                    <StaffDashboard />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/inventory"
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["staff", "admin"]}>
                    <StaffInventoryPage />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/my-sales"
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["staff", "admin"]}>
                    <StaffMySalesPage />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />

            <Route
              path="/staff/customers"
              element={
                <ProtectedRoute>
                  <RoleRoute allow={["staff", "admin"]}>
                    <StaffCustomersPage />
                  </RoleRoute>
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
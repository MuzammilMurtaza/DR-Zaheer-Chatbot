/* =========================================================
   DR. MUHAMMAD ZAHEER ANJUM CLINIC
   ADMIN DASHBOARD JAVASCRIPT
   Full-Stack REST Integration & Interactive Page Routing
========================================================= */

const API_BASE = "http://localhost:5000/api";

const state = {
    token: localStorage.getItem("mza_admin_token") || null,
    currentPage: "overview",
    appointments: [],
    reports: [],
    patients: [],
    offDays: [],
    blockedSlots: [],
    specialSchedules: [],
    treatments: [],
    consultations: [],
    staffMessages: [],
    emergencyAlerts: [],
    stats: null
};

// DOM References
const adminSidebar = document.getElementById("adminSidebar");
const sidebarOverlay = document.getElementById("sidebarOverlay");
const mobileMenuButton = document.getElementById("mobileMenuButton");
const refreshDashboardButton = document.getElementById("refreshDashboardButton");
const overviewPage = document.getElementById("overviewPage");
const dynamicAdminPage = document.getElementById("dynamicAdminPage");
const pageTitle = document.getElementById("pageTitle");
const pageSubtitle = document.getElementById("pageSubtitle");

// Headers helper
function getAuthHeaders() {
    const headers = { "Content-Type": "application/json" };
    const token = state.token || localStorage.getItem("mza_admin_token");
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

// Initialize Application
document.addEventListener("DOMContentLoaded", async () => {
    setupNavigation();
    setupMobileToggle();
    setupRefreshButton();
    setupLogoutButton();

    const isAuth = await checkAuthGuard();
    if (!isAuth) return;

    await loadDashboardData();
    setupRealTimeAutoSync();
});

let autoSyncInterval = null;
function setupRealTimeAutoSync() {
    if (autoSyncInterval) clearInterval(autoSyncInterval);
    autoSyncInterval = setInterval(async () => {
        if (!document.hidden) {
            await Promise.all([
                fetchAppointments(),
                fetchReports(),
                fetchStats()
            ]);
            updateOverviewDOM();
            if (state.currentPage === "appointments") {
                renderAppointmentsPage();
            } else if (state.currentPage === "reports") {
                renderReportsPage();
            }
        }
    }, 3000);

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            loadDashboardData();
        }
    });

    window.addEventListener("focus", () => {
        loadDashboardData();
    });
}

async function checkAuthGuard() {
    const token = localStorage.getItem("mza_admin_token");
    if (!token) {
        window.location.replace("login.html");
        return false;
    }
    state.token = token;
    try {
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: getAuthHeaders(),
            credentials: "include"
        });
        const json = await res.json();
        if (!json.success) {
            localStorage.removeItem("mza_admin_token");
            localStorage.removeItem("mza_admin_user");
            window.location.replace("login.html");
            return false;
        }
        return true;
    } catch (e) {
        return true;
    }
}

function setupLogoutButton() {
    const logoutBtn = document.getElementById("logoutButton");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            try {
                await fetch(`${API_BASE}/auth/logout`, { method: "POST" });
            } catch (e) {}
            localStorage.removeItem("mza_admin_token");
            localStorage.removeItem("mza_admin_user");
            window.location.replace("login.html");
        });
    }
}

// Setup Sidebar Navigation
function setupNavigation() {
    const navItems = document.querySelectorAll(".nav-item[data-page]");
    navItems.forEach(item => {
        item.addEventListener("click", () => {
            navItems.forEach(n => n.classList.remove("active"));
            item.classList.add("active");

            const page = item.dataset.page;
            state.currentPage = page;
            navigateToPage(page);

            // Mobile menu close
            if (window.innerWidth <= 900) {
                adminSidebar?.classList.remove("open");
                sidebarOverlay?.classList.remove("show");
            }
        });
    });

    // View All button on overview
    document.querySelectorAll("[data-open-page]").forEach(btn => {
        btn.addEventListener("click", () => {
            const targetPage = btn.dataset.openPage;
            const navBtn = document.querySelector(`.nav-item[data-page="${targetPage}"]`);
            if (navBtn) navBtn.click();
        });
    });
}

function setupMobileToggle() {
    mobileMenuButton?.addEventListener("click", () => {
        adminSidebar?.classList.toggle("open");
        sidebarOverlay?.classList.toggle("show");
    });

    sidebarOverlay?.addEventListener("click", () => {
        adminSidebar?.classList.remove("open");
        sidebarOverlay?.classList.remove("show");
    });
}

function setupRefreshButton() {
    refreshDashboardButton?.addEventListener("click", () => {
        refreshDashboardButton.style.transform = "rotate(360deg)";
        refreshDashboardButton.style.transition = "transform 0.5s ease";
        setTimeout(() => { refreshDashboardButton.style.transform = "none"; }, 500);
        loadDashboardData();
    });
}

// Load All Backend Data
async function loadDashboardData() {
    try {
        await Promise.all([
            fetchStats(),
            fetchAppointments(),
            fetchReports(),
            fetchPatients(),
            fetchOffDays(),
            fetchBlockedSlots(),
            fetchTreatments(),
            fetchConsultations(),
            fetchStaffInbox(),
            fetchEmergencyAlerts()
        ]);
        updateOverviewDOM();
        navigateToPage(state.currentPage);
    } catch (e) {
        console.error("Dashboard Data Loading Error:", e);
    }
}

// API Fetch Functions
async function fetchStats() {
    try {
        const res = await fetch(`${API_BASE}/dashboard/stats`);
        const json = await res.json();
        if (json.success) state.stats = json.data;
    } catch (e) {}
}

async function fetchAppointments() {
    try {
        const res = await fetch(`${API_BASE}/appointments`);
        const json = await res.json();
        if (json.success) {
            state.appointments = json.data;
            const countEl = document.getElementById("appointmentNavCount");
            if (countEl) countEl.textContent = state.appointments.length;
        }
    } catch (e) {}
}

async function fetchReports() {
    try {
        const res = await fetch(`${API_BASE}/reports`);
        const json = await res.json();
        if (json.success) {
            state.reports = json.data;
            const countEl = document.getElementById("reportNavCount");
            if (countEl) countEl.textContent = state.reports.filter(r => r.status === 'new').length;
        }
    } catch (e) {}
}

async function fetchPatients() {
    try {
        const res = await fetch(`${API_BASE}/patients`);
        const json = await res.json();
        if (json.success) state.patients = json.data;
    } catch (e) {}
}

async function fetchOffDays() {
    try {
        const res = await fetch(`${API_BASE}/clinics/off-days`);
        const json = await res.json();
        if (json.success) state.offDays = json.data;
    } catch (e) {}
}

async function fetchBlockedSlots() {
    try {
        const res = await fetch(`${API_BASE}/clinics/blocked-slots`);
        const json = await res.json();
        if (json.success) state.blockedSlots = json.data;
    } catch (e) {}
}

async function fetchTreatments() {
    try {
        const res = await fetch(`${API_BASE}/treatments`);
        const json = await res.json();
        if (json.success) state.treatments = json.data;
    } catch (e) {}
}

async function fetchConsultations() {
    try {
        const res = await fetch(`${API_BASE}/consultations`);
        const json = await res.json();
        if (json.success) state.consultations = json.data;
    } catch (e) {}
}

async function fetchStaffInbox() {
    try {
        const res = await fetch(`${API_BASE}/staff/inbox`);
        const json = await res.json();
        if (json.success) {
            state.staffMessages = json.data;
            const countEl = document.getElementById("inboxNavCount");
            if (countEl) countEl.textContent = state.staffMessages.filter(m => m.status === 'pending').length;
        }
    } catch (e) {}
}

async function fetchEmergencyAlerts() {
    try {
        const res = await fetch(`${API_BASE}/staff/emergency`);
        const json = await res.json();
        if (json.success) {
            state.emergencyAlerts = json.data;
            const countEl = document.getElementById("emergencyNavCount");
            if (countEl) countEl.textContent = state.emergencyAlerts.filter(a => a.status === 'open').length;
        }
    } catch (e) {}
}

// Update DOM elements on the static Overview page
function updateOverviewDOM() {
    const s = state.stats || {
        todayAppointments: state.appointments.length,
        confirmed: state.appointments.filter(a => a.status === 'confirmed').length,
        completed: state.appointments.filter(a => a.status === 'completed').length,
        cancelled: state.appointments.filter(a => a.status === 'cancelled').length,
        noShows: state.appointments.filter(a => a.status === 'no-show').length,
        availableSlotsToday: 16,
        blockedSlotsCount: state.blockedSlots.length,
        upcomingDoctorLeave: state.offDays.length,
        pendingConsultations: state.consultations.filter(c => c.status === 'pending').length,
        humanHandovers: state.staffMessages.filter(m => m.status === 'pending').length,
        pendingEmergencyAlerts: state.emergencyAlerts.filter(e => e.status === 'open').length,
        pendingReportsReview: state.reports.filter(r => r.status === 'new').length,
        integrations: {
            database: "CONNECTED",
            whatsapp: "SIMULATION ACTIVE",
            appointmentApi: "CONNECTED",
            reminderStatus: "ENABLED",
            fileStorage: "CONNECTED",
            aiStatus: "ACTIVE"
        }
    };

    setElText("todayAppointments", s.todayAppointments);
    setElText("confirmedAppointments", s.confirmed);
    setElText("completedAppointments", s.completed);
    setElText("cancelledAppointments", s.cancelled);
    setElText("noShowAppointments", s.noShows);
    setElText("availableSlots", s.availableSlotsToday);
    setElText("blockedSlots", s.blockedSlotsCount);
    setElText("doctorLeave", s.upcomingDoctorLeave);
    setElText("pendingConsultations", s.pendingConsultations);
    setElText("humanHandovers", s.humanHandovers);
    setElText("pendingEmergencyAlerts", s.pendingEmergencyAlerts);
    setElText("pendingReports", s.pendingReportsReview);

    // Integrations
    setBadgeStatus("databaseStatus", s.integrations?.database || "CONNECTED");
    setBadgeStatus("whatsappStatus", s.integrations?.whatsapp || "SIMULATION ACTIVE");
    setBadgeStatus("appointmentApiStatus", s.integrations?.appointmentApi || "CONNECTED");
    setBadgeStatus("reminderStatus", s.integrations?.reminderSystem || "ENABLED");
    setBadgeStatus("fileStorageStatus", s.integrations?.fileStorage || "CONNECTED");
    setBadgeStatus("aiStatus", s.integrations?.aiAssistant || "ACTIVE");

    // Recent Appointments Table
    const tableBody = document.getElementById("recentAppointmentsTable");
    if (tableBody) {
        if (state.appointments.length === 0) {
            tableBody.innerHTML = `
                <tr class="empty-table-row">
                    <td colspan="8">
                        <div class="empty-state">
                            <div class="empty-state-icon">📅</div>
                            <strong>No appointments yet</strong>
                            <p>New appointments will appear here automatically.</p>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            tableBody.innerHTML = state.appointments.slice(0, 5).map(app => `
                <tr>
                    <td><strong>${app.tokenNumber}</strong></td>
                    <td><code>${app.appointmentId}</code></td>
                    <td><strong>${app.patientName}</strong></td>
                    <td>${app.phone}</td>
                    <td>${app.appointmentType}</td>
                    <td>${app.date} \| ${app.time}</td>
                    <td>${app.clinic || 'Stay Young Clinic'}</td>
                    <td><span class="status-badge ${app.status.toLowerCase()}">${app.status.toUpperCase()}</span></td>
                </tr>
            `).join("");
        }
    }
}

function setElText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

function setBadgeStatus(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.textContent = text;
        el.className = "integration-badge connected";
        if (text.includes("NOT") || text.includes("DISCONNECTED")) el.className = "integration-badge not-configured";
        if (text.includes("SIMULATION")) el.className = "integration-badge simulation";
    }
}

// Router for switching sidebar pages
function navigateToPage(page) {
    if (page === "overview") {
        if (overviewPage) overviewPage.style.display = "block";
        if (dynamicAdminPage) dynamicAdminPage.style.display = "none";
        if (pageTitle) pageTitle.textContent = "Clinic Overview";
        if (pageSubtitle) pageSubtitle.textContent = "Real-time clinic management dashboard";
        updateOverviewDOM();
    } else {
        if (overviewPage) overviewPage.style.display = "none";
        if (dynamicAdminPage) {
            dynamicAdminPage.style.display = "block";
            renderDynamicPage(page);
        }
    }
}

// Render dynamic sub-pages
function renderDynamicPage(page) {
    switch (page) {
        case "appointments":
            renderAppointmentsPage();
            break;
        case "calendar":
            renderCalendarPage();
            break;
        case "patients":
            renderPatientsPage();
            break;
        case "doctor-profile":
            renderDoctorProfilePage();
            break;
        case "clinics":
            renderClinicsPage();
            break;
        case "weekly-schedule":
            renderWeeklySchedulePage();
            break;
        case "off-days":
            renderOffDaysPage();
            break;
        case "special-schedules":
            renderSpecialSchedulesPage();
            break;
        case "blocked-slots":
            renderBlockedSlotsPage();
            break;
        case "services":
            renderServicesPage();
            break;
        case "reports":
            renderReportsPage();
            break;
        case "virtual-consultation":
            renderVirtualConsultationsPage();
            break;
        case "emergency-alerts":
            renderEmergencyAlertsPage();
            break;
        case "staff-inbox":
            renderStaffInboxPage();
            break;
        default:
            renderAppointmentsPage();
    }
}

// 1. Appointments Page
function renderAppointmentsPage() {
    if (pageTitle) pageTitle.textContent = "Appointments Directory";
    if (pageSubtitle) pageSubtitle.textContent = "Live appointment records & status management";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel">
            <div class="panel-header">
                <div>
                    <h3>Live Appointments</h3>
                    <p>Manage, confirm, complete, or cancel appointments</p>
                </div>
                <input type="text" class="form-input" id="appSearchInput" placeholder="Search patient, phone, ID..." style="max-width: 260px;" onkeyup="filterAppointmentsTable()">
            </div>
            <div class="table-wrapper">
                <table class="admin-table" id="adminAppTable">
                    <thead>
                        <tr>
                            <th>Token</th>
                            <th>ID</th>
                            <th>Patient Name</th>
                            <th>Phone</th>
                            <th>Type</th>
                            <th>Clinic</th>
                            <th>Date & Time</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.appointments.length ? state.appointments.map(app => `
                            <tr>
                                <td><strong>${app.tokenNumber}</strong></td>
                                <td><code>${app.appointmentId}</code></td>
                                <td><strong>${app.patientName}</strong></td>
                                <td>${app.phone}</td>
                                <td>${app.appointmentType}</td>
                                <td>${app.clinic}</td>
                                <td>${app.date} | ${app.time}</td>
                                <td><span class="status-badge ${app.status.toLowerCase()}">${app.status.toUpperCase()}</span></td>
                                <td>
                                    <div class="action-btn-group">
                                        <button class="btn-action green" onclick="changeAppStatus('${app._id}', 'confirmed')">Confirm</button>
                                        <button class="btn-action purple" onclick="changeAppStatus('${app._id}', 'completed')">Complete</button>
                                        <button class="btn-action red" onclick="changeAppStatus('${app._id}', 'cancelled')">Cancel</button>
                                    </div>
                                </td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">📅</div><strong>No appointments found</strong><p>Bookings will appear here live from backend.</p></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function changeAppStatus(id, newStatus) {
    try {
        const res = await fetch(`${API_BASE}/appointments/${id}/status`, {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: newStatus })
        });
        const json = await res.json();
        if (json.success) {
            await fetchAppointments();
            renderAppointmentsPage();
        }
    } catch (e) {
        alert("Failed to update status.");
    }
}

// 2. Calendar Page
function renderCalendarPage() {
    if (pageTitle) pageTitle.textContent = "Clinic Calendar";
    if (pageSubtitle) pageSubtitle.textContent = "Scheduled consultations by date";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel" style="padding: 24px;">
            <div class="toolbar-row">
                <h3>Schedule Calendar Overview</h3>
                <input type="date" id="calendarDateFilter" class="form-input" style="max-width: 200px;" value="${new Date().toISOString().split('T')[0]}" onchange="renderCalendarPage()">
            </div>
            <div class="dashboard-statistics" style="margin-bottom: 0;">
                <div class="stat-card">
                    <div class="stat-card-top"><div class="stat-icon green-icon">📅</div><span class="stat-label">Active</span></div>
                    <strong class="stat-number">${state.appointments.filter(a => a.status === 'confirmed').length}</strong>
                    <p>Confirmed Appointments</p>
                </div>
                <div class="stat-card">
                    <div class="stat-card-top"><div class="stat-icon purple-icon">✔️</div><span class="stat-label">Done</span></div>
                    <strong class="stat-number">${state.appointments.filter(a => a.status === 'completed').length}</strong>
                    <p>Completed Visits</p>
                </div>
                <div class="stat-card">
                    <div class="stat-card-top"><div class="stat-icon red-icon">🚫</div><span class="stat-label">Blocked</span></div>
                    <strong class="stat-number">${state.blockedSlots.length}</strong>
                    <p>Blocked Slots</p>
                </div>
                <div class="stat-card">
                    <div class="stat-card-top"><div class="stat-icon orange-icon">🌴</div><span class="stat-label">Off-Days</span></div>
                    <strong class="stat-number">${state.offDays.length}</strong>
                    <p>Doctor Leaves</p>
                </div>
            </div>
        </div>
    `;
}

// 3. Patients Page
function renderPatientsPage() {
    if (pageTitle) pageTitle.textContent = "Patients Directory";
    if (pageSubtitle) pageSubtitle.textContent = "Registered patient records & history";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel">
            <div class="panel-header">
                <h3>Patient Database</h3>
                <input type="text" class="form-input" placeholder="Search patients..." style="max-width: 260px;">
            </div>
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Patient ID</th>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Total Bookings</th>
                            <th>Latest Visit</th>
                            <th>Registration Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.patients.length ? state.patients.map(p => `
                            <tr>
                                <td><code>${p.patientId}</code></td>
                                <td><strong>${p.name}</strong></td>
                                <td>${p.phone}</td>
                                <td><span class="status-badge confirmed">${p.totalAppointments || 1} Bookings</span></td>
                                <td>${p.latestAppointment || 'Recent'}</td>
                                <td>${p.createdAt ? p.createdAt.split('T')[0] : '2026-08-08'}</td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">👥</div><strong>No patient records</strong><p>Registered patients will be listed here.</p></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// 4. Doctor Profile Page
function renderDoctorProfilePage() {
    if (pageTitle) pageTitle.textContent = "Doctor Profile";
    if (pageSubtitle) pageSubtitle.textContent = "Dr. Muhammad Zaheer Anjum qualifications and clinic credentials";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel" style="padding: 24px; max-width: 780px;">
            <div style="display: flex; gap: 20px; align-items: center; margin-bottom: 24px;">
                <div class="sidebar-logo" style="width: 64px; height: 64px; font-size: 24px;">MZA</div>
                <div>
                    <h2>Dr. Muhammad Zaheer Anjum</h2>
                    <p style="color: var(--text-secondary); font-weight: 500;">Pain Management & Regenerative Medicine Specialist</p>
                </div>
            </div>
            <div class="form-group"><label>Main Clinic</label><input type="text" class="form-input" value="Stay Young Clinic, Lahore" readonly></div>
            <div class="form-group"><label>Address</label><input type="text" class="form-input" value="684 Shadman Main Road, Shadman 1, opposite Fatima Memorial Hospital, Lahore" readonly></div>
            <div class="form-group"><label>Qualifications</label>
                <textarea class="form-input" style="height: 110px;" readonly>MBBS (UHS, 2013)
FAAOT (American Academy of Ozonotherapy, 2017)
Stem Cell Certification (Global Stem Cells Group, 2019)
DMRD (University of Lahore, 2023)
Diplomate of the American Board of Regenerative Medicine — DABRM (2024)</textarea>
            </div>
        </div>
    `;
}

// 5. Clinics Page
function renderClinicsPage() {
    if (pageTitle) pageTitle.textContent = "Clinics Management";
    if (pageSubtitle) pageSubtitle.textContent = "Stay Young Clinic operational settings";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel" style="padding: 24px; max-width: 780px;">
            <h3>Stay Young Clinic, Lahore</h3>
            <p style="color: var(--text-secondary); font-size: 13px; margin-bottom: 20px;">Primary Pain & Regenerative Medicine Center</p>
            <div class="form-group"><label>Clinic Phone / WhatsApp</label><input type="text" class="form-input" value="+92 321 3733332"></div>
            <div class="form-group"><label>Operating Days</label><input type="text" class="form-input" value="Monday – Saturday" readonly></div>
            <div class="form-group"><label>Consultation Hours</label><input type="text" class="form-input" value="12:00 PM – 7:30 PM" readonly></div>
            <button class="btn-primary">Save Clinic Settings</button>
        </div>
    `;
}

// 6. Weekly Schedule Page
function renderWeeklySchedulePage() {
    if (pageTitle) pageTitle.textContent = "Weekly Schedule";
    if (pageSubtitle) pageSubtitle.textContent = "Configure default daily working hours";

    const days = [
        { day: "Monday", active: true, open: "12:00 PM", close: "7:30 PM" },
        { day: "Tuesday", active: true, open: "12:00 PM", close: "7:30 PM" },
        { day: "Wednesday", active: true, open: "12:00 PM", close: "7:30 PM" },
        { day: "Thursday", active: true, open: "12:00 PM", close: "7:30 PM" },
        { day: "Friday", active: true, open: "12:00 PM", close: "7:30 PM" },
        { day: "Saturday", active: true, open: "12:00 PM", close: "7:30 PM" },
        { day: "Sunday", active: false, open: "12:00 PM", close: "7:30 PM" }
    ];

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel">
            <div class="panel-header">
                <h3>Weekly Working Hours</h3>
                <button class="btn-primary">Save Schedule</button>
            </div>
            <div>
                ${days.map(d => `
                    <div class="schedule-row">
                        <span class="schedule-day">${d.day}</span>
                        <label class="switch-toggle">
                            <input type="checkbox" ${d.active ? 'checked' : ''}>
                            <span class="slider"></span>
                        </label>
                        <input type="text" class="form-input" value="${d.open}" style="max-width: 130px;" ${!d.active ? 'disabled' : ''}>
                        <span style="color: var(--text-muted)">to</span>
                        <input type="text" class="form-input" value="${d.close}" style="max-width: 130px;" ${!d.active ? 'disabled' : ''}>
                        <span class="status-badge ${d.active ? 'confirmed' : 'cancelled'}">${d.active ? 'ACTIVE' : 'CLOSED'}</span>
                    </div>
                `).join("")}
            </div>
        </div>
    `;
}

// 7. Off-Days Page
function renderOffDaysPage() {
    if (pageTitle) pageTitle.textContent = "Doctor Off-Days";
    if (pageSubtitle) pageSubtitle.textContent = "Doctor leaves automatically removed from booking availability";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel" style="padding: 22px;">
            <h3>Add Doctor Off-Day</h3>
            <div class="toolbar-row" style="margin-top: 14px; max-width: 600px;">
                <input type="date" id="offDayDate" class="form-input">
                <input type="text" id="offDayReason" class="form-input" placeholder="Reason (e.g. Medical Conference)">
                <button class="btn-primary" style="min-width: 130px;" onclick="addOffDaySubmit()">Add Leave</button>
            </div>
            <div class="table-wrapper" style="margin-top: 18px;">
                <table class="admin-table">
                    <thead>
                        <tr><th>Date</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${state.offDays.length ? state.offDays.map(o => `
                            <tr>
                                <td><strong>${o.date}</strong></td>
                                <td>${o.reason}</td>
                                <td><span class="status-badge cancelled">OFF-DAY</span></td>
                                <td><button class="btn-action red" onclick="removeOffDaySubmit('${o._id}')">Remove</button></td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">🗓</div><strong>No doctor off-days scheduled</strong></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function addOffDaySubmit() {
    const date = document.getElementById("offDayDate").value;
    const reason = document.getElementById("offDayReason").value;
    if (!date) return alert("Please select an off-day date.");

    await fetch(`${API_BASE}/clinics/off-days`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ date, reason: reason || "Doctor Leave" })
    });
    await fetchOffDays();
    renderOffDaysPage();
}

async function removeOffDaySubmit(id) {
    await fetch(`${API_BASE}/clinics/off-days/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await fetchOffDays();
    renderOffDaysPage();
}

// 8. Special Schedules Page
function renderSpecialSchedulesPage() {
    if (pageTitle) pageTitle.textContent = "Special Schedules";
    if (pageSubtitle) pageSubtitle.textContent = "Override regular weekly schedule for specific dates";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel" style="padding: 22px;">
            <h3>Add Special Schedule Override</h3>
            <div class="toolbar-row" style="margin-top: 14px; max-width: 700px;">
                <input type="date" id="spcDate" class="form-input">
                <input type="text" id="spcOpen" class="form-input" placeholder="Open (e.g. 2:00 PM)">
                <input type="text" id="spcClose" class="form-input" placeholder="Close (e.g. 6:00 PM)">
                <button class="btn-primary" style="min-width: 140px;" onclick="addSpecialScheduleSubmit()">Save Override</button>
            </div>
        </div>
    `;
}

async function addSpecialScheduleSubmit() {
    const date = document.getElementById("spcDate").value;
    const openingTime = document.getElementById("spcOpen").value;
    const closingTime = document.getElementById("spcClose").value;
    if (!date || !openingTime || !closingTime) return alert("Fill all fields.");

    await fetch(`${API_BASE}/clinics/special-schedules`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ date, openingTime, closingTime, reason: "Special Schedule Override" })
    });
    alert("Special schedule saved!");
}

// 9. Blocked Slots Page
function renderBlockedSlotsPage() {
    if (pageTitle) pageTitle.textContent = "Blocked Time Slots";
    if (pageSubtitle) pageSubtitle.textContent = "Block specific consultation slots on specific dates";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel" style="padding: 22px;">
            <h3>Block Consultation Time Slot</h3>
            <div class="toolbar-row" style="margin-top: 14px; max-width: 650px;">
                <input type="date" id="blkDate" class="form-input">
                <select id="blkTime" class="form-input">
                    <option value="12:00 PM">12:00 PM</option>
                    <option value="12:30 PM">12:30 PM</option>
                    <option value="1:00 PM">1:00 PM</option>
                    <option value="1:30 PM">1:30 PM</option>
                    <option value="2:00 PM">2:00 PM</option>
                    <option value="2:30 PM">2:30 PM</option>
                    <option value="3:00 PM">3:00 PM</option>
                    <option value="3:30 PM">3:30 PM</option>
                    <option value="4:00 PM">4:00 PM</option>
                    <option value="4:30 PM">4:30 PM</option>
                    <option value="5:00 PM">5:00 PM</option>
                    <option value="5:30 PM">5:30 PM</option>
                    <option value="6:00 PM">6:00 PM</option>
                    <option value="6:30 PM">6:30 PM</option>
                    <option value="7:00 PM">7:00 PM</option>
                    <option value="7:30 PM">7:30 PM</option>
                </select>
                <button class="btn-primary" style="min-width: 130px;" onclick="addBlockedSlotSubmit()">Block Slot</button>
            </div>
            <div class="table-wrapper" style="margin-top: 18px;">
                <table class="admin-table">
                    <thead>
                        <tr><th>Date</th><th>Time Slot</th><th>Reason</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${state.blockedSlots.length ? state.blockedSlots.map(b => `
                            <tr>
                                <td><strong>${b.date}</strong></td>
                                <td>${b.time}</td>
                                <td>${b.reason}</td>
                                <td><button class="btn-action green" onclick="removeBlockedSlotSubmit('${b._id}')">Unblock</button></td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">🚫</div><strong>No blocked time slots</strong></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function addBlockedSlotSubmit() {
    const date = document.getElementById("blkDate").value;
    const time = document.getElementById("blkTime").value;
    if (!date || !time) return alert("Select date and time.");

    await fetch(`${API_BASE}/clinics/blocked-slots`, {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ date, time, reason: "Admin Blocked Slot" })
    });
    await fetchBlockedSlots();
    renderBlockedSlotsPage();
}

async function removeBlockedSlotSubmit(id) {
    await fetch(`${API_BASE}/clinics/blocked-slots/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders()
    });
    await fetchBlockedSlots();
    renderBlockedSlotsPage();
}

// 10. Services / Treatments Page
function renderServicesPage() {
    if (pageTitle) pageTitle.textContent = "Services & Treatments";
    if (pageSubtitle) pageSubtitle.textContent = "Active clinical pain management, regenerative & aesthetic procedures";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel">
            <div class="panel-header">
                <h3>Clinical Procedures List</h3>
            </div>
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr><th>Treatment Title</th><th>Category</th><th>Description</th><th>Status</th></tr>
                    </thead>
                    <tbody>
                        ${state.treatments.length ? state.treatments.map(t => `
                            <tr>
                                <td><strong>${t.title}</strong></td>
                                <td><span class="status-badge reviewed">${t.category}</span></td>
                                <td>${t.description}</td>
                                <td><span class="status-badge ${t.active ? 'confirmed' : 'cancelled'}">${t.active ? 'ACTIVE' : 'INACTIVE'}</span></td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="4"><div class="empty-state"><div class="empty-state-icon">🩺</div><strong>No treatments listed</strong></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

// 11. Uploaded Reports Page
function renderReportsPage() {
    if (pageTitle) pageTitle.textContent = "Uploaded Medical Reports";
    if (pageSubtitle) pageSubtitle.textContent = "Patient MRI, X-Ray, Prescriptions & Lab documents";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel">
            <div class="panel-header">
                <h3>Medical Reports Directory</h3>
            </div>
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th>Report ID</th>
                            <th>Patient Name</th>
                            <th>Phone</th>
                            <th>Token No.</th>
                            <th>Appt ID</th>
                            <th>Category</th>
                            <th>File Name</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${state.reports.length ? state.reports.map(r => `
                            <tr>
                                <td><code>${r.reportId}</code></td>
                                <td><strong>${r.patientName || 'Patient'}</strong></td>
                                <td>${r.phone}</td>
                                <td><strong>${r.token || 'N/A'}</strong></td>
                                <td><code>${r.appointmentId || 'N/A'}</code></td>
                                <td><span class="status-badge reviewed">${r.reportType}</span></td>
                                <td>${r.originalFileName}</td>
                                <td><span class="status-badge ${r.status === 'reviewed' ? 'confirmed' : 'pending'}">${r.status.toUpperCase()}</span></td>
                                <td>
                                    <div class="action-btn-group">
                                        <a href="${API_BASE}/reports/${r._id || r.reportId}/download" target="_blank" class="btn-action blue">View File</a>
                                        ${r.status === 'new' ? `<button class="btn-action green" onclick="markReportReviewedSubmit('${r._id}')">Mark Reviewed</button>` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="9"><div class="empty-state"><div class="empty-state-icon">📄</div><strong>No uploaded reports</strong><p>Uploaded patient scans will appear here immediately.</p></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function markReportReviewedSubmit(id) {
    await fetch(`${API_BASE}/reports/${id}/review`, {
        method: "PATCH",
        headers: getAuthHeaders()
    });
    await fetchReports();
    renderReportsPage();
}

// 12. Virtual Consultation Page
function renderVirtualConsultationsPage() {
    if (pageTitle) pageTitle.textContent = "Virtual Consultations";
    if (pageSubtitle) pageSubtitle.textContent = "Online clinic consultation booking requests";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel">
            <div class="panel-header">
                <h3>Virtual Consultation Requests</h3>
            </div>
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr><th>Request ID</th><th>Patient Name</th><th>Phone</th><th>Requested Date & Time</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${state.consultations.length ? state.consultations.map(c => `
                            <tr>
                                <td><code>${c.requestId}</code></td>
                                <td><strong>${c.patientName}</strong></td>
                                <td>${c.phone}</td>
                                <td>${c.preferredDate} | ${c.preferredTime}</td>
                                <td><span class="status-badge ${c.status === 'approved' ? 'confirmed' : 'pending'}">${c.status.toUpperCase()}</span></td>
                                <td>
                                    <div class="action-btn-group">
                                        <button class="btn-action green" onclick="updateConsultationSubmit('${c._id}', 'approved')">Approve</button>
                                        <button class="btn-action purple" onclick="updateConsultationSubmit('${c._id}', 'completed')">Complete</button>
                                    </div>
                                </td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">💻</div><strong>No virtual consultation requests</strong></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function updateConsultationSubmit(id, status) {
    await fetch(`${API_BASE}/consultations/${id}/status`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status })
    });
    await fetchConsultations();
    renderVirtualConsultationsPage();
}

// 13. Emergency Alerts Page
function renderEmergencyAlertsPage() {
    if (pageTitle) pageTitle.textContent = "Emergency Support Alerts";
    if (pageSubtitle) pageSubtitle.textContent = "Urgent staff-assistance alerts from patient chatbot";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel">
            <div class="panel-header">
                <h3>Urgent Patient Alerts</h3>
            </div>
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr><th>Patient Name</th><th>Phone</th><th>Alert Details</th><th>Priority</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${state.emergencyAlerts.length ? state.emergencyAlerts.map(e => `
                            <tr>
                                <td><strong>${e.patientName}</strong></td>
                                <td>${e.phone}</td>
                                <td>${e.message}</td>
                                <td><span class="status-badge cancelled">${e.priority.toUpperCase()}</span></td>
                                <td><span class="status-badge ${e.status === 'resolved' ? 'confirmed' : 'pending'}">${e.status.toUpperCase()}</span></td>
                                <td>
                                    <button class="btn-action green" onclick="resolveEmergencySubmit('${e._id}')">Resolve Alert</button>
                                </td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="6"><div class="empty-state"><div class="empty-state-icon">⚠</div><strong>No emergency alerts</strong></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function resolveEmergencySubmit(id) {
    await fetch(`${API_BASE}/staff/emergency/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'resolved' })
    });
    await fetchEmergencyAlerts();
    renderEmergencyAlertsPage();
}

// 14. Staff Inbox Page
function renderStaffInboxPage() {
    if (pageTitle) pageTitle.textContent = "Staff Inbox";
    if (pageSubtitle) pageSubtitle.textContent = "Human assistance takeover requests";

    dynamicAdminPage.innerHTML = `
        <div class="dashboard-panel">
            <div class="panel-header">
                <h3>Human Handover Inbox</h3>
            </div>
            <div class="table-wrapper">
                <table class="admin-table">
                    <thead>
                        <tr><th>Patient Name</th><th>Phone</th><th>Message Details</th><th>Status</th><th>Actions</th></tr>
                    </thead>
                    <tbody>
                        ${state.staffMessages.length ? state.staffMessages.map(m => `
                            <tr>
                                <td><strong>${m.patientName}</strong></td>
                                <td>${m.phone}</td>
                                <td>${m.message}</td>
                                <td><span class="status-badge ${m.status === 'completed' ? 'confirmed' : 'pending'}">${m.status.toUpperCase()}</span></td>
                                <td>
                                    <button class="btn-action green" onclick="completeStaffInboxSubmit('${m._id}')">Mark Done</button>
                                </td>
                            </tr>
                        `).join("") : `
                            <tr><td colspan="5"><div class="empty-state"><div class="empty-state-icon">💬</div><strong>No staff handover messages</strong></div></td></tr>
                        `}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

async function completeStaffInboxSubmit(id) {
    await fetch(`${API_BASE}/staff/inbox/${id}`, {
        method: "PATCH",
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: 'completed' })
    });
    await fetchStaffInbox();
    renderStaffInboxPage();
}

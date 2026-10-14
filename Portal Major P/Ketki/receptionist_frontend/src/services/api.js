/**
 * api.js — Receptionist API Client
 * Targets Express EHR Gateway on port 5000.
 * Injects JWT Bearer token into all requests.
 */

const API_BASE = "http://localhost:5000/api";

function getAuthHeader() {
    const token = localStorage.getItem("receptionist_token");
    return token ? { "Authorization": `Bearer ${token}` } : {};
}

export async function loginReceptionist(email, password) {
    const res = await fetch(`${API_BASE}/auth/receptionist/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || "Failed to log in");
    }
    return data;
}

export async function getDoctors() {
    const res = await fetch(`${API_BASE}/receptionist/doctors`, {
        headers: { ...getAuthHeader() }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to fetch doctors");
    return data.doctors || [];
}

export async function getPatients() {
    const res = await fetch(`${API_BASE}/receptionist/patients`, {
        headers: { ...getAuthHeader() }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to fetch patients");
    return data.patients || [];
}

export async function registerPatient(patientData) {
    const res = await fetch(`${API_BASE}/receptionist/patients`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeader()
        },
        body: JSON.stringify(patientData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to register patient");
    return { ...data.patient, activation_url: data.activation_url };
}

export async function getAppointments() {
    const res = await fetch(`${API_BASE}/receptionist/appointments`, {
        headers: { ...getAuthHeader() }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to fetch appointments");
    return data.appointments || [];
}

export async function scheduleAppointment(apptData) {
    const res = await fetch(`${API_BASE}/receptionist/appointments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeader()
        },
        body: JSON.stringify(apptData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to schedule appointment");
    return data;
}

export async function updateAppointmentStatus(appointmentId, status) {
    const res = await fetch(`${API_BASE}/receptionist/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            ...getAuthHeader()
        },
        body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to update appointment status");
    return data;
}

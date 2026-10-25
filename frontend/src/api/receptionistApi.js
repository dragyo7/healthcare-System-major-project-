import { resilientFetch } from "./client";

export const receptionistApi = {
  getDoctors: async () => {
    const data = await resilientFetch("/receptionist/doctors");
    return data.doctors || [];
  },

  registerDoctor: async (doctorData) => {
    return await resilientFetch("/receptionist/doctors", {
      method: "POST",
      body: JSON.stringify(doctorData),
    });
  },

  getPatients: async () => {
    const data = await resilientFetch("/receptionist/patients");
    return data.patients || [];
  },

  registerPatient: async (patientData) => {
    return await resilientFetch("/receptionist/patients", {
      method: "POST",
      body: JSON.stringify(patientData),
    });
  },

  getAppointments: async () => {
    const data = await resilientFetch("/receptionist/appointments");
    return data.appointments || [];
  },

  createAppointment: async (appointmentData) => {
    return await resilientFetch("/receptionist/appointments", {
      method: "POST",
      body: JSON.stringify(appointmentData),
    });
  },

  updateAppointmentStatus: async (appointmentId, status) => {
    return await resilientFetch(`/receptionist/appointments/${appointmentId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
  },

  rescheduleAppointment: async (appointmentId, rescheduleData) => {
    return await resilientFetch(`/receptionist/appointments/${appointmentId}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify(rescheduleData),
    });
  },
};

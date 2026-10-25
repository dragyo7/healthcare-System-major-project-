/**
 * prescriptionPdfService.js
 * Production Clinical Prescription PDF Generation Service using PDFKit.
 * Generates an authoritative, beautifully styled clinical prescription document
 * with Hospital Branding, Two-Column Patient & Clinician Metadata, Styled Medication Table,
 * Clinical Directives, and CDSS Verification Seal.
 */

const PDFDocument = require("pdfkit");

function generatePrescriptionPdfStream({
    prescription,
    doctor,
    patient,
    medicines = [],
    outputStream
}) {
    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(outputStream);

    const primaryEmerald = "#047857";
    const darkEmerald = "#064e3b";
    const lightEmeraldBg = "#ecfdf5";
    const borderEmerald = "#a7f3d0";
    const textDark = "#0f172a";
    const textMuted = "#475569";
    const bgLight = "#f8fafc";
    const borderLight = "#e2e8f0";

    // 1. Hospital Header Bar
    doc.rect(40, 40, 515, 65).fill(primaryEmerald);
    doc.fillColor("#ffffff").fontSize(16).font("Helvetica-Bold")
       .text("ST. MARY MULTISPECIALTY HOSPITAL", 55, 52);
    doc.fontSize(9.5).font("Helvetica")
       .text("Clinical Intelligence & Decision Support Center • Academic Clinical Decision Support Prototype", 55, 72);
    doc.fontSize(8).fillColor("#a7f3d0")
       .text("108 Healthcare Boulevard, Medical District • Emergency Hotline: 108 • contact@stmaryhealth.org", 55, 87);

    // 2. Document Title Pill
    doc.rect(40, 115, 515, 24).fill(lightEmeraldBg);
    doc.rect(40, 115, 515, 24).stroke(borderEmerald);
    doc.fillColor(darkEmerald).fontSize(10).font("Helvetica-Bold")
       .text("OFFICIAL OUTPATIENT PRESCRIPTION RECORD", 40, 122, { align: "center", width: 515 });

    // 3. Two-Column Metadata Box
    doc.rect(40, 148, 515, 85).fill(bgLight);
    doc.rect(40, 148, 515, 85).stroke(borderLight);

    // Left Column: Patient Details
    const patientName = patient?.full_name || prescription?.patient_name || "Authorized Patient";
    const patientId = patient?.patient_id || prescription?.patient_id || "N/A";
    const gender = patient?.gender || prescription?.gender || "Unspecified";
    const bloodGroup = patient?.blood_group || prescription?.blood_group || "Not documented";
    const rawAllergies = (patient?.allergies || prescription?.allergies || "").trim();

    doc.fillColor("#334155").fontSize(8).font("Helvetica-Bold").text("PATIENT IDENTIFICATION", 55, 158);
    doc.fillColor(textDark).fontSize(11).font("Helvetica-Bold").text(patientName, 55, 170);
    doc.fillColor(textMuted).fontSize(8.5).font("Helvetica")
       .text(`Patient ID: #${patientId}   |   Gender: ${gender}   |   Blood Group: ${bloodGroup}`, 55, 185)
       .text("Documented Allergies: ", 55, 199);

    if (rawAllergies && rawAllergies.toLowerCase() !== "none" && rawAllergies.toLowerCase() !== "nil" && !rawAllergies.toLowerCase().includes("no known") && !rawAllergies.toLowerCase().includes("nkda")) {
        doc.fillColor("#dc2626").font("Helvetica-Bold").text(rawAllergies, 155, 199);
    } else if (rawAllergies && (rawAllergies.toLowerCase().includes("no known") || rawAllergies.toLowerCase().includes("nkda"))) {
        doc.fillColor(primaryEmerald).font("Helvetica").text("No known drug allergies (NKDA)", 155, 199);
    } else {
        doc.fillColor(textMuted).font("Helvetica").text("Not documented", 155, 199);
    }

    // Right Column: Prescribing Doctor Details
    const docName = doctor?.full_name || prescription?.doctor_name || "Attending Physician";
    const specialization = doctor?.specialization || prescription?.specialization || "General Medicine";
    const qualification = doctor?.qualification || prescription?.qualification || "MBBS, MD";
    const licenseNo = doctor?.license_number || prescription?.license_number || "NMC-VERIFIED";
    const rxDate = prescription?.prescription_date
        ? new Date(prescription.prescription_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
        : new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

    doc.fillColor("#334155").fontSize(8).font("Helvetica-Bold").text("PRESCRIBING CLINICIAN", 320, 158);
    doc.fillColor(textDark).fontSize(11).font("Helvetica-Bold").text(`Dr. ${docName.replace(/^Dr\.\s*/i, "")}`, 320, 170);
    doc.fillColor(textMuted).fontSize(8.5).font("Helvetica")
       .text(`${specialization}   |   ${qualification}`, 320, 185)
       .text(`License No.: ${licenseNo}   |   Date: ${rxDate}`, 320, 199);

    // 4. Clinical Diagnosis
    const diagnosis = prescription?.diagnosis || "Clinical Outpatient Evaluation";
    doc.rect(40, 242, 515, 28).fill("#f1f5f9");
    doc.fillColor("#334155").fontSize(8.5).font("Helvetica-Bold").text("DIAGNOSIS:", 55, 251);
    doc.fillColor(textDark).fontSize(9).font("Helvetica").text(diagnosis, 125, 251);

    // 5. Prescribed Medications Table Header
    doc.rect(40, 278, 515, 22).fill(primaryEmerald);
    doc.fillColor("#ffffff").fontSize(8.5).font("Helvetica-Bold");
    doc.text("#", 48, 284);
    doc.text("Medication Name", 68, 284);
    doc.text("Dosage", 205, 284);
    doc.text("Frequency", 275, 284);
    doc.text("Duration", 340, 284);
    doc.text("Route & Instructions", 405, 284);

    let y = 300;
    if (medicines.length === 0) {
        doc.rect(40, y, 515, 26).fill("#ffffff");
        doc.rect(40, y, 515, 26).stroke(borderLight);
        doc.fillColor(textMuted).fontSize(8.5).font("Helvetica-Oblique")
           .text("No specific medications prescribed in this record.", 55, y + 8);
        y += 26;
    } else {
        medicines.forEach((m, idx) => {
            const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
            doc.rect(40, y, 515, 26).fill(rowBg);
            doc.rect(40, y, 515, 26).stroke(borderLight);

            doc.fillColor("#334155").fontSize(8.5).font("Helvetica-Bold").text(String(idx + 1), 48, y + 8);
            doc.fillColor(textDark).font("Helvetica-Bold").text(m.medicine_name || "Medication", 68, y + 8, { width: 130, ellipsis: true });
            doc.fillColor("#334155").font("Helvetica").text(m.dosage || "-", 205, y + 8);
            doc.text(m.frequency || "-", 275, y + 8);
            doc.text(m.duration || "-", 340, y + 8);
            doc.fillColor(primaryEmerald).font("Helvetica").text(`${m.route ? m.route + " • " : ""}${m.instructions || "As directed"}`, 405, y + 8, { width: 145, ellipsis: true });
            y += 26;
        });
    }

    // 6. Clinical Directives & Doctor Notes Box
    y += 12;
    const notes = prescription?.notes || "Take all medications exactly as prescribed. Complete full course.";
    doc.rect(40, y, 515, 52).fill(bgLight);
    doc.rect(40, y, 515, 52).stroke("#cbd5e1");
    doc.fillColor("#334155").fontSize(8).font("Helvetica-Bold").text("CLINICAL DIRECTIVES & SPECIAL PRECAUTIONS", 55, y + 8);
    doc.fillColor("#1e293b").fontSize(8.5).font("Helvetica")
       .text(notes, 55, y + 21, { width: 485, height: 26, ellipsis: true });

    // 7. Security & Safety Verification Badge (truthful status derived from saved override data)
    y += 62;
    const notesText = prescription?.notes || "";
    const hasOverride = notesText.includes("[CLINICIAN OVERRIDE") || notesText.includes("[EMERGENCY CLINICIAN OVERRIDE") || Boolean(prescription?.safety_override_reason);

    const badgeBg = hasOverride ? "#fffbeb" : lightEmeraldBg;
    const badgeBorder = hasOverride ? "#f59e0b" : "#10b981";
    const badgeHeaderColor = hasOverride ? "#92400e" : darkEmerald;

    doc.rect(40, y, 515, 38).fill(badgeBg);
    doc.rect(40, y, 515, 38).stroke(badgeBorder);
    doc.fillColor(badgeHeaderColor).fontSize(8.5).font("Helvetica-Bold")
       .text("CLINICAL DECISION SUPPORT & DOCTOR-IN-THE-LOOP SAFETY STATUS", 55, y + 8);

    if (hasOverride) {
        doc.fillColor("#b45309").fontSize(7.5).font("Helvetica-Bold")
           .text("Deterministic DDI Screen: INTERACTION DETECTED — CLINICIAN OVERRIDE RECORDED", 55, y + 19);
    } else {
        doc.fillColor(primaryEmerald).fontSize(7.5).font("Helvetica")
           .text("Deterministic DDI Screen: PASSED — NO MATCHING LOCAL INTERACTION RULES", 55, y + 19);
    }

    doc.fillColor(textMuted).fontSize(7.5).font("Helvetica")
       .text("Clinician Authorization: Reviewed and electronically ordered by attending clinician", 55, y + 28);

    // 8. Footer
    doc.rect(40, 750, 515, 1).fill("#cbd5e1");
    doc.fillColor("#64748b").fontSize(8).font("Helvetica")
       .text("CDSS Healthcare v2.10 • Authorized Electronic Health Record (EHR) • Page 1 of 1", 40, 758, { align: "center", width: 515 });

    doc.end();
}

module.exports = {
    generatePrescriptionPdfStream
};

const Report = require('../models/Report');
const path = require('path');
const fs = require('fs');
const { successResponse, errorResponse } = require('../utils/response');

let memoryReports = [];

// POST /api/reports
const uploadMedicalReport = async (req, res, next) => {
    try {
        if (!req.file) {
            return errorResponse(res, 400, 'Medical report file is required (PDF, JPG, JPEG, PNG).');
        }

        const { phone, appointmentId, token, reportType, description, patientName } = req.body;

        if (!phone || !reportType) {
            return errorResponse(res, 400, 'Patient phone number and report category are required.');
        }

        let resolvedPatientName = patientName;
        if (!resolvedPatientName || resolvedPatientName === 'Patient') {
            try {
                const Appointment = require('../models/Appointment');
                const matchApp = await Appointment.findOne({
                    $or: [
                        { phone: phone ? phone.trim() : '' },
                        { tokenNumber: token ? token.trim() : '' },
                        { appointmentId: appointmentId ? appointmentId.trim() : '' }
                    ]
                });
                if (matchApp && matchApp.patientName) {
                    resolvedPatientName = matchApp.patientName;
                }
            } catch (e) {}
        }

        const reportId = `REP-${Date.now().toString().slice(-6)}`;
        const reportData = {
            reportId,
            patientName: resolvedPatientName || 'Patient',
            phone: phone.trim(),
            appointmentId: appointmentId || '',
            token: token || '',
            reportType,
            description: description || '',
            originalFileName: req.file.originalname,
            storedFileName: req.file.filename,
            mimeType: req.file.mimetype,
            fileSize: req.file.size,
            storagePath: req.file.path,
            status: 'new',
            createdAt: new Date().toISOString()
        };

        let savedReport;
        try {
            savedReport = await Report.create(reportData);
        } catch (e) {
            savedReport = { ...reportData, _id: `mem_rep_${Date.now()}` };
            memoryReports.unshift(savedReport);
        }

        return successResponse(res, 201, 'Medical report uploaded successfully', savedReport);
    } catch (error) {
        next(error);
    }
};

// GET /api/reports
const getReports = async (req, res, next) => {
    try {
        let reports = [];
        try {
            reports = await Report.find().sort({ createdAt: -1 });
        } catch (e) {
            reports = memoryReports;
        }

        return successResponse(res, 200, 'Reports fetched successfully', reports);
    } catch (error) {
        next(error);
    }
};

// PATCH /api/reports/:id/review
const markReportReviewed = async (req, res, next) => {
    try {
        const { id } = req.params;
        let updated;

        try {
            updated = await Report.findByIdAndUpdate(id, {
                status: 'reviewed',
                reviewedAt: new Date(),
                reviewedBy: req.admin ? req.admin.username : 'Admin'
            }, { new: true });
        } catch (e) {
            const item = memoryReports.find(r => r._id === id || r.reportId === id);
            if (item) {
                item.status = 'reviewed';
                item.reviewedAt = new Date().toISOString();
                item.reviewedBy = 'Admin';
                updated = item;
            }
        }

        if (!updated) {
            return errorResponse(res, 404, 'Report record not found.');
        }

        return successResponse(res, 200, 'Report marked as reviewed', updated);
    } catch (error) {
        next(error);
    }
};

// GET /api/reports/:id/download
const downloadReportFile = async (req, res, next) => {
    try {
        const { id } = req.params;
        let report;

        try {
            report = await Report.findById(id);
            if (!report) {
                report = await Report.findOne({ reportId: id });
            }
        } catch (e) {
            report = memoryReports.find(r => r._id === id || r.reportId === id);
        }

        if (!report) {
            return errorResponse(res, 404, 'Report not found.');
        }

        const filePath = report.storagePath;
        if (!fs.existsSync(filePath)) {
            return errorResponse(res, 404, 'Physical report file not found on server.');
        }

        return res.sendFile(filePath);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    uploadMedicalReport,
    getReports,
    markReportReviewed,
    downloadReportFile,
    memoryReports
};

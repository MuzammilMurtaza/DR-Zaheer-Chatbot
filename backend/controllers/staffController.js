const StaffMessage = require('../models/StaffMessage');
const EmergencyAlert = require('../models/EmergencyAlert');
const { successResponse, errorResponse } = require('../utils/response');

let memoryStaffMessages = [];
let memoryEmergencyAlerts = [];

// POST /api/staff/handover
const requestHandover = async (req, res, next) => {
    try {
        const { patientName, phone, message } = req.body;
        if (!patientName || !phone || !message) {
            return errorResponse(res, 400, 'Patient Name, Phone Number, and Message details are required for staff handover.');
        }

        const data = {
            patientName: patientName.trim(),
            phone: phone.trim(),
            message: message.trim(),
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        let created;
        try {
            created = await StaffMessage.create(data);
        } catch (e) {
            created = { ...data, _id: `stf_${Date.now()}` };
            memoryStaffMessages.unshift(created);
        }

        return successResponse(res, 201, 'Request transferred to clinic staff', created);
    } catch (error) {
        next(error);
    }
};

// GET /api/staff/inbox
const getStaffInbox = async (req, res, next) => {
    try {
        let list = [];
        try {
            list = await StaffMessage.find().sort({ createdAt: -1 });
        } catch (e) {
            list = memoryStaffMessages;
        }
        return successResponse(res, 200, 'Staff inbox messages retrieved', list);
    } catch (error) {
        next(error);
    }
};

// PATCH /api/staff/inbox/:id
const updateStaffMessageStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        let updated;

        try {
            updated = await StaffMessage.findByIdAndUpdate(id, { status }, { new: true });
        } catch (e) {
            const item = memoryStaffMessages.find(m => m._id === id);
            if (item) {
                item.status = status;
                updated = item;
            }
        }

        if (!updated) return errorResponse(res, 404, 'Handover message not found.');
        return successResponse(res, 200, `Staff message status updated to ${status}`, updated);
    } catch (error) {
        next(error);
    }
};

// POST /api/staff/emergency
const createEmergencyAlert = async (req, res, next) => {
    try {
        const { patientName, phone, message, priority } = req.body;
        if (!patientName || !phone || !message) {
            return errorResponse(res, 400, 'Patient Name, Phone, and Alert details are required.');
        }

        const data = {
            patientName: patientName.trim(),
            phone: phone.trim(),
            message: message.trim(),
            priority: priority || 'high',
            status: 'open',
            createdAt: new Date().toISOString()
        };

        let created;
        try {
            created = await EmergencyAlert.create(data);
        } catch (e) {
            created = { ...data, _id: `emg_${Date.now()}` };
            memoryEmergencyAlerts.unshift(created);
        }

        return successResponse(res, 201, 'Emergency alert registered', created);
    } catch (error) {
        next(error);
    }
};

// GET /api/staff/emergency
const getEmergencyAlerts = async (req, res, next) => {
    try {
        let list = [];
        try {
            list = await EmergencyAlert.find().sort({ createdAt: -1 });
        } catch (e) {
            list = memoryEmergencyAlerts;
        }
        return successResponse(res, 200, 'Emergency alerts retrieved', list);
    } catch (error) {
        next(error);
    }
};

// PATCH /api/staff/emergency/:id
const updateEmergencyAlertStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        let updated;

        try {
            updated = await EmergencyAlert.findByIdAndUpdate(id, { status }, { new: true });
        } catch (e) {
            const item = memoryEmergencyAlerts.find(e => e._id === id);
            if (item) {
                item.status = status;
                updated = item;
            }
        }

        if (!updated) return errorResponse(res, 404, 'Emergency alert not found.');
        return successResponse(res, 200, `Emergency alert status updated to ${status}`, updated);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    requestHandover,
    getStaffInbox,
    updateStaffMessageStatus,
    createEmergencyAlert,
    getEmergencyAlerts,
    updateEmergencyAlertStatus
};

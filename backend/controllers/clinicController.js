const Clinic = require('../models/Clinic');
const OffDay = require('../models/OffDay');
const BlockedSlot = require('../models/BlockedSlot');
const SpecialSchedule = require('../models/SpecialSchedule');
const { successResponse, errorResponse } = require('../utils/response');

let memoryClinic = {
    name: 'Stay Young Clinic',
    city: 'Lahore',
    address: '684 Shadman Main Road, Shadman 1, opposite Fatima Memorial Hospital, Lahore',
    phone: '+92 321 3733332',
    active: true,
    timezone: 'Asia/Karachi',
    weeklySchedule: {
        monday: { active: true, open: '12:00 PM', close: '7:30 PM' },
        tuesday: { active: true, open: '12:00 PM', close: '7:30 PM' },
        wednesday: { active: true, open: '12:00 PM', close: '7:30 PM' },
        thursday: { active: true, open: '12:00 PM', close: '7:30 PM' },
        friday: { active: true, open: '12:00 PM', close: '7:30 PM' },
        saturday: { active: true, open: '12:00 PM', close: '7:30 PM' },
        sunday: { active: false, open: '12:00 PM', close: '7:30 PM' }
    }
};

let memoryOffDays = [];
let memoryBlockedSlots = [];
let memorySpecialSchedules = [];

// GET /api/clinics
const getClinics = async (req, res, next) => {
    try {
        let clinic = null;
        try {
            clinic = await Clinic.findOne();
            if (!clinic) {
                clinic = await Clinic.create(memoryClinic);
            }
        } catch (e) {
            clinic = memoryClinic;
        }
        return successResponse(res, 200, 'Clinic details fetched', clinic);
    } catch (error) {
        next(error);
    }
};

// PATCH /api/clinics/:id
const updateClinic = async (req, res, next) => {
    try {
        const { id } = req.params;
        let updated;
        try {
            updated = await Clinic.findByIdAndUpdate(id, req.body, { new: true });
        } catch (e) {
            memoryClinic = { ...memoryClinic, ...req.body };
            updated = memoryClinic;
        }
        return successResponse(res, 200, 'Clinic details updated', updated);
    } catch (error) {
        next(error);
    }
};

// GET /api/clinics/off-days
const getOffDays = async (req, res, next) => {
    try {
        let list = [];
        try {
            list = await OffDay.find().sort({ date: 1 });
        } catch (e) {
            list = memoryOffDays;
        }
        return successResponse(res, 200, 'Off-days fetched', list);
    } catch (error) {
        next(error);
    }
};

// POST /api/clinics/off-days
const addOffDay = async (req, res, next) => {
    try {
        const { date, reason } = req.body;
        if (!date) return errorResponse(res, 400, 'Off-day date is required.');

        let created;
        try {
            created = await OffDay.create({ date, reason: reason || 'Doctor Leave' });
        } catch (e) {
            created = { _id: `off_${Date.now()}`, date, reason: reason || 'Doctor Leave' };
            memoryOffDays.push(created);
        }
        return successResponse(res, 201, 'Off-day added successfully', created);
    } catch (error) {
        next(error);
    }
};

// DELETE /api/clinics/off-days/:id
const deleteOffDay = async (req, res, next) => {
    try {
        const { id } = req.params;
        try {
            await OffDay.findByIdAndDelete(id);
        } catch (e) {
            memoryOffDays = memoryOffDays.filter(o => o._id !== id && o.date !== id);
        }
        return successResponse(res, 200, 'Off-day removed successfully');
    } catch (error) {
        next(error);
    }
};

// GET /api/clinics/blocked-slots
const getBlockedSlots = async (req, res, next) => {
    try {
        let list = [];
        try {
            list = await BlockedSlot.find().sort({ date: 1, time: 1 });
        } catch (e) {
            list = memoryBlockedSlots;
        }
        return successResponse(res, 200, 'Blocked slots fetched', list);
    } catch (error) {
        next(error);
    }
};

// POST /api/clinics/blocked-slots
const addBlockedSlot = async (req, res, next) => {
    try {
        const { date, time, reason } = req.body;
        if (!date || !time) return errorResponse(res, 400, 'Date and Time slot are required to block slot.');

        let created;
        try {
            created = await BlockedSlot.create({ date, time, reason: reason || 'Blocked slot' });
        } catch (e) {
            created = { _id: `blk_${Date.now()}`, date, time, reason: reason || 'Blocked slot' };
            memoryBlockedSlots.push(created);
        }
        return successResponse(res, 201, 'Slot blocked successfully', created);
    } catch (error) {
        next(error);
    }
};

// DELETE /api/clinics/blocked-slots/:id
const deleteBlockedSlot = async (req, res, next) => {
    try {
        const { id } = req.params;
        try {
            await BlockedSlot.findByIdAndDelete(id);
        } catch (e) {
            memoryBlockedSlots = memoryBlockedSlots.filter(b => b._id !== id);
        }
        return successResponse(res, 200, 'Slot unblocked successfully');
    } catch (error) {
        next(error);
    }
};

// GET /api/clinics/special-schedules
const getSpecialSchedules = async (req, res, next) => {
    try {
        let list = [];
        try {
            list = await SpecialSchedule.find().sort({ date: 1 });
        } catch (e) {
            list = memorySpecialSchedules;
        }
        return successResponse(res, 200, 'Special schedules fetched', list);
    } catch (error) {
        next(error);
    }
};

// POST /api/clinics/special-schedules
const addSpecialSchedule = async (req, res, next) => {
    try {
        const { date, openingTime, closingTime, reason } = req.body;
        if (!date || !openingTime || !closingTime) {
            return errorResponse(res, 400, 'Date, Opening Time, and Closing Time are required.');
        }

        let created;
        try {
            created = await SpecialSchedule.create({ date, openingTime, closingTime, reason });
        } catch (e) {
            created = { _id: `spc_${Date.now()}`, date, openingTime, closingTime, reason };
            memorySpecialSchedules.push(created);
        }
        return successResponse(res, 201, 'Special schedule override saved', created);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getClinics,
    updateClinic,
    getOffDays,
    addOffDay,
    deleteOffDay,
    getBlockedSlots,
    addBlockedSlot,
    deleteBlockedSlot,
    getSpecialSchedules,
    addSpecialSchedule
};

const mongoose = require('mongoose');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const OffDay = require('../models/OffDay');
const BlockedSlot = require('../models/BlockedSlot');
const SpecialSchedule = require('../models/SpecialSchedule');
const Clinic = require('../models/Clinic');
const { generateTokenNumber } = require('../utils/tokenGenerator');
const { generateAppointmentId } = require('../utils/appointmentIdGenerator');
const { generateSlotsForDate } = require('../utils/slotGenerator');
const { successResponse, errorResponse } = require('../utils/response');

// In-memory cache fallback for development without active MongoDB
let memoryAppointments = [];

// GET /api/appointments/slots?date=YYYY-MM-DD
const getAvailableSlots = async (req, res, next) => {
    try {
        const { date } = req.query;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return errorResponse(res, 400, 'Valid date parameter (YYYY-MM-DD) is required.');
        }

        const slotResult = await generateSlotsForDate({
            dateStr: date,
            AppointmentModel: Appointment,
            OffDayModel: OffDay,
            BlockedSlotModel: BlockedSlot,
            SpecialScheduleModel: SpecialSchedule,
            ClinicModel: Clinic
        });

        // Filter out memory appointments if running in dev fallback
        if (memoryAppointments.length > 0) {
            const bookedTimesInMemory = memoryAppointments
                .filter(a => a.date === date && a.status !== 'cancelled')
                .map(a => a.time);
            slotResult.slots = slotResult.slots.filter(s => !bookedTimesInMemory.includes(s));
        }

        return successResponse(res, 200, 'Available slots fetched successfully', slotResult);
    } catch (error) {
        next(error);
    }
};

// POST /api/appointments
const createAppointment = async (req, res, next) => {
    try {
        const { patientName, phone, appointmentType, clinic, city, date, time, notes } = req.body;

        const clinicName = clinic || 'Stay Young Clinic';
        const cityLocation = city || 'Lahore';

        // Check for double booking
        let existingBooking = null;
        try {
            existingBooking = await Appointment.findOne({
                clinic: clinicName,
                date,
                time,
                status: { $nin: ['cancelled'] }
            });
        } catch (e) {
            existingBooking = memoryAppointments.find(a => a.date === date && a.time === time && a.status !== 'cancelled');
        }

        if (existingBooking) {
            return errorResponse(res, 400, 'Selected appointment slot is no longer available. Please select another time slot.');
        }

        // Generate ID and Token
        const appointmentId = await generateAppointmentId(Appointment);
        const tokenNumber = await generateTokenNumber(Appointment, clinicName, date);

        // Find or create patient record
        let patientDoc = null;
        try {
            patientDoc = await Patient.findOne({ phone: phone.trim() });
            if (!patientDoc) {
                patientDoc = await Patient.create({
                    patientId: `PAT-${Date.now().toString().slice(-6)}`,
                    name: patientName.trim(),
                    phone: phone.trim()
                });
            }
        } catch (e) {
            // MongoDB fallback
        }

        const appointmentData = {
            appointmentId,
            tokenNumber,
            patient: patientDoc ? patientDoc._id : null,
            patientName: patientName.trim(),
            phone: phone.trim(),
            appointmentType: appointmentType || 'In-Person Appointment',
            clinic: clinicName,
            city: cityLocation,
            date,
            time,
            status: 'confirmed',
            notes: notes || '',
            createdAt: new Date().toISOString()
        };

        let savedAppointment;
        try {
            savedAppointment = await Appointment.create(appointmentData);
        } catch (e) {
            savedAppointment = { ...appointmentData, _id: `mem_${Date.now()}` };
            memoryAppointments.unshift(savedAppointment);
        }

        return successResponse(res, 201, 'Appointment booked successfully', savedAppointment);
    } catch (error) {
        next(error);
    }
};

// GET /api/appointments
const getAppointments = async (req, res, next) => {
    try {
        const { status, date, search } = req.query;
        let filter = {};

        if (status) filter.status = status;
        if (date) filter.date = date;
        if (search) {
            filter.$or = [
                { patientName: { $regex: search, $options: 'i' } },
                { phone: { $regex: search, $options: 'i' } },
                { appointmentId: { $regex: search, $options: 'i' } },
                { tokenNumber: { $regex: search, $options: 'i' } }
            ];
        }

        let appointments = [];
        try {
            appointments = await Appointment.find(filter).sort({ createdAt: -1 });
        } catch (e) {
            appointments = memoryAppointments;
        }

        return successResponse(res, 200, 'Appointments retrieved successfully', appointments);
    } catch (error) {
        next(error);
    }
};

// GET /api/appointments/search
const searchAppointments = async (req, res, next) => {
    try {
        const { query, tokenNumber, appointmentId, phone } = req.query;
        const rawSearch = (tokenNumber || appointmentId || phone || query || '').trim();

        if (!rawSearch) {
            return errorResponse(res, 400, 'Search term (tokenNumber, appointmentId, or phone) is required.');
        }

        // Clean input of '#' symbol, 'token' prefix, and extra spaces
        const cleanSearch = rawSearch
            .replace(/^[#\s]+/, '')
            .replace(/^token\s*#?/i, '')
            .trim();

        const orConditions = [];

        // Exact matches
        orConditions.push({ tokenNumber: cleanSearch });
        orConditions.push({ tokenNumber: rawSearch });
        orConditions.push({ appointmentId: cleanSearch });
        orConditions.push({ appointmentId: rawSearch });
        orConditions.push({ phone: cleanSearch });
        orConditions.push({ phone: rawSearch });

        // Case-insensitive Appointment ID match
        orConditions.push({ appointmentId: new RegExp(`^${cleanSearch}$`, 'i') });

        // Token Number numeric normalization (e.g. '#006', '006', '6', '#6' -> '006', '6', '06')
        if (/^\d+$/.test(cleanSearch)) {
            const num = parseInt(cleanSearch, 10);
            if (!isNaN(num) && num >= 0 && num <= 9999) {
                const pad3 = String(num).padStart(3, '0'); // '006'
                const pad2 = String(num).padStart(2, '0'); // '06'
                const rawNum = String(num);               // '6'

                orConditions.push({ tokenNumber: pad3 });
                orConditions.push({ tokenNumber: pad2 });
                orConditions.push({ tokenNumber: rawNum });
            }
        }

        // Phone Number normalization
        const digitsOnly = cleanSearch.replace(/\D/g, '');
        if (digitsOnly.length >= 7) {
            const last7 = digitsOnly.slice(-7);
            const last10 = digitsOnly.slice(-10);
            orConditions.push({ phone: digitsOnly });
            orConditions.push({ phone: new RegExp(`${last7}$`) });
            orConditions.push({ phone: new RegExp(`${last10}$`) });
        }

        let results = [];
        try {
            results = await Appointment.find({ $or: orConditions }).sort({ createdAt: -1 });
        } catch (e) {
            // Memory appointments fallback for testing
            results = memoryAppointments.filter(a => {
                const tNum = (a.tokenNumber || '').replace(/^[#\s]+/, '').trim();
                const aId = (a.appointmentId || '').toUpperCase().trim();
                const aPhone = (a.phone || '').replace(/\D/g, '');

                const searchUpper = cleanSearch.toUpperCase();
                const num = parseInt(cleanSearch, 10);
                const pad3 = !isNaN(num) ? String(num).padStart(3, '0') : null;

                return (
                    a.tokenNumber === cleanSearch ||
                    a.tokenNumber === rawSearch ||
                    tNum === cleanSearch ||
                    (pad3 && tNum === pad3) ||
                    (!isNaN(num) && parseInt(tNum, 10) === num) ||
                    aId === searchUpper ||
                    a.phone === cleanSearch ||
                    (digitsOnly && aPhone.includes(digitsOnly.slice(-7)))
                );
            });
        }

        return successResponse(res, 200, 'Search complete', results);
    } catch (error) {
        next(error);
    }
};

// PATCH /api/appointments/:id/confirm
const confirmAppointment = async (req, res, next) => {
    try {
        const { id } = req.params;
        let updated = null;

        const updatePayload = {
            status: 'confirmed',
            confirmedAt: new Date()
        };

        const rawId = (id || '').trim();
        const cleanId = rawId.replace(/^[#\s]+/, '').replace(/^token\s*#?/i, '').trim();
        const num = parseInt(cleanId, 10);
        const pad3 = !isNaN(num) ? String(num).padStart(3, '0') : cleanId;

        const findConditions = [
            { appointmentId: cleanId },
            { appointmentId: new RegExp(`^${cleanId}$`, 'i') },
            { tokenNumber: cleanId },
            { tokenNumber: pad3 },
            { tokenNumber: rawId }
        ];

        if (num && /^\d+$/.test(cleanId)) {
            findConditions.push({ tokenNumber: String(num) });
        }

        try {
            if (mongoose.Types.ObjectId.isValid(rawId)) {
                updated = await Appointment.findByIdAndUpdate(rawId, updatePayload, { new: true });
            }
            if (!updated) {
                updated = await Appointment.findOneAndUpdate(
                    { $or: findConditions },
                    updatePayload,
                    { new: true }
                );
            }
        } catch (e) {
            updated = null;
        }

        if (!updated) {
            const item = memoryAppointments.find(a => {
                const tNum = (a.tokenNumber || '').replace(/^[#\s]+/, '').trim();
                const aId = (a.appointmentId || '').toUpperCase().trim();
                return (
                    a._id === rawId ||
                    a.appointmentId === cleanId ||
                    aId === cleanId.toUpperCase() ||
                    a.tokenNumber === cleanId ||
                    a.tokenNumber === pad3 ||
                    tNum === cleanId ||
                    (num && parseInt(tNum, 10) === num)
                );
            });
            if (item) {
                item.status = 'confirmed';
                item.confirmedAt = new Date().toISOString();
                updated = item;
            }
        }

        if (!updated) {
            return errorResponse(res, 404, 'Appointment record not found.');
        }

        return successResponse(res, 200, 'Appointment confirmed successfully', updated);
    } catch (error) {
        next(error);
    }
};

// PATCH /api/appointments/:id/cancel
const cancelAppointment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { reason } = req.body || {};
        let updated = null;

        const updatePayload = {
            status: 'cancelled',
            cancelledAt: new Date(),
            cancellationReason: reason || 'Patient Request'
        };

        const rawId = (id || '').trim();
        const cleanId = rawId.replace(/^[#\s]+/, '').replace(/^token\s*#?/i, '').trim();
        const num = parseInt(cleanId, 10);
        const pad3 = !isNaN(num) ? String(num).padStart(3, '0') : cleanId;

        const findConditions = [
            { appointmentId: cleanId },
            { appointmentId: new RegExp(`^${cleanId}$`, 'i') },
            { tokenNumber: cleanId },
            { tokenNumber: pad3 },
            { tokenNumber: rawId }
        ];

        if (num && /^\d+$/.test(cleanId)) {
            findConditions.push({ tokenNumber: String(num) });
        }

        try {
            if (mongoose.Types.ObjectId.isValid(rawId)) {
                updated = await Appointment.findByIdAndUpdate(rawId, updatePayload, { new: true });
            }
            if (!updated) {
                updated = await Appointment.findOneAndUpdate(
                    { $or: findConditions },
                    updatePayload,
                    { new: true }
                );
            }
        } catch (e) {
            updated = null;
        }

        if (!updated) {
            const item = memoryAppointments.find(a => {
                const tNum = (a.tokenNumber || '').replace(/^[#\s]+/, '').trim();
                const aId = (a.appointmentId || '').toUpperCase().trim();
                return (
                    a._id === rawId ||
                    a.appointmentId === cleanId ||
                    aId === cleanId.toUpperCase() ||
                    a.tokenNumber === cleanId ||
                    a.tokenNumber === pad3 ||
                    tNum === cleanId ||
                    (num && parseInt(tNum, 10) === num)
                );
            });
            if (item) {
                item.status = 'cancelled';
                item.cancelledAt = new Date().toISOString();
                item.cancellationReason = reason || 'Patient Request';
                updated = item;
            }
        }

        if (!updated) {
            return errorResponse(res, 404, 'Appointment record not found.');
        }

        return successResponse(res, 200, 'Appointment cancelled successfully', updated);
    } catch (error) {
        next(error);
    }
};

// PATCH /api/appointments/:id/status
const updateAppointmentStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        const allowed = ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'];
        if (!allowed.includes(status)) {
            return errorResponse(res, 400, `Invalid status. Allowed statuses: ${allowed.join(', ')}`);
        }

        let updated;
        try {
            if (mongoose.Types.ObjectId.isValid(id)) {
                updated = await Appointment.findByIdAndUpdate(id, { status }, { new: true });
            }
            if (!updated) {
                updated = await Appointment.findOneAndUpdate({ appointmentId: id }, { status }, { new: true });
            }
        } catch (e) {
            const item = memoryAppointments.find(a => a._id === id || a.appointmentId === id);
            if (item) {
                item.status = status;
                updated = item;
            }
        }

        if (!updated) {
            return errorResponse(res, 404, 'Appointment record not found.');
        }

        return successResponse(res, 200, `Appointment status updated to ${status}`, updated);
    } catch (error) {
        next(error);
    }
};

// PATCH /api/appointments/:id/reschedule
const rescheduleAppointment = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { date, time } = req.body;

        if (!date || !time) {
            return errorResponse(res, 400, 'New date and time are required for rescheduling.');
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return errorResponse(res, 400, 'Valid date parameter (YYYY-MM-DD) is required.');
        }

        const rawId = (id || '').trim();
        const cleanId = rawId.replace(/^[#\s]+/, '').replace(/^token\s*#?/i, '').trim();
        const num = parseInt(cleanId, 10);
        const pad3 = !isNaN(num) ? String(num).padStart(3, '0') : cleanId;

        const findConditions = [
            { appointmentId: cleanId },
            { appointmentId: new RegExp(`^${cleanId}$`, 'i') },
            { tokenNumber: cleanId },
            { tokenNumber: pad3 },
            { tokenNumber: rawId }
        ];

        if (num && /^\d+$/.test(cleanId)) {
            findConditions.push({ tokenNumber: String(num) });
        }

        // Find existing appointment first
        let existingAppt = null;
        try {
            if (mongoose.Types.ObjectId.isValid(rawId)) {
                existingAppt = await Appointment.findById(rawId);
            }
            if (!existingAppt) {
                existingAppt = await Appointment.findOne({ $or: findConditions });
            }
        } catch (e) {
            existingAppt = null;
        }

        if (!existingAppt) {
            existingAppt = memoryAppointments.find(a => {
                const tNum = (a.tokenNumber || '').replace(/^[#\s]+/, '').trim();
                const aId = (a.appointmentId || '').toUpperCase().trim();
                return (
                    a._id === rawId ||
                    a.appointmentId === cleanId ||
                    aId === cleanId.toUpperCase() ||
                    a.tokenNumber === cleanId ||
                    a.tokenNumber === pad3 ||
                    tNum === cleanId ||
                    (num && parseInt(tNum, 10) === num)
                );
            });
        }

        if (!existingAppt) {
            return errorResponse(res, 404, 'Appointment record not found.');
        }

        // Check slot availability for new date and time
        const normTime = time.trim().replace(/^0/, '');
        const targetDate = new Date(`${date}T00:00:00`);

        // 1. Sunday check
        if (targetDate.getDay() === 0) {
            return errorResponse(res, 400, 'Selected time slot is not available. Please choose another slot.');
        }

        // 2. Off-day check
        try {
            const offDay = await OffDay.findOne({ date });
            if (offDay) {
                return errorResponse(res, 400, 'Selected time slot is not available. Please choose another slot.');
            }
        } catch (e) {}

        // 3. Blocked slot check
        try {
            const blocked = await BlockedSlot.find({ date });
            const isBlocked = blocked.some(b => (b.time || '').trim().replace(/^0/, '') === normTime);
            if (isBlocked) {
                return errorResponse(res, 400, 'Selected time slot is not available. Please choose another slot.');
            }
        } catch (e) {}

        // 4. Double booking collision check (exclude current appointment being rescheduled)
        try {
            const apptQuery = {
                clinic: existingAppt.clinic || 'Stay Young Clinic',
                date,
                status: { $nin: ['cancelled', 'Cancelled'] }
            };

            if (existingAppt._id && mongoose.Types.ObjectId.isValid(existingAppt._id)) {
                apptQuery._id = { $ne: existingAppt._id };
            } else if (existingAppt.appointmentId) {
                apptQuery.appointmentId = { $ne: existingAppt.appointmentId };
            }

            const bookedAppts = await Appointment.find(apptQuery);
            const isBooked = bookedAppts.some(a => (a.time || '').trim().replace(/^0/, '') === normTime);
            if (isBooked) {
                return errorResponse(res, 400, 'Selected time slot is not available. Please choose another slot.');
            }
        } catch (e) {
            // Check memory store for collisions
            const memCollision = memoryAppointments.some(a =>
                a.date === date &&
                (a.time || '').trim().replace(/^0/, '') === normTime &&
                a.status !== 'cancelled' &&
                a.appointmentId !== existingAppt.appointmentId
            );
            if (memCollision) {
                return errorResponse(res, 400, 'Selected time slot is not available. Please choose another slot.');
            }
        }

        // Apply update to appointment
        const updateData = {
            date,
            time,
            status: 'confirmed',
            rescheduledAt: new Date()
        };

        let updated = null;
        try {
            if (existingAppt._id && mongoose.Types.ObjectId.isValid(existingAppt._id)) {
                updated = await Appointment.findByIdAndUpdate(existingAppt._id, updateData, { new: true });
            }
            if (!updated && existingAppt.appointmentId) {
                updated = await Appointment.findOneAndUpdate(
                    { appointmentId: existingAppt.appointmentId },
                    updateData,
                    { new: true }
                );
            }
        } catch (e) {
            updated = null;
        }

        if (!updated) {
            // Update in memory fallback
            existingAppt.date = date;
            existingAppt.time = time;
            existingAppt.status = 'confirmed';
            existingAppt.rescheduledAt = new Date().toISOString();
            updated = existingAppt;
        }

        return successResponse(res, 200, 'Appointment rescheduled successfully', updated);
    } catch (error) {
        next(error);
    }
};

module.exports = {
    getAvailableSlots,
    createAppointment,
    getAppointments,
    searchAppointments,
    confirmAppointment,
    cancelAppointment,
    updateAppointmentStatus,
    rescheduleAppointment,
    memoryAppointments
};

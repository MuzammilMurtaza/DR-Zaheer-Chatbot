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
        const { query } = req.query;
        if (!query) {
            return errorResponse(res, 400, 'Search query parameter is required.');
        }

        const trimmed = query.trim();
        let results = [];
        try {
            results = await Appointment.find({
                $or: [
                    { phone: trimmed },
                    { tokenNumber: trimmed },
                    { appointmentId: trimmed }
                ]
            }).sort({ createdAt: -1 });
        } catch (e) {
            results = memoryAppointments.filter(a =>
                a.phone === trimmed || a.tokenNumber === trimmed || a.appointmentId === trimmed
            );
        }

        return successResponse(res, 200, 'Search complete', results);
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
            updated = await Appointment.findByIdAndUpdate(id, { status }, { new: true });
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

        let updated;
        try {
            updated = await Appointment.findByIdAndUpdate(id, { date, time, status: 'confirmed' }, { new: true });
        } catch (e) {
            const item = memoryAppointments.find(a => a._id === id || a.appointmentId === id);
            if (item) {
                item.date = date;
                item.time = time;
                item.status = 'confirmed';
                updated = item;
            }
        }

        if (!updated) {
            return errorResponse(res, 404, 'Appointment record not found.');
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
    updateAppointmentStatus,
    rescheduleAppointment,
    memoryAppointments
};

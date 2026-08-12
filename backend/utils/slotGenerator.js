/**
 * Dynamic Slot Generator for Dr. Muhammad Zaheer Anjum Clinic
 * Hours: Monday - Saturday 12:00 PM - 7:30 PM (Sundays Closed)
 */

const { getDBStatus } = require('../config/database');

const DEFAULT_SLOTS = [
    "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM",
    "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM",
    "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
    "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM"
];

const generateSlotsForDate = async ({
    dateStr,
    AppointmentModel,
    OffDayModel,
    BlockedSlotModel,
    SpecialScheduleModel,
    ClinicModel
}) => {
    const targetDate = new Date(`${dateStr}T00:00:00`);
    const dayOfWeek = targetDate.getDay(); // 0 is Sunday

    // Sunday Check
    if (dayOfWeek === 0) {
        return {
            available: false,
            reason: "Clinic is closed on Sundays",
            slots: []
        };
    }

    const isDBActive = getDBStatus();

    // Check Off-Days
    if (isDBActive && OffDayModel && typeof OffDayModel.findOne === 'function') {
        try {
            const offDay = await OffDayModel.findOne({ date: dateStr });
            if (offDay) {
                return {
                    available: false,
                    reason: `Doctor is on leave: ${offDay.reason || 'Off-day'}`,
                    slots: []
                };
            }
        } catch (e) {}
    }

    let candidateSlots = [...DEFAULT_SLOTS];

    // Check Special Schedule override
    if (isDBActive && SpecialScheduleModel && typeof SpecialScheduleModel.findOne === 'function') {
        try {
            const special = await SpecialScheduleModel.findOne({ date: dateStr });
            if (special && special.slots && special.slots.length > 0) {
                candidateSlots = special.slots;
            }
        } catch (e) {}
    }

    // Filter out blocked slots for this date
    let blockedTimes = [];
    if (isDBActive && BlockedSlotModel && typeof BlockedSlotModel.find === 'function') {
        try {
            const blocked = await BlockedSlotModel.find({ date: dateStr });
            blockedTimes = blocked.map(b => b.time);
        } catch (e) {}
    }

    // Filter out already booked appointments for this date
    let bookedTimes = [];
    if (isDBActive && AppointmentModel && typeof AppointmentModel.find === 'function') {
        try {
            const booked = await AppointmentModel.find({
                date: dateStr,
                status: { $nin: ['cancelled'] }
            });
            bookedTimes = booked.map(a => a.time);
        } catch (e) {}
    }

    const availableSlots = candidateSlots.filter(
        slot => !blockedTimes.includes(slot) && !bookedTimes.includes(slot)
    );

    return {
        available: availableSlots.length > 0,
        reason: availableSlots.length > 0 ? "Available" : "All slots booked for this date",
        slots: availableSlots
    };
};

module.exports = { generateSlotsForDate, DEFAULT_SLOTS };

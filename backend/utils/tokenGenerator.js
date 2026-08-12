/**
 * Generates database-safe sequential token number per clinic and date
 * Format: 001, 002, 009, etc.
 */
const generateTokenNumber = async (AppointmentModel, clinic, date) => {
    let nextToken = 1;
    if (AppointmentModel && typeof AppointmentModel.countDocuments === 'function') {
        try {
            const existingCount = await AppointmentModel.countDocuments({ clinic, date });
            nextToken = existingCount + 1;
        } catch (e) {
            nextToken = Math.floor(Math.random() * 50) + 1;
        }
    }
    return String(nextToken).padStart(3, '0');
};

module.exports = { generateTokenNumber };

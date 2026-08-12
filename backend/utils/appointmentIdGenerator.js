/**
 * Generates unique formatted appointment ID
 * Format: MZA-2026-1001
 */
const generateAppointmentId = async (AppointmentModel) => {
    const year = new Date().getFullYear();
    let count = 1000;
    
    if (AppointmentModel && typeof AppointmentModel.countDocuments === 'function') {
        try {
            const total = await AppointmentModel.countDocuments();
            count += total + 1;
        } catch (e) {
            count += Math.floor(Math.random() * 8999) + 1;
        }
    } else {
        count += Math.floor(Math.random() * 8999) + 1;
    }

    return `MZA-${year}-${count}`;
};

module.exports = { generateAppointmentId };

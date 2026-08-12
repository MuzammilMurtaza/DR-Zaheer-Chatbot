const mongoose = require('mongoose');

const clinicSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        default: 'Stay Young Clinic'
    },
    city: {
        type: String,
        default: 'Lahore'
    },
    address: {
        type: String,
        default: '684 Shadman Main Road, Shadman 1, opposite Fatima Memorial Hospital, Lahore'
    },
    phone: {
        type: String,
        default: '+92 321 3733332'
    },
    active: {
        type: Boolean,
        default: true
    },
    timezone: {
        type: String,
        default: 'Asia/Karachi'
    },
    weeklySchedule: {
        monday: { active: { type: Boolean, default: true }, open: { type: String, default: '12:00 PM' }, close: { type: String, default: '7:30 PM' } },
        tuesday: { active: { type: Boolean, default: true }, open: { type: String, default: '12:00 PM' }, close: { type: String, default: '7:30 PM' } },
        wednesday: { active: { type: Boolean, default: true }, open: { type: String, default: '12:00 PM' }, close: { type: String, default: '7:30 PM' } },
        thursday: { active: { type: Boolean, default: true }, open: { type: String, default: '12:00 PM' }, close: { type: String, default: '7:30 PM' } },
        friday: { active: { type: Boolean, default: true }, open: { type: String, default: '12:00 PM' }, close: { type: String, default: '7:30 PM' } },
        saturday: { active: { type: Boolean, default: true }, open: { type: String, default: '12:00 PM' }, close: { type: String, default: '7:30 PM' } },
        sunday: { active: { type: Boolean, default: false }, open: { type: String, default: '12:00 PM' }, close: { type: String, default: '7:30 PM' } }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Clinic', clinicSchema);

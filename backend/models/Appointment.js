const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    appointmentId: {
        type: String,
        required: true,
        unique: true
    },
    tokenNumber: {
        type: String,
        required: true
    },
    patient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Patient'
    },
    patientName: {
        type: String,
        required: true,
        trim: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    appointmentType: {
        type: String,
        enum: ['In-Person Appointment', 'Online Appointment'],
        default: 'In-Person Appointment'
    },
    clinic: {
        type: String,
        default: 'Stay Young Clinic'
    },
    city: {
        type: String,
        default: 'Lahore'
    },
    date: {
        type: String, // Format: YYYY-MM-DD
        required: true
    },
    time: {
        type: String, // Format: 12:00 PM
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'cancelled', 'no-show'],
        default: 'confirmed'
    },
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Index to prevent duplicate active bookings for same clinic, date, time
appointmentSchema.index({ clinic: 1, date: 1, time: 1, status: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);

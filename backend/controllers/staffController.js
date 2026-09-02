const mongoose = require('mongoose');
const StaffMessage = require('../models/StaffMessage');
const EmergencyAlert = require('../models/EmergencyAlert');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const OffDay = require('../models/OffDay');
const BlockedSlot = require('../models/BlockedSlot');
const SpecialSchedule = require('../models/SpecialSchedule');
const Clinic = require('../models/Clinic');
const { generateAppointmentId } = require('../utils/appointmentIdGenerator');
const { generateTokenNumber } = require('../utils/tokenGenerator');
const { generateSlotsForDate } = require('../utils/slotGenerator');
const { successResponse, errorResponse } = require('../utils/response');

let memoryStaffMessages = [];
let memoryEmergencyAlerts = [];

const isDBConnected = () => {
    return mongoose.connection && mongoose.connection.readyState === 1;
};

const generateMessageId = () => {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
};

const getNextSequence = (conversation) => {
    if (!conversation || !Array.isArray(conversation.messages) || conversation.messages.length === 0) {
        return 1;
    }
    const maxSeq = conversation.messages.reduce((max, m) => Math.max(max, m.sequence || 0), 0);
    return maxSeq + 1;
};

function getAvailableDates(count = 5) {
    const dates = [];
    let d = new Date();
    while (dates.length < count) {
        d.setDate(d.getDate() + 1);
        const day = d.getDay(); // 0 is Sunday
        if (day !== 0) { // Mon - Sat
            const formatted = d.toLocaleDateString('en-GB', {
                weekday: 'short',
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
            const iso = d.toISOString().split('T')[0];
            dates.push({ label: formatted, value: iso, action: 'select_date' });
        }
    }
    return dates;
}

const AVAILABLE_SLOTS = [
    { label: '12:30 PM', value: '12:30 PM', action: 'select_slot' },
    { label: '01:30 PM', value: '01:30 PM', action: 'select_slot' },
    { label: '03:00 PM', value: '03:00 PM', action: 'select_slot' },
    { label: '04:30 PM', value: '04:30 PM', action: 'select_slot' },
    { label: '06:00 PM', value: '06:00 PM', action: 'select_slot' },
    { label: '07:00 PM', value: '07:00 PM', action: 'select_slot' }
];

// Ensure all messages in a conversation have stable sequence & messageId
const normalizeConversationMessages = (conversation) => {
    if (!conversation || !Array.isArray(conversation.messages)) return;
    let seq = 1;
    conversation.messages.forEach(m => {
        if (!m.messageId) {
            m.messageId = generateMessageId();
        }
        if (!m.sequence || m.sequence < 1) {
            m.sequence = seq;
        }
        if (!m.contentType) {
            m.contentType = 'TEXT';
        }
        seq = (m.sequence || seq) + 1;
    });
};

// Helper: Generate Contextual AI response for Dr. Muhammad Zaheer Anjum Clinic
function generateClinicAIResponse(message, language = 'english') {
    const text = (message || '').toLowerCase();
    const isUrdu = language === 'urdu' || /[\u0600-\u06FF]/.test(message);

    if (isUrdu) {
        if (text.includes('ٹائمنگ') || text.includes('وقت') || text.includes('timing') || text.includes('time') || text.includes('hours') || text.includes('open')) {
            return 'ڈاکٹر محمد ظہیر انجم کا کلینک (Stay Young Clinic, Lahore) پیر سے ہفتہ، دوپہر 12:00 بجے سے شام 7:30 بجے تک کھلا رہتا ہے۔ اتوار کو کلینک بند ہوتا ہے۔';
        }
        if (text.includes('ایڈریس') || text.includes('کہاں') || text.includes('پتہ') || text.includes('لوکیشن') || text.includes('address') || text.includes('location')) {
            return 'کلینک کا پتہ: 684 شادمان مین روڈ، شادمان 1، بالمقابل فاطمہ میموریل ہسپتال، لاہور۔ آپ ڈائریکشنز حاصل کرنے کے لیے مین مینو میں لوکیشن بٹن بھی استعمال کر سکتے ہیں۔';
        }
        if (text.includes('علاج') || text.includes('درد') || text.includes('prp') || text.includes('pain') || text.includes('treatment')) {
            return 'ڈاکٹر محمد ظہیر انجم درد کے علاج (Pain Management) اور ری جنریٹو میڈیسن (PRP، پرولوتھراپی، گھٹنے اور جوڑوں کا درد، کمر درد اور مہروں کے مسائل) کے ماہر ہیں۔ آپ اپائنٹمنٹ بک کرنے کے لیے "Book Appointment" کا آپشن منتخب کر سکتے ہیں۔';
        }
        if (text.includes('فیس') || text.includes('fee') || text.includes('charges')) {
            return 'کنسلٹیشن فیس اور علاج کے پیکجز کی تفصیلی معلومات کے لیے آپ کلینک نمبر +923213733332 پر رابطہ کر سکتے ہیں یا "Book Appointment" کے ذریعے بکنگ کر سکتے ہیں۔';
        }
        if (text.includes('رابطہ') || text.includes('فون') || text.includes('نمبر') || text.includes('phone') || text.includes('contact')) {
            return 'آپ کلینک سے فون نمبر +92 321 3733332 پر رابطہ کر سکتے ہیں۔';
        }
        return 'محترم مریض، آپ کا پیغام موصول ہوا ہے۔ میں ڈاکٹر محمد ظہیر انجم کا اے آئی اسسٹنٹ ہوں۔ آپ اپائنٹمنٹ بکنگ، علاج کی معلومات، یا رپورٹ اپلوڈ کے لیے مینو کے بٹنز استعمال کر سکتے ہیں یا اپنا سوال پوچھ سکتے ہیں۔';
    }

    // English responses
    if (text.includes('timing') || text.includes('time') || text.includes('hours') || text.includes('open') || text.includes('schedule')) {
        return 'Dr. Muhammad Zaheer Anjum Clinic (Stay Young Clinic, Lahore) is open Monday to Saturday from 12:00 PM to 7:30 PM. Sunday is an off day.';
    }
    if (text.includes('address') || text.includes('location') || text.includes('where') || text.includes('map') || text.includes('directions')) {
        return 'The clinic is located at: 684 Shadman Main Road, Shadman 1, opposite Fatima Memorial Hospital, Lahore. You can also tap the "📍 Directions" button above for Google Maps guidance.';
    }
    if (text.includes('treatment') || text.includes('pain') || text.includes('prp') || text.includes('prolotherapy') || text.includes('knee') || text.includes('back') || text.includes('spine') || text.includes('joint')) {
        return 'Dr. Muhammad Zaheer Anjum specializes in Interventional Pain Management and Regenerative Medicine (PRP Therapy, Prolotherapy, Sciatica, Chronic Knee, Back & Neck Pain, Arthritis, and Aesthetic Wellness). You can proceed to "Book Appointment" to secure a consultation.';
    }
    if (text.includes('fee') || text.includes('cost') || text.includes('charges') || text.includes('price')) {
        return 'For consultation fee details and specialized treatment procedures, please use the appointment booking feature or call the clinic directly at +92 321 3733332.';
    }
    if (text.includes('phone') || text.includes('contact') || text.includes('call') || text.includes('helpline')) {
        return 'You can contact Dr. Muhammad Zaheer Anjum\'s clinic at +92 321 3733332 during operational hours (Mon–Sat, 12:00 PM – 7:30 PM).';
    }
    if (text.includes('report') || text.includes('mri') || text.includes('x-ray') || text.includes('upload')) {
        return 'You can securely submit your MRI, X-Ray, and medical reports by clicking "📎 Upload Reports" or using the attachment button below.';
    }
    if (text.includes('doctor') || text.includes('qualification') || text.includes('profile') || text.includes('specialist')) {
        return 'Dr. Muhammad Zaheer Anjum is a distinguished specialist in Pain Management & Regenerative Medicine with over 15 years of clinical expertise treating spine, joint, nerve, and chronic pain disorders.';
    }
    return 'Thank you for reaching out to Dr. Muhammad Zaheer Anjum Clinic Assistant. How can I assist you today? You can ask about our clinic timings, location, pain management treatments, or book an appointment.';
}

// POST /api/staff/chat/message (Patient sends chat message or selects option)
const handlePatientMessage = async (req, res, next) => {
    try {
        const { sessionId, patientName, phone, message, language, clientMessageId, payload, workflowAction } = req.body;
        if (!message || !message.trim()) {
            return errorResponse(res, 400, 'Message content is required.');
        }

        const sid = sessionId || `session_${phone || 'guest'}_${Date.now()}`;
        const pName = (patientName || 'Patient').trim();
        const pPhone = (phone || '').trim();
        const cleanMsg = message.trim();
        const cleanPayload = (payload || '').trim();
        const msgId = clientMessageId || generateMessageId();

        let conversation = null;

        // Find existing conversation by sessionId first, then phone fallback
        if (isDBConnected()) {
            try {
                if (sid) {
                    conversation = await StaffMessage.findOne({ sessionId: sid });
                }
                if (!conversation && pPhone) {
                    conversation = await StaffMessage.findOne({ phone: pPhone }).sort({ updatedAt: -1 });
                    if (conversation && sid) {
                        conversation.sessionId = sid;
                    }
                }
            } catch (e) {
                conversation = null;
            }
        }

        if (!conversation) {
            if (sid) conversation = memoryStaffMessages.find(m => m.sessionId === sid);
            if (!conversation && pPhone) {
                conversation = memoryStaffMessages.find(m => m.phone === pPhone);
                if (conversation && sid) conversation.sessionId = sid;
            }
        }

        if (!conversation) {
            // New conversation starts in default AI mode
            const initData = {
                sessionId: sid,
                patientName: pName,
                phone: pPhone || 'Not provided',
                message: cleanMsg,
                mode: 'AI',
                activeWorkflow: null,
                workflowStep: null,
                workflowData: {},
                status: 'pending',
                messages: [],
                lastMessage: cleanMsg,
                lastSender: 'PATIENT',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (isDBConnected()) {
                try {
                    conversation = await StaffMessage.create(initData);
                } catch (e) {
                    conversation = { ...initData, _id: `stf_${Date.now()}` };
                    memoryStaffMessages.unshift(conversation);
                }
            } else {
                conversation = { ...initData, _id: `stf_${Date.now()}` };
                memoryStaffMessages.unshift(conversation);
            }
        }

        normalizeConversationMessages(conversation);

        // Idempotency check
        const alreadyExists = Array.isArray(conversation.messages) && conversation.messages.some(m => m.messageId === msgId);
        if (alreadyExists) {
            const maxSeq = conversation.messages.reduce((max, m) => Math.max(max, m.sequence || 0), 0);
            return successResponse(res, 200, 'Message already processed', {
                mode: conversation.mode,
                activeWorkflow: conversation.activeWorkflow,
                workflowStep: conversation.workflowStep,
                aiResponded: false,
                reply: null,
                sessionId: conversation.sessionId || sid,
                conversationId: conversation._id,
                manualTakenBy: conversation.manualTakenBy || 'Dr. Muhammad Zaheer Anjum',
                messages: conversation.messages,
                lastSequence: maxSeq
            });
        }

        // Save patient message with sequence N
        const patientSeq = getNextSequence(conversation);
        const patientMsgItem = {
            messageId: msgId,
            sequence: patientSeq,
            sender: 'PATIENT',
            senderName: pName,
            contentType: 'TEXT',
            text: cleanMsg,
            timestamp: new Date()
        };

        if (Array.isArray(conversation.messages)) {
            conversation.messages.push(patientMsgItem);
        } else {
            conversation.messages = [patientMsgItem];
        }

        conversation.lastMessage = cleanMsg;
        conversation.lastSender = 'PATIENT';
        if (pName && conversation.patientName === 'Patient') conversation.patientName = pName;
        if (pPhone && (!conversation.phone || conversation.phone === 'Not provided')) conversation.phone = pPhone;

        // If in MANUAL mode, stop AI responses
        if (conversation.mode === 'MANUAL') {
            if (isDBConnected() && typeof conversation.save === 'function') {
                try { await conversation.save(); } catch (e) {}
            } else {
                conversation.updatedAt = new Date().toISOString();
            }

            return successResponse(res, 200, 'Message sent. Manual mode is active.', {
                mode: 'MANUAL',
                activeWorkflow: conversation.activeWorkflow,
                workflowStep: conversation.workflowStep,
                aiResponded: false,
                reply: null,
                sessionId: conversation.sessionId || sid,
                conversationId: conversation._id,
                manualTakenBy: conversation.manualTakenBy || 'Dr. Muhammad Zaheer Anjum',
                messages: conversation.messages,
                newMessage: patientMsgItem,
                lastSequence: patientSeq
            });
        }

        // =========================================================================
        // WORKFLOW ENGINE & GUIDED STATE MACHINE
        // =========================================================================
        const lowerMsg = cleanMsg.toLowerCase();
        let aiMsgItem = null;
        const aiSeq = patientSeq + 1;

        if (!conversation.workflowData) conversation.workflowData = {};

        // Cancel / Reset trigger
        if (lowerMsg === 'cancel' || lowerMsg === 'reset' || lowerMsg === 'start over') {
            conversation.activeWorkflow = null;
            conversation.workflowStep = null;
            conversation.workflowData = {};
            aiMsgItem = {
                messageId: generateMessageId(),
                sequence: aiSeq,
                sender: 'AI',
                senderName: 'Dr. Zaheer AI Assistant',
                contentType: 'TEXT',
                text: 'The booking process has been reset. How else can I assist you today?',
                timestamp: new Date()
            };
        }
        // Start Appointment Workflow triggers
        else if (cleanPayload === 'BOOK_APPOINTMENT' || lowerMsg.includes('book appointment') || (lowerMsg.includes('appointment') && !conversation.activeWorkflow)) {
            conversation.activeWorkflow = 'APPOINTMENT';
            conversation.workflowStep = 'AWAITING_NAME';
            conversation.workflowData = { consultationType: 'In-Person Consultation' };
            aiMsgItem = {
                messageId: generateMessageId(),
                sequence: aiSeq,
                sender: 'AI',
                senderName: 'Dr. Zaheer AI Assistant',
                contentType: 'TEXT',
                text: 'Welcome to Dr. Muhammad Zaheer Anjum Clinic Appointment Booking. Please enter the patient\'s full name:',
                workflow: 'APPOINTMENT',
                workflowStep: 'AWAITING_NAME',
                timestamp: new Date()
            };
        }
        // Start Online Consultation Workflow trigger
        else if (cleanPayload === 'START_CONSULTATION' || lowerMsg.includes('online consultation') || lowerMsg.includes('video consultation')) {
            conversation.activeWorkflow = 'APPOINTMENT';
            conversation.workflowStep = 'AWAITING_NAME';
            conversation.workflowData = { consultationType: 'Online Video Consultation' };
            aiMsgItem = {
                messageId: generateMessageId(),
                sequence: aiSeq,
                sender: 'AI',
                senderName: 'Dr. Zaheer AI Assistant',
                contentType: 'TEXT',
                text: 'Please enter the patient\'s full name for Online Consultation booking:',
                workflow: 'APPOINTMENT',
                workflowStep: 'AWAITING_NAME',
                timestamp: new Date()
            };
        }
        // Guided Flow Step 1: AWAITING_NAME
        else if (conversation.activeWorkflow === 'APPOINTMENT' && conversation.workflowStep === 'AWAITING_NAME') {
            conversation.workflowData.patientName = cleanMsg;
            conversation.patientName = cleanMsg;
            conversation.workflowStep = 'AWAITING_PHONE';
            aiMsgItem = {
                messageId: generateMessageId(),
                sequence: aiSeq,
                sender: 'AI',
                senderName: 'Dr. Zaheer AI Assistant',
                contentType: 'TEXT',
                text: `Thank you, ${cleanMsg}. Please enter your contact phone number (e.g., 03001234567):`,
                workflow: 'APPOINTMENT',
                workflowStep: 'AWAITING_PHONE',
                timestamp: new Date()
            };
        }
        // Guided Flow Step 2: AWAITING_PHONE
        else if (conversation.activeWorkflow === 'APPOINTMENT' && conversation.workflowStep === 'AWAITING_PHONE') {
            conversation.workflowData.phone = cleanMsg;
            conversation.phone = cleanMsg;

            if (conversation.workflowData.consultationType === 'Online Video Consultation') {
                conversation.workflowData.city = 'Online Video Portal';
                conversation.workflowStep = 'AWAITING_DATE';
                aiMsgItem = {
                    messageId: generateMessageId(),
                    sequence: aiSeq,
                    sender: 'AI',
                    senderName: 'Dr. Zaheer AI Assistant',
                    contentType: 'DATE_SELECTION',
                    text: 'Please select an appointment date for Online Consultation:',
                    options: getAvailableDates(),
                    workflow: 'APPOINTMENT',
                    workflowStep: 'AWAITING_DATE',
                    timestamp: new Date()
                };
            } else {
                conversation.workflowStep = 'AWAITING_TYPE';
                aiMsgItem = {
                    messageId: generateMessageId(),
                    sequence: aiSeq,
                    sender: 'AI',
                    senderName: 'Dr. Zaheer AI Assistant',
                    contentType: 'OPTIONS',
                    text: 'Please select consultation type:',
                    options: [
                        { label: '🏥 In-Person Clinic Visit', value: 'IN_PERSON', action: 'select_type' },
                        { label: '💻 Online Video Consultation', value: 'ONLINE', action: 'select_type' }
                    ],
                    workflow: 'APPOINTMENT',
                    workflowStep: 'AWAITING_TYPE',
                    timestamp: new Date()
                };
            }
        }
        // Guided Flow Step 3: AWAITING_TYPE
        else if (conversation.activeWorkflow === 'APPOINTMENT' && conversation.workflowStep === 'AWAITING_TYPE') {
            if (cleanPayload === 'ONLINE' || lowerMsg.includes('online')) {
                conversation.workflowData.consultationType = 'Online Video Consultation';
                conversation.workflowData.city = 'Online Video Portal';
                conversation.workflowStep = 'AWAITING_DATE';
                aiMsgItem = {
                    messageId: generateMessageId(),
                    sequence: aiSeq,
                    sender: 'AI',
                    senderName: 'Dr. Zaheer AI Assistant',
                    contentType: 'DATE_SELECTION',
                    text: 'Please select an appointment date for Online Consultation:',
                    options: getAvailableDates(),
                    workflow: 'APPOINTMENT',
                    workflowStep: 'AWAITING_DATE',
                    timestamp: new Date()
                };
            } else {
                conversation.workflowData.consultationType = 'In-Person Appointment';
                conversation.workflowStep = 'AWAITING_CITY';
                aiMsgItem = {
                    messageId: generateMessageId(),
                    sequence: aiSeq,
                    sender: 'AI',
                    senderName: 'Dr. Zaheer AI Assistant',
                    contentType: 'OPTIONS',
                    text: 'Please select your preferred city / clinic location:',
                    options: [
                        { label: '📍 Stay Young Clinic, Shadman, Lahore', value: 'Lahore', action: 'select_city' }
                    ],
                    workflow: 'APPOINTMENT',
                    workflowStep: 'AWAITING_CITY',
                    timestamp: new Date()
                };
            }
        }
        // Guided Flow Step 4: AWAITING_CITY
        else if (conversation.activeWorkflow === 'APPOINTMENT' && conversation.workflowStep === 'AWAITING_CITY') {
            conversation.workflowData.city = cleanMsg || 'Stay Young Clinic, Shadman, Lahore';
            conversation.workflowStep = 'AWAITING_DATE';
            aiMsgItem = {
                messageId: generateMessageId(),
                sequence: aiSeq,
                sender: 'AI',
                senderName: 'Dr. Zaheer AI Assistant',
                contentType: 'DATE_SELECTION',
                text: 'Please select an appointment date:',
                options: getAvailableDates(),
                workflow: 'APPOINTMENT',
                workflowStep: 'AWAITING_DATE',
                timestamp: new Date()
            };
        }
        // Guided Flow Step 5: AWAITING_DATE
        else if (conversation.activeWorkflow === 'APPOINTMENT' && conversation.workflowStep === 'AWAITING_DATE') {
            const rawDateVal = cleanPayload && /^\d{4}-\d{2}-\d{2}$/.test(cleanPayload) ? cleanPayload : cleanMsg;
            conversation.workflowData.date = rawDateVal;
            conversation.workflowData.dateLabel = cleanMsg;
            conversation.workflowStep = 'AWAITING_SLOT';

            // Generate real available slots for this date
            let slotOptions = AVAILABLE_SLOTS;
            try {
                const dateIso = /^\d{4}-\d{2}-\d{2}$/.test(rawDateVal) ? rawDateVal : new Date().toISOString().split('T')[0];
                const genResult = await generateSlotsForDate({
                    dateStr: dateIso,
                    AppointmentModel: Appointment,
                    OffDayModel: OffDay,
                    BlockedSlotModel: BlockedSlot,
                    SpecialScheduleModel: SpecialSchedule,
                    ClinicModel: Clinic
                });
                if (genResult && Array.isArray(genResult.slots) && genResult.slots.length > 0) {
                    slotOptions = genResult.slots.map(s => ({ label: s, value: s, action: 'select_slot' }));
                }
            } catch (e) {}

            aiMsgItem = {
                messageId: generateMessageId(),
                sequence: aiSeq,
                sender: 'AI',
                senderName: 'Dr. Zaheer AI Assistant',
                contentType: 'TIME_SLOT_SELECTION',
                text: `Please select an available time slot for ${cleanMsg}:`,
                options: slotOptions,
                workflow: 'APPOINTMENT',
                workflowStep: 'AWAITING_SLOT',
                timestamp: new Date()
            };
        }
        // Guided Flow Step 6: AWAITING_SLOT (FINAL BOOKING STEP)
        else if (conversation.activeWorkflow === 'APPOINTMENT' && conversation.workflowStep === 'AWAITING_SLOT') {
            const selectedTimeSlot = cleanPayload || cleanMsg;
            conversation.workflowData.timeSlot = selectedTimeSlot;

            const bPhone = (conversation.workflowData.phone || conversation.phone || phone || '').trim();
            const bName = (conversation.workflowData.patientName || conversation.patientName || patientName || 'Patient').trim();
            const bType = conversation.workflowData.consultationType === 'Online Video Consultation' || conversation.workflowData.consultationType === 'Online Appointment'
                ? 'Online Appointment'
                : 'In-Person Appointment';
            const bClinic = 'Stay Young Clinic';
            const bCity = conversation.workflowData.city || 'Lahore';
            let bDate = conversation.workflowData.date || new Date().toISOString().split('T')[0];
            if (!/^\d{4}-\d{2}-\d{2}$/.test(bDate)) {
                const parsed = new Date(bDate);
                if (!isNaN(parsed.getTime())) {
                    bDate = parsed.toISOString().split('T')[0];
                } else {
                    bDate = new Date().toISOString().split('T')[0];
                }
            }

            // Real DB find-or-create Patient & Appointment with Idempotency protection
            let savedAppointment = null;
            let patientDoc = null;

            try {
                if (isDBConnected()) {
                    // 1. Idempotency check: see if this appointment was already created
                    savedAppointment = await Appointment.findOne({
                        phone: bPhone,
                        date: bDate,
                        time: selectedTimeSlot,
                        status: { $nin: ['cancelled'] }
                    });

                    // 2. Find or create Patient record
                    patientDoc = await Patient.findOne({ phone: bPhone });
                    if (!patientDoc) {
                        const patId = `PAT-${Date.now().toString().slice(-6)}`;
                        patientDoc = await Patient.create({
                            patientId: patId,
                            name: bName,
                            phone: bPhone
                        });
                    } else if (patientDoc.name !== bName && bName !== 'Patient') {
                        patientDoc.name = bName;
                        await patientDoc.save();
                    }

                    // 3. Create real Appointment document if not already existing
                    if (!savedAppointment) {
                        const apptId = await generateAppointmentId(Appointment);
                        const tokenNum = await generateTokenNumber(Appointment, bClinic, bDate);

                        savedAppointment = await Appointment.create({
                            appointmentId: apptId,
                            tokenNumber: tokenNum,
                            patient: patientDoc ? patientDoc._id : null,
                            patientName: bName,
                            phone: bPhone,
                            appointmentType: bType,
                            clinic: bClinic,
                            city: bCity,
                            date: bDate,
                            time: selectedTimeSlot,
                            status: 'confirmed',
                            notes: 'Booked via Clinic Assistant AI Chat'
                        });
                    }
                } else {
                    // In-memory fallback for dev
                    savedAppointment = {
                        appointmentId: `MZA-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
                        tokenNumber: '001',
                        patientName: bName,
                        phone: bPhone,
                        appointmentType: bType,
                        clinic: bClinic,
                        city: bCity,
                        date: bDate,
                        time: selectedTimeSlot,
                        status: 'confirmed'
                    };
                }
            } catch (dbErr) {
                console.error('[CRITICAL] Database error during Appointment creation:', dbErr);
                return errorResponse(res, 500, 'Database error booking appointment. Please try again.');
            }

            if (!savedAppointment) {
                return errorResponse(res, 500, 'Could not create appointment. Please try again.');
            }

            // Update conversation workflow data with real DB identifiers
            conversation.workflowData.appointmentId = savedAppointment.appointmentId;
            conversation.workflowData.tokenNumber = savedAppointment.tokenNumber;
            conversation.workflowData.date = savedAppointment.date;
            conversation.workflowData.timeSlot = savedAppointment.time;
            conversation.workflowData.patientName = savedAppointment.patientName;
            conversation.workflowData.phone = savedAppointment.phone;
            conversation.workflowData.consultationType = savedAppointment.appointmentType;
            conversation.workflowData.city = savedAppointment.city;

            conversation.activeWorkflow = null;
            conversation.workflowStep = 'CONFIRMED';

            aiMsgItem = {
                messageId: generateMessageId(),
                sequence: aiSeq,
                sender: 'AI',
                senderName: 'Dr. Zaheer AI Assistant',
                contentType: 'APPOINTMENT_CARD',
                text: `✅ Appointment Confirmed! Token #${savedAppointment.tokenNumber} (ID: ${savedAppointment.appointmentId}) booked for ${savedAppointment.patientName} on ${savedAppointment.date} at ${savedAppointment.time}.`,
                metadata: { bookingData: { ...conversation.workflowData } },
                workflow: 'APPOINTMENT',
                workflowStep: 'CONFIRMED',
                timestamp: new Date()
            };
        }
        // General AI Contextual Response (when no guided workflow is active)
        else {
            const aiReply = generateClinicAIResponse(cleanMsg, language);
            aiMsgItem = {
                messageId: generateMessageId(),
                sequence: aiSeq,
                sender: 'AI',
                senderName: 'Dr. Zaheer AI Assistant',
                contentType: 'TEXT',
                text: aiReply,
                timestamp: new Date()
            };
        }

        conversation.messages.push(aiMsgItem);
        conversation.lastMessage = aiMsgItem.text;
        conversation.lastSender = 'AI';
        conversation.updatedAt = new Date().toISOString();

        if (isDBConnected() && typeof conversation.save === 'function') {
            try { await conversation.save(); } catch (e) {}
        }

        return successResponse(res, 200, 'AI response generated', {
            mode: 'AI',
            activeWorkflow: conversation.activeWorkflow,
            workflowStep: conversation.workflowStep,
            aiResponded: true,
            reply: aiMsgItem.text,
            sessionId: conversation.sessionId || sid,
            conversationId: conversation._id,
            messages: conversation.messages,
            newMessage: aiMsgItem,
            lastSequence: aiSeq
        });
    } catch (error) {
        next(error);
    }
};

// GET /api/staff/chat/sync & GET /api/staff/chat/messages (Strictly Read-Only Cursor & History Polling)
const syncPatientChat = async (req, res, next) => {
    try {
        const { sessionId, phone, afterSequence, afterMessageId } = req.query;
        if (!sessionId && !phone) {
            return errorResponse(res, 400, 'Session ID or Phone number is required for chat synchronization.');
        }

        let conversation = null;
        if (isDBConnected()) {
            try {
                if (sessionId) {
                    conversation = await StaffMessage.findOne({ sessionId });
                }
                if (!conversation && phone) {
                    conversation = await StaffMessage.findOne({ phone }).sort({ updatedAt: -1 });
                }
            } catch (e) {
                conversation = null;
            }
        }

        if (!conversation) {
            if (sessionId) conversation = memoryStaffMessages.find(m => m.sessionId === sessionId);
            if (!conversation && phone) conversation = memoryStaffMessages.find(m => m.phone === phone);
        }

        if (!conversation) {
            return successResponse(res, 200, 'No active conversation found, default AI mode', {
                mode: 'AI',
                activeWorkflow: null,
                workflowStep: null,
                messages: [],
                lastSequence: 0,
                status: 'pending'
            });
        }

        normalizeConversationMessages(conversation);

        const allMessages = Array.isArray(conversation.messages) ? conversation.messages : [];
        const highestSequence = allMessages.reduce((max, m) => Math.max(max, m.sequence || 0), 0);

        let returnMessages = allMessages;

        if (afterSequence !== undefined && afterSequence !== null && afterSequence !== '') {
            const afterSeqNum = parseInt(afterSequence, 10);
            if (!isNaN(afterSeqNum)) {
                returnMessages = allMessages.filter(m => (m.sequence || 0) > afterSeqNum);
            }
        } else if (afterMessageId) {
            const idx = allMessages.findIndex(m => m.messageId === afterMessageId);
            if (idx >= 0) {
                returnMessages = allMessages.slice(idx + 1);
            }
        }

        return successResponse(res, 200, 'Chat synchronized', {
            mode: conversation.mode || 'AI',
            activeWorkflow: conversation.activeWorkflow || null,
            workflowStep: conversation.workflowStep || null,
            manualTakeoverAt: conversation.manualTakeoverAt,
            aiResumedAt: conversation.aiResumedAt,
            manualTakenBy: conversation.manualTakenBy,
            status: conversation.status,
            messages: returnMessages,
            lastSequence: highestSequence,
            totalCount: allMessages.length,
            conversationId: conversation._id,
            sessionId: conversation.sessionId
        });
    } catch (error) {
        next(error);
    }
};

// POST /api/staff/handover (Patient requests staff handover)
const requestHandover = async (req, res, next) => {
    try {
        const { patientName, phone, message, sessionId } = req.body;
        if (!patientName || !phone || !message) {
            return errorResponse(res, 400, 'Patient Name, Phone Number, and Message details are required for staff handover.');
        }

        const sid = sessionId || `session_${phone.trim()}_${Date.now()}`;
        const pName = patientName.trim();
        const pPhone = phone.trim();
        const pMsg = message.trim();

        let conversation = null;
        if (isDBConnected()) {
            try {
                if (sid) conversation = await StaffMessage.findOne({ sessionId: sid });
                if (!conversation && pPhone) conversation = await StaffMessage.findOne({ phone: pPhone }).sort({ updatedAt: -1 });
            } catch (e) {
                conversation = null;
            }
        }

        if (!conversation) {
            if (sid) conversation = memoryStaffMessages.find(m => m.sessionId === sid);
            if (!conversation && pPhone) conversation = memoryStaffMessages.find(m => m.phone === pPhone);
        }

        const seq = getNextSequence(conversation);
        const handoverMsgItem = {
            messageId: generateMessageId(),
            sequence: seq,
            sender: 'PATIENT',
            senderName: pName,
            contentType: 'TEXT',
            text: `[Handover Request] ${pMsg}`,
            timestamp: new Date()
        };

        if (conversation) {
            conversation.patientName = pName;
            conversation.phone = pPhone;
            conversation.message = pMsg;
            conversation.status = 'pending';
            if (Array.isArray(conversation.messages)) {
                conversation.messages.push(handoverMsgItem);
            } else {
                conversation.messages = [handoverMsgItem];
            }
            conversation.lastMessage = pMsg;
            conversation.lastSender = 'PATIENT';
            conversation.updatedAt = new Date().toISOString();
            if (isDBConnected() && typeof conversation.save === 'function') {
                try { await conversation.save(); } catch (e) {}
            }
        } else {
            const data = {
                sessionId: sid,
                patientName: pName,
                phone: pPhone,
                message: pMsg,
                mode: 'AI',
                status: 'pending',
                messages: [handoverMsgItem],
                lastMessage: pMsg,
                lastSender: 'PATIENT',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            if (isDBConnected()) {
                try {
                    conversation = await StaffMessage.create(data);
                } catch (e) {
                    conversation = { ...data, _id: `stf_${Date.now()}` };
                    memoryStaffMessages.unshift(conversation);
                }
            } else {
                conversation = { ...data, _id: `stf_${Date.now()}` };
                memoryStaffMessages.unshift(conversation);
            }
        }

        return successResponse(res, 201, 'Request transferred to clinic staff', conversation);
    } catch (error) {
        next(error);
    }
};

// GET /api/staff/inbox (Doctor/Admin retrieves all conversations)
const getStaffInbox = async (req, res, next) => {
    try {
        let list = [];
        if (isDBConnected()) {
            try {
                list = await StaffMessage.find().sort({ updatedAt: -1, createdAt: -1 });
            } catch (e) {
                list = memoryStaffMessages;
            }
        } else {
            list = memoryStaffMessages;
        }
        list.forEach(c => normalizeConversationMessages(c));
        return successResponse(res, 200, 'Staff inbox messages retrieved', list);
    } catch (error) {
        next(error);
    }
};

// GET /api/staff/inbox/:id (Retrieve single conversation details)
const getStaffConversation = async (req, res, next) => {
    try {
        const { id } = req.params;
        let conversation = null;

        if (isDBConnected()) {
            try {
                conversation = await StaffMessage.findById(id);
            } catch (e) {
                conversation = null;
            }
        }

        if (!conversation) {
            conversation = memoryStaffMessages.find(m => m._id === id || m.sessionId === id);
        }

        if (!conversation) {
            return errorResponse(res, 404, 'Conversation not found.');
        }

        normalizeConversationMessages(conversation);
        return successResponse(res, 200, 'Conversation retrieved', conversation);
    } catch (error) {
        next(error);
    }
};

// POST /api/staff/inbox/:id/takeover (Doctor activates Manual Mode)
const takeoverConversation = async (req, res, next) => {
    try {
        const { id } = req.params;
        const takenBy = (req.body && req.body.adminName) || (req.admin && req.admin.name) || 'Dr. Muhammad Zaheer Anjum';

        let conversation = null;
        if (isDBConnected()) {
            try {
                conversation = await StaffMessage.findById(id);
            } catch (e) {
                conversation = null;
            }
        }

        if (!conversation) {
            conversation = memoryStaffMessages.find(m => m._id === id || m.sessionId === id);
        }

        if (!conversation) {
            return errorResponse(res, 404, 'Conversation not found.');
        }

        if (conversation.mode === 'MANUAL') {
            return successResponse(res, 200, 'Manual Mode is already active for this patient.', conversation);
        }

        conversation.mode = 'MANUAL';
        conversation.manualTakeoverAt = new Date();
        conversation.manualTakenBy = takenBy;
        conversation.status = 'in-progress';

        const seq = getNextSequence(conversation);
        const takeoverNotice = {
            messageId: generateMessageId(),
            sequence: seq,
            sender: 'STAFF',
            senderName: 'System',
            contentType: 'SYSTEM_NOTICE',
            text: `${takenBy} has taken over the conversation manually. AI responses are paused.`,
            timestamp: new Date()
        };

        if (Array.isArray(conversation.messages)) {
            conversation.messages.push(takeoverNotice);
        } else {
            conversation.messages = [takeoverNotice];
        }
        conversation.updatedAt = new Date().toISOString();

        if (isDBConnected() && typeof conversation.save === 'function') {
            try { await conversation.save(); } catch (e) {}
        }

        return successResponse(res, 200, 'Manual Mode activated. AI responses stopped for this patient.', conversation);
    } catch (error) {
        next(error);
    }
};

// POST /api/staff/inbox/:id/return-ai (Doctor restores AI Mode)
const returnToAI = async (req, res, next) => {
    try {
        const { id } = req.params;

        let conversation = null;
        if (isDBConnected()) {
            try {
                conversation = await StaffMessage.findById(id);
            } catch (e) {
                conversation = null;
            }
        }

        if (!conversation) {
            conversation = memoryStaffMessages.find(m => m._id === id || m.sessionId === id);
        }

        if (!conversation) {
            return errorResponse(res, 404, 'Conversation not found.');
        }

        if (conversation.mode === 'AI') {
            return successResponse(res, 200, 'AI Mode is already active for this patient.', conversation);
        }

        conversation.mode = 'AI';
        conversation.aiResumedAt = new Date();

        const seq = getNextSequence(conversation);
        const resumeNotice = {
            messageId: generateMessageId(),
            sequence: seq,
            sender: 'STAFF',
            senderName: 'System',
            contentType: 'SYSTEM_NOTICE',
            text: 'Conversation mode returned to AI Assistant. Automated responses resumed.',
            timestamp: new Date()
        };

        if (Array.isArray(conversation.messages)) {
            conversation.messages.push(resumeNotice);
        } else {
            conversation.messages = [resumeNotice];
        }
        conversation.updatedAt = new Date().toISOString();

        if (isDBConnected() && typeof conversation.save === 'function') {
            try { await conversation.save(); } catch (e) {}
        }

        return successResponse(res, 200, 'AI Assistant mode restored. AI replies will resume for this patient.', conversation);
    } catch (error) {
        next(error);
    }
};

// POST /api/staff/inbox/:id/reply (Doctor/Staff sends manual reply)
const sendManualReply = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { message, senderName } = req.body;

        if (!message || !message.trim()) {
            return errorResponse(res, 400, 'Reply message is required.');
        }

        let conversation = null;
        if (isDBConnected()) {
            try {
                conversation = await StaffMessage.findById(id);
            } catch (e) {
                conversation = null;
            }
        }

        if (!conversation) {
            conversation = memoryStaffMessages.find(m => m._id === id || m.sessionId === id);
        }

        if (!conversation) {
            return errorResponse(res, 404, 'Conversation not found.');
        }

        const doctorName = senderName || (req.admin && req.admin.name) || 'Dr. Muhammad Zaheer Anjum';
        const seq = getNextSequence(conversation);
        const replyItem = {
            messageId: generateMessageId(),
            sequence: seq,
            sender: 'DOCTOR',
            senderName: doctorName,
            contentType: 'TEXT',
            text: message.trim(),
            timestamp: new Date()
        };

        if (Array.isArray(conversation.messages)) {
            conversation.messages.push(replyItem);
        } else {
            conversation.messages = [replyItem];
        }

        conversation.lastMessage = message.trim();
        conversation.lastSender = 'DOCTOR';
        conversation.status = 'in-progress';
        conversation.updatedAt = new Date().toISOString();

        if (isDBConnected() && typeof conversation.save === 'function') {
            try { await conversation.save(); } catch (e) {}
        }

        return successResponse(res, 200, 'Manual reply sent to patient successfully', conversation);
    } catch (error) {
        next(error);
    }
};

// PATCH /api/staff/inbox/:id (Update conversation status)
const updateStaffMessageStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        let updated;

        if (isDBConnected()) {
            try {
                updated = await StaffMessage.findByIdAndUpdate(id, { status, updatedAt: new Date() }, { new: true });
            } catch (e) {
                updated = null;
            }
        }

        if (!updated) {
            const item = memoryStaffMessages.find(m => m._id === id || m.sessionId === id);
            if (item) {
                item.status = status;
                item.updatedAt = new Date().toISOString();
                updated = item;
            }
        }

        if (!updated) return errorResponse(res, 404, 'Handover message not found.');
        return successResponse(res, 200, `Staff message status updated to ${status}`, updated);
    } catch (error) {
        next(error);
    }
};

// Emergency alerts
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
        if (isDBConnected()) {
            try {
                created = await EmergencyAlert.create(data);
            } catch (e) {
                created = { ...data, _id: `emg_${Date.now()}` };
                memoryEmergencyAlerts.unshift(created);
            }
        } else {
            created = { ...data, _id: `emg_${Date.now()}` };
            memoryEmergencyAlerts.unshift(created);
        }

        return successResponse(res, 201, 'Emergency alert registered', created);
    } catch (error) {
        next(error);
    }
};

const getEmergencyAlerts = async (req, res, next) => {
    try {
        let list = [];
        if (isDBConnected()) {
            try {
                list = await EmergencyAlert.find().sort({ createdAt: -1 });
            } catch (e) {
                list = memoryEmergencyAlerts;
            }
        } else {
            list = memoryEmergencyAlerts;
        }
        return successResponse(res, 200, 'Emergency alerts retrieved', list);
    } catch (error) {
        next(error);
    }
};

const updateEmergencyAlertStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        let updated;

        if (isDBConnected()) {
            try {
                updated = await EmergencyAlert.findByIdAndUpdate(id, { status }, { new: true });
            } catch (e) {
                updated = null;
            }
        }

        if (!updated) {
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
    handlePatientMessage,
    syncPatientChat,
    requestHandover,
    getStaffInbox,
    getStaffConversation,
    takeoverConversation,
    returnToAI,
    sendManualReply,
    updateStaffMessageStatus,
    createEmergencyAlert,
    getEmergencyAlerts,
    updateEmergencyAlertStatus
};

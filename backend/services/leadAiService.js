const AdsLead = require('../models/AdsLead');
const LeadMessage = require('../models/LeadMessage');
const Appointment = require('../models/Appointment');
const Patient = require('../models/Patient');
const Treatment = require('../models/Treatment');
const Clinic = require('../models/Clinic');
const OffDay = require('../models/OffDay');
const BlockedSlot = require('../models/BlockedSlot');
const SpecialSchedule = require('../models/SpecialSchedule');
const EmergencyAlert = require('../models/EmergencyAlert');
const StaffMessage = require('../models/StaffMessage');
const { generateAppointmentId } = require('../utils/appointmentIdGenerator');
const { generateTokenNumber } = require('../utils/tokenGenerator');
const { generateSlotsForDate } = require('../utils/slotGenerator');
const {
    CLINIC_TIMEZONE,
    getClinicNow,
    formatDateToYYYYMMDD,
    getDayOfWeek,
    parseClinicDate,
    parseClinicTime,
    WEEKDAY_DISPLAY
} = require('../utils/clinicDateParser');

const CLINIC_INFO = {
    doctor: "Dr. Muhammad Zaheer Anjum",
    specialty: "Pain Management & Regenerative Medicine Specialist",
    clinic: "Stay Young Clinic, Lahore",
    address: "684 Shadman Main Road, Shadman 1, opposite Fatima Memorial Hospital, Lahore",
    timing: "Monday to Saturday | 12:00 PM – 7:30 PM (Sunday Closed)",
    phone: "+92 321 3733332",
    whatsapp: "+92 321 3733332",
    city: "Lahore"
};

const MEDICAL_DISCLAIMER = "⚠️ *Medical Disclaimer: I am an AI Clinic Assistant here to help you with clinic information, specialist treatments, and appointment booking. I do not provide official medical diagnoses or drug prescriptions. For severe emergencies, please visit the nearest hospital ER or call 1122.*";

// Red flag emergency keywords
const RED_FLAGS = [
    'chest pain', 'heart attack', 'sudden weakness', 'paralysis',
    'loss of bowel', 'loss of bladder', 'incontinence', 'can\'t breathe',
    'difficulty breathing', 'severe bleeding', 'unconscious', 'fainted',
    'stroke', 'severe head trauma', 'coughing blood', 'vomiting blood'
];

// Human assistance keywords
const HUMAN_HANDOVER_KEYWORDS = [
    'talk to human', 'speak to staff', 'call me', 'human agent',
    'real person', 'talk to doctor directly', 'receptionist', 'admin',
    'operator', 'agent please'
];

/**
 * Main function to process incoming message for a lead
 */
const processIncomingLeadMessage = async ({
    lead,
    incomingMessageText,
    sender = 'lead',
    platformMessageId = null,
    metadata = {}
}) => {
    // 1. Save incoming message permanently in MongoDB
    const incomingMsg = await LeadMessage.create({
        leadId: lead._id,
        leadCode: lead.leadId,
        sender: sender,
        messageType: 'text',
        message: incomingMessageText,
        platformMessageId: platformMessageId || `lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date(),
        deliveryStatus: 'delivered',
        sentBy: lead.patientName || 'Patient',
        metadata: metadata
    });

    // Update lead's last message
    lead.lastMessage = incomingMessageText;
    lead.lastMessageAt = new Date();
    lead.totalMessagesCount = (lead.totalMessagesCount || 0) + 1;
    await lead.save();

    // 2. If lead is in MANUAL mode, skip automatic AI response
    if (lead.conversationMode === 'MANUAL') {
        console.log(`[AI Lead Service] Lead ${lead.leadId} is in MANUAL mode. Skipping automatic AI reply.`);
        return {
            incomingMsg,
            aiMsg: null,
            replied: false,
            reason: 'MANUAL_MODE_ACTIVE'
        };
    }

    // 3. Check for Emergency Red Flags
    const lowerText = incomingMessageText.toLowerCase();
    const isEmergency = RED_FLAGS.some(flag => lowerText.includes(flag));

    if (isEmergency) {
        lead.priority = 'urgent';
        lead.leadStatus = 'AI Engaged';
        await lead.save();

        try {
            await EmergencyAlert.create({
                patientName: lead.patientName,
                phone: lead.phone,
                message: `[Ads Lead ${lead.leadId}] Emergency trigger: ${incomingMessageText}`,
                status: 'open',
                priority: 'urgent',
                source: `Ads Lead (${lead.source})`
            });
        } catch (err) {
            console.error('[AI Lead Service] EmergencyAlert creation error:', err.message);
        }

        const emergencyReply = `🚨 **URGENT MEDICAL NOTICE** 🚨\n\nBased on the symptoms you mentioned, you may require immediate emergency medical attention.\n\n⚠️ **Please call 1122 or visit the nearest emergency room immediately.**\n\nDr. Muhammad Zaheer Anjum Clinic handles scheduled outpatient pain management and regenerative consultations and is not an emergency response unit.\n\nStay Young Clinic Emergency Helpdesk: **${CLINIC_INFO.phone}**\n\n${MEDICAL_DISCLAIMER}`;

        const aiMsg = await sendAiResponse(lead, emergencyReply, { intent: 'emergency_alert', priority: 'urgent' });
        return { incomingMsg, aiMsg, replied: true, intent: 'emergency' };
    }

    // 4. Check for Human Handover / Staff Contact request
    const isHandoverRequested = HUMAN_HANDOVER_KEYWORDS.some(k => lowerText.includes(k));
    if (isHandoverRequested) {
        try {
            await StaffMessage.create({
                patientName: lead.patientName,
                phone: lead.phone,
                message: `[Ads Lead Handover] Patient requested staff contact: "${incomingMessageText}"`,
                status: 'pending',
                source: `Ads Lead (${lead.source})`
            });
        } catch (err) {
            console.error('[AI Lead Service] StaffMessage error:', err.message);
        }

        const handoverReply = `Hello ${lead.patientName}! 👋\n\nI have notified Dr. Zaheer's clinic coordinator. A human staff member will reach out to you at **${lead.phone}** shortly.\n\nIn the meantime, you can also call or WhatsApp us directly at **${CLINIC_INFO.whatsapp}** during consultation hours (Mon–Sat, 12:00 PM – 7:30 PM).\n\n${MEDICAL_DISCLAIMER}`;

        const aiMsg = await sendAiResponse(lead, handoverReply, { intent: 'human_handover' });
        return { incomingMsg, aiMsg, replied: true, intent: 'human_handover' };
    }

    // 5. Fetch full conversation history from DB for complete context
    const conversationHistory = await LeadMessage.find({ leadId: lead._id })
        .sort({ timestamp: 1 })
        .limit(20)
        .lean();

    // 6. Generate intelligent Clinical / Booking Response
    const responsePayload = await generateClinicalResponse(lead, incomingMessageText, conversationHistory);

    // 7. Send & persist AI response permanently in MongoDB
    const aiMsg = await sendAiResponse(lead, responsePayload.text, responsePayload.metadata || {});

    return {
        incomingMsg,
        aiMsg,
        replied: true,
        intent: responsePayload.metadata?.intent || 'general'
    };
};

/**
 * Generate intelligent clinical qualification, treatment info, or booking response
 */
const generateClinicalResponse = async (lead, currentMsg, history) => {
    const text = (currentMsg || '').trim();
    const lower = text.toLowerCase();

    // Check if external LLM configured (e.g. Gemini / OpenAI)
    if (process.env.AI_PROVIDER && process.env.AI_API_KEY && process.env.AI_API_KEY !== 'none') {
        try {
            const llmRes = await callExternalLLM(lead, currentMsg, history);
            if (llmRes) return llmRes;
        } catch (err) {
            console.warn('[AI Lead Service] External LLM failed, using built-in clinical engine:', err.message);
        }
    }

    // Built-in Medical AI Specialist Expert Engine:
    return await runBuiltinClinicalEngine(lead, text, lower, history);
};

/**
 * Comprehensive built-in Clinical Qualification & Booking Engine
 */
const runBuiltinClinicalEngine = async (lead, text, lower, history) => {
    // Parse date and time using Clinic Date Parser
    const parsedDate = parseClinicDate(text);
    const parsedTime = parseClinicTime(text);
    const hasPendingBooking = lead.pendingBooking &&
        lead.pendingBooking.bookingStage === 'awaiting_alternative_slot_selection' &&
        Boolean(lead.pendingBooking.requestedDate);

    // Intent 1: Explicit Date / Time Booking Request, Confirmation, or Selecting Offered Alternative Slot
    if (
        (lower.includes('book') || lower.includes('confirm') || lower.includes('slot') || lower.includes('appointment') || hasPendingBooking) &&
        (parsedDate.hasExplicitDate || parsedTime || hasPendingBooking || lower.includes('tomorrow') || lower.includes('today') || lower.includes('yes'))
    ) {
        return await handleBookingIntent(lead, text, lower, parsedDate);
    }

    // Intent 2: Inquiring about Appointment Booking / Available Slots
    if (lower.includes('appointment') || lower.includes('book') || lower.includes('timing') || lower.includes('fees') || lower.includes('fee') || lower.includes('consultation') || lower.includes('schedule') || lower.includes('visit')) {
        const nextDates = getUpcomingConsultationDates(3);
        let slotsMessage = '';
        try {
            const slotsData = await generateSlotsForDate({
                dateStr: nextDates[0].dateStr,
                AppointmentModel: Appointment,
                OffDayModel: OffDay,
                BlockedSlotModel: BlockedSlot,
                SpecialScheduleModel: SpecialSchedule,
                ClinicModel: Clinic
            });

            const topSlots = (slotsData.slots || []).slice(0, 4).join(', ');
            slotsMessage = `\n\n📅 **Available Consultation Days:**\n` +
                nextDates.map(d => `• **${d.label}** (${d.dateStr})`).join('\n') +
                `\n\n🕒 **Available Slots for ${nextDates[0].label}:**\n${topSlots || '12:00 PM, 01:00 PM, 04:30 PM, 06:00 PM'}`;
        } catch (e) {
            slotsMessage = `\n\n🕒 **Consultation Hours:** Monday – Saturday | 12:00 PM – 7:30 PM`;
        }

        lead.leadStatus = 'Appointment Requested';
        await lead.save().catch(() => {});

        return {
            text: `Dr. Muhammad Zaheer Anjum consults at **${CLINIC_INFO.clinic}** (Shadman 1, Lahore).${slotsMessage}\n\nWould you prefer an **In-Person Clinic Visit** or an **Online Consultation**? Please let me know your preferred date and time to secure your official appointment token!\n\n${MEDICAL_DISCLAIMER}`,
            metadata: { intent: 'appointment_inquiry', status: 'Appointment Requested' }
        };
    }

    // Intent 3: Pain / Symptom Assessment & Qualification
    const symptomKeywords = [
        'pain', 'back', 'neck', 'knee', 'joint', 'sciatica', 'spine',
        'headache', 'migraine', 'arthritis', 'osteoarthritis', 'shoulder',
        'fibromyalgia', 'nerve', 'slip disc', 'prp', 'stem cell', 'injections'
    ];

    const matchedSymptoms = symptomKeywords.filter(k => lower.includes(k));

    if (matchedSymptoms.length > 0 || lead.leadStatus === 'New' || history.length <= 2) {
        // Extract qualification details
        if (lower.includes('back') || lower.includes('neck') || lower.includes('knee') || lower.includes('shoulder') || lower.includes('joint')) {
            lead.qualificationAnswers.painLocation = matchedSymptoms.join(', ');
        }
        if (text.match(/\b\d+\s*(days?|weeks?|months?|years?)\b/i)) {
            lead.qualificationAnswers.duration = text.match(/\b\d+\s*(days?|weeks?|months?|years?)\b/i)[0];
        }
        if (text.match(/\b([1-9]|10)\s*(\/|\s*out of\s*)?10\b/i)) {
            lead.qualificationAnswers.severity = text.match(/\b([1-9]|10)\b/)[0] + '/10';
        }

        lead.leadStatus = 'Qualified';
        await lead.save().catch(() => {});

        // Fetch relevant treatments from DB
        let relevantTreatments = [];
        try {
            relevantTreatments = await Treatment.find({ active: true }).limit(6);
        } catch (e) {}

        const treatmentList = relevantTreatments.length > 0
            ? relevantTreatments.slice(0, 4).map(t => `• **${t.title}** (${t.category}): ${t.description}`).join('\n')
            : `• **PRP & Stem-Cell Joint Therapy**: Non-surgical cartilage regeneration.\n• **Image-Guided Interventional Spine Care**: Precision relief for cervical and lumbar pain.\n• **Ozone & Shockwave Therapy**: Cellular healing and anti-inflammatory care.`;

        return {
            text: `Thank you for sharing your details with **Dr. Muhammad Zaheer Anjum Clinic**.\n\nDr. Zaheer specializes in advanced non-surgical pain management and regenerative medicine at **Stay Young Clinic, Lahore**.\n\n🩺 **Advanced Procedures Offered:**\n${treatmentList}\n\nTo help Dr. Zaheer tailor the best management plan for you:\n1. How long have you been experiencing this discomfort?\n2. On a scale of 1 to 10, how severe is the pain?\n3. Have you had any prior X-rays, MRI scans, or injections?\n\nWhenever you are ready, I can also book your consultation slot directly!\n\n${MEDICAL_DISCLAIMER}`,
            metadata: { intent: 'qualification_symptoms', qualified: true }
        };
    }

    // Intent 4: Clinic Location, Doctor Info, or General Welcome
    if (lower.includes('location') || lower.includes('address') || lower.includes('where') || lower.includes('doctor') || lower.includes('who')) {
        return {
            text: `📍 **Clinic Location & Specialist Profile:**\n\n• **Doctor:** ${CLINIC_INFO.doctor}\n• **Specialty:** ${CLINIC_INFO.specialty}\n• **Clinic:** ${CLINIC_INFO.clinic}\n• **Address:** ${CLINIC_INFO.address}\n• **Timings:** ${CLINIC_INFO.timing}\n• **Phone / WhatsApp:** ${CLINIC_INFO.phone}\n\nWould you like me to book a consultation slot for you with Dr. Zaheer Anjum?`,
            metadata: { intent: 'clinic_info' }
        };
    }

    // Default Professional Engaging Welcome & Assistance
    return {
        text: `Welcome to **Dr. Muhammad Zaheer Anjum Clinic**! 👋\n\nI am the AI Clinic Assistant for Dr. Muhammad Zaheer Anjum (Pain Management & Regenerative Medicine Specialist at Stay Young Clinic, Shadman 1, Lahore).\n\nI can assist you with:\n1. 🩺 Treatment options for Back, Neck, Knee, Joint, and Nerve Pain\n2. 💉 Regenerative therapies (PRP, Stem Cell, Exosomes, IV Drips)\n3. 📅 Checking available consultation slots and booking an appointment\n4. 💬 Answering questions about clinic timings, location, and procedures\n\nPlease let me know what condition or treatment you would like help with today!\n\n${MEDICAL_DISCLAIMER}`,
        metadata: { intent: 'general_welcome' }
    };
};

/**
 * Handle automated appointment booking inside AI chat
 */
const handleBookingIntent = async (lead, text, lower, passedParsedDate = null) => {
    const parsedDate = passedParsedDate || parseClinicDate(text);

    // 1. Ambiguity / Weekday Mismatch / Invalid / Past Date Check
    if (parsedDate.hasExplicitDate && !parsedDate.isValid) {
        return {
            text: `${parsedDate.clarificationMessage || 'I could not determine the exact date for your appointment.'}\n\nPlease let me know which date and time you would prefer between Monday and Saturday (12:00 PM – 7:30 PM).\n\n${MEDICAL_DISCLAIMER}`,
            metadata: { intent: 'booking_date_clarification', reason: parsedDate.reason }
        };
    }

    // 2. Determine targetDate and targetWeekday
    let targetDate = null;
    let targetWeekday = null;

    if (parsedDate.hasExplicitDate && parsedDate.isValid && parsedDate.dateStr) {
        targetDate = parsedDate.dateStr;
        targetWeekday = parsedDate.weekday;
    } else if (
        lead.pendingBooking &&
        lead.pendingBooking.bookingStage === 'awaiting_alternative_slot_selection' &&
        lead.pendingBooking.requestedDate
    ) {
        // Resolve from pending booking context seamlessly
        targetDate = lead.pendingBooking.requestedDate;
        targetWeekday = lead.pendingBooking.requestedWeekday || '';
    } else {
        // If no explicit date was provided in message, ask patient for preferred date instead of silently defaulting to today!
        const nextDates = getUpcomingConsultationDates(3);
        const nextDatesFormatted = nextDates.map(d => `• **${d.label}** (${d.dateStr})`).join('\n');

        return {
            text: `I would be happy to schedule your appointment with Dr. Muhammad Zaheer Anjum at **${CLINIC_INFO.clinic}**!\n\n📅 **Available Consultation Days:**\n${nextDatesFormatted}\n\n🕒 **Consultation Hours:** Monday – Saturday | 12:00 PM – 7:30 PM\n\nPlease let me know your preferred date and time (e.g., *Thursday, September 3 at 2:30 PM*).\n\n${MEDICAL_DISCLAIMER}`,
            metadata: { intent: 'booking_date_needed' }
        };
    }

    // Determine Appointment Type
    let apptType = parsedDate.appointmentType;
    if (lower.includes('online') || lower.includes('virtual') || lower.includes('video') || lower.includes('zoom')) {
        apptType = 'Online Appointment';
    } else if (lower.includes('in-person') || lower.includes('in person') || lower.includes('clinic') || lower.includes('physical') || lower.includes('visit')) {
        apptType = 'In-Person Appointment';
    } else if (lead.pendingBooking && lead.pendingBooking.requestedAppointmentType) {
        apptType = lead.pendingBooking.requestedAppointmentType;
    } else {
        apptType = 'In-Person Appointment';
    }

    // 3. Check Clinic Schedule, OffDays, BlockedSlots, SpecialSchedules, and existing active appointments
    let availableSlots = [];
    let slotReason = '';
    try {
        const slotsData = await generateSlotsForDate({
            dateStr: targetDate,
            AppointmentModel: Appointment,
            OffDayModel: OffDay,
            BlockedSlotModel: BlockedSlot,
            SpecialScheduleModel: SpecialSchedule,
            ClinicModel: Clinic
        });
        availableSlots = slotsData.slots || [];
        slotReason = slotsData.reason || '';
    } catch (e) {
        availableSlots = ['12:30 PM', '01:00 PM', '02:00 PM', '02:30 PM', '03:00 PM', '04:00 PM', '05:30 PM', '06:30 PM'];
    }

    if (availableSlots.length === 0) {
        const nextDates = getUpcomingConsultationDates(3).filter(d => d.dateStr !== targetDate);
        return {
            text: `Dr. Zaheer is not available for consultations on **${targetWeekday ? targetWeekday + ', ' : ''}${targetDate}** (${slotReason || 'Clinic closed or fully booked'}).\n\n📅 **Next Available Consultation Days:**\n${nextDates.map(d => `• **${d.label}** (${d.dateStr})`).join('\n')}\n\nPlease choose an alternative date and time between Monday and Saturday (12:00 PM – 7:30 PM)!\n\n${MEDICAL_DISCLAIMER}`,
            metadata: { intent: 'booking_no_slots', date: targetDate, reason: slotReason }
        };
    }

    // 4. Match requested time slot or default to first available
    const parsedTime = parseClinicTime(text, availableSlots);
    let selectedSlot = parsedTime;

    if (!selectedSlot) {
        const rawTime = parseClinicTime(text);
        if (rawTime) {
            // Persist pending booking context on lead
            lead.pendingBooking = {
                requestedDate: targetDate,
                requestedWeekday: targetWeekday || '',
                requestedAppointmentType: apptType,
                originallyRequestedTime: rawTime,
                offeredAlternativeSlots: availableSlots,
                bookingStage: 'awaiting_alternative_slot_selection',
                updatedAt: new Date()
            };
            lead.leadStatus = 'Appointment Requested';
            await lead.save();

            return {
                text: `The slot **${rawTime}** on **${targetWeekday ? targetWeekday + ', ' : ''}${targetDate}** is currently unavailable.\n\n🕒 **Available slots on this date:**\n${availableSlots.slice(0, 6).join(', ')}\n\nPlease select one of the available times to confirm your token!\n\n${MEDICAL_DISCLAIMER}`,
                metadata: { intent: 'slot_unavailable', requestedTime: rawTime, availableSlots, date: targetDate }
            };
        }
        selectedSlot = availableSlots[0];
    } else if (!availableSlots.includes(selectedSlot)) {
        const found = availableSlots.find(s => s.replace(/\s+/g, '').toUpperCase() === selectedSlot.replace(/\s+/g, '').toUpperCase());
        if (found) {
            selectedSlot = found;
        } else {
            // Persist pending booking context on lead
            lead.pendingBooking = {
                requestedDate: targetDate,
                requestedWeekday: targetWeekday || '',
                requestedAppointmentType: apptType,
                originallyRequestedTime: selectedSlot,
                offeredAlternativeSlots: availableSlots,
                bookingStage: 'awaiting_alternative_slot_selection',
                updatedAt: new Date()
            };
            lead.leadStatus = 'Appointment Requested';
            await lead.save();

            return {
                text: `The requested time **${selectedSlot}** is unavailable on **${targetWeekday ? targetWeekday + ', ' : ''}${targetDate}**.\n\n🕒 **Available slots:** ${availableSlots.slice(0, 6).join(', ')}\n\nPlease choose one of these times to proceed.\n\n${MEDICAL_DISCLAIMER}`,
                metadata: { intent: 'slot_unavailable', requestedTime: selectedSlot, availableSlots, date: targetDate }
            };
        }
    }

    // 5. Check for existing active appointment on retry to avoid duplicates
    let savedAppt = null;
    try {
        let existingAppt = null;
        if (lead.linkedAppointment) {
            existingAppt = await Appointment.findOne({
                _id: lead.linkedAppointment,
                status: { $nin: ['cancelled'] }
            });
        }
        if (!existingAppt) {
            existingAppt = await Appointment.findOne({
                phone: lead.phone,
                date: targetDate,
                time: selectedSlot,
                status: { $nin: ['cancelled'] }
            });
        }

        if (existingAppt) {
            savedAppt = existingAppt;
            lead.linkedAppointment = savedAppt._id;
            lead.linkedAppointmentId = savedAppt.appointmentId;
            lead.leadStatus = 'Appointment Booked';
            if (lead.pendingBooking) {
                lead.pendingBooking.bookingStage = 'completed';
                lead.pendingBooking.updatedAt = new Date();
            }
            await lead.save();
        } else {
            const appointmentId = await generateAppointmentId(Appointment);
            const tokenNumber = await generateTokenNumber(Appointment, 'Stay Young Clinic', targetDate);

            // Find or create patient record
            let patientDoc = await Patient.findOne({ phone: lead.phone });
            if (!patientDoc) {
                patientDoc = await Patient.create({
                    patientId: `PAT-${Date.now().toString().slice(-6)}`,
                    name: lead.patientName,
                    phone: lead.phone,
                    city: lead.city || 'Lahore'
                });
            }

            savedAppt = await Appointment.create({
                appointmentId,
                tokenNumber,
                patient: patientDoc._id,
                patientName: lead.patientName,
                phone: lead.phone,
                appointmentType: apptType,
                clinic: 'Stay Young Clinic',
                city: lead.city || 'Lahore',
                date: targetDate,
                time: selectedSlot,
                status: 'confirmed',
                notes: `Auto-booked via AI Ads Lead Assistant (${lead.source}). Lead ID: ${lead.leadId}`
            });

            // Link appointment to lead & mark pending booking completed
            lead.linkedAppointment = savedAppt._id;
            lead.linkedAppointmentId = appointmentId;
            lead.leadStatus = 'Appointment Booked';
            if (lead.pendingBooking) {
                lead.pendingBooking.bookingStage = 'completed';
                lead.pendingBooking.updatedAt = new Date();
            }
            await lead.save();
        }
    } catch (err) {
        console.error('[AI Lead Service] Failed to create appointment:', err.message);
    }

    if (savedAppt) {
        return {
            text: `🎉 **Appointment Confirmed with Dr. Muhammad Zaheer Anjum!**\n\n• **Token Number:** ${savedAppt.tokenNumber}\n• **Appointment ID:** \`${savedAppt.appointmentId}\`\n• **Patient Name:** ${lead.patientName}\n• **Phone:** ${lead.phone}\n• **Appointment Type:** ${savedAppt.appointmentType}\n• **Date:** ${savedAppt.date} (${targetWeekday || 'Confirmed'})\n• **Time Slot:** ${savedAppt.time}\n• **Clinic:** Stay Young Clinic, 684 Shadman Main Road, Shadman 1, Lahore\n• **Status:** Confirmed ✅\n\nPlease arrive 10 minutes prior to your slot with any previous medical reports or MRI scans.\n\nFor any queries or rescheduling, you can message us here or on WhatsApp at **${CLINIC_INFO.whatsapp}**.\n\n${MEDICAL_DISCLAIMER}`,
            metadata: {
                intent: 'appointment_booked',
                appointmentId: savedAppt.appointmentId,
                tokenNumber: savedAppt.tokenNumber,
                appointmentType: savedAppt.appointmentType,
                date: savedAppt.date,
                time: savedAppt.time
            }
        };
    } else {
        return {
            text: `We have registered your appointment request for **${targetDate}** at **${selectedSlot}**. Our clinic reception will call you at **${lead.phone}** to finalize your token.\n\n${MEDICAL_DISCLAIMER}`,
            metadata: { intent: 'booking_pending' }
        };
    }
};

/**
 * Send and permanently persist AI Response
 */
const sendAiResponse = async (lead, responseText, metadata = {}) => {
    let savedMsg = null;
    try {
        savedMsg = await LeadMessage.create({
            leadId: lead._id,
            leadCode: lead.leadId,
            sender: 'AI',
            messageType: 'text',
            message: responseText,
            platformMessageId: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            timestamp: new Date(),
            deliveryStatus: 'sent',
            sentBy: 'Dr. Zaheer AI Assistant',
            metadata: metadata
        });

        lead.lastMessage = responseText;
        lead.lastMessageAt = new Date();
        await lead.save();
    } catch (e) {
        console.error('[AI Lead Service] Error recording AI response:', e.message);
    }

    return {
        mode: 'AI',
        replied: true,
        message: responseText,
        savedMessage: savedMsg
    };
};

/**
 * Helper to get next consultation dates (excluding Sunday)
 */
const getUpcomingConsultationDates = (count = 3) => {
    const dates = [];
    const now = new Date();
    let d = new Date(now);

    while (dates.length < count) {
        d.setDate(d.getDate() + 1);
        const day = d.getDay();
        if (day !== 0) { // Skip Sunday
            const dateStr = d.toISOString().slice(0, 10);
            const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            dates.push({
                dateStr,
                label: `${dayNames[day]}, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            });
        }
    }
    return dates;
};

/**
 * External LLM Adapter (Gemini / OpenAI)
 */
const callExternalLLM = async (lead, currentMsg, history) => {
    const provider = (process.env.AI_PROVIDER || '').toLowerCase();
    const apiKey = process.env.AI_API_KEY;
    const modelName = process.env.AI_MODEL || 'gemini-1.5-flash';

    if (provider.includes('gemini')) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const prompt = `You are the Official AI Clinic Assistant for Dr. Muhammad Zaheer Anjum (Pain Management & Regenerative Medicine Specialist at Stay Young Clinic, Lahore).
Clinic Address: 684 Shadman Main Road, Shadman 1, opposite Fatima Memorial Hospital, Lahore. Timings: Mon-Sat 12:00 PM - 7:30 PM.
Patient Details: Name: ${lead.patientName}, Phone: ${lead.phone}, Interested: ${lead.interestedTreatment}.

Guidelines:
1. Be empathetic, professional, and clear.
2. Ask structured qualification questions (pain duration, location, 1-10 severity, previous treatments).
3. Do NOT diagnose or prescribe drugs. Include a brief medical disclaimer.
4. If patient wants an appointment, offer consultation hours (12 PM - 7:30 PM Mon-Sat).
5. If red-flag symptoms are present, advise immediate emergency care.

Patient said: "${currentMsg}"`;

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (res.ok) {
            const data = await res.json();
            const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (reply) {
                return { text: reply, metadata: { provider: 'gemini' } };
            }
        }
    }
    return null;
};

module.exports = {
    processIncomingLeadMessage,
    sendAiResponse,
    CLINIC_INFO,
    MEDICAL_DISCLAIMER
};

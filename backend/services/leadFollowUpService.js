const AdsLead = require('../models/AdsLead');
const LeadMessage = require('../models/LeadMessage');

/**
 * Process due follow-ups across all active leads
 */
const runFollowUpCheck = async () => {
    try {
        const now = new Date();
        const dueLeads = await AdsLead.find({
            followUpAt: { $lte: now },
            followUpStatus: 'scheduled',
            leadStatus: { $nin: ['Closed', 'Not Interested', 'Converted'] }
        });

        if (!dueLeads || dueLeads.length === 0) return { checked: 0, sent: 0 };

        let sentCount = 0;

        for (const lead of dueLeads) {
            // Case 1: AI Mode -> Send Automated Follow-Up Message
            if (lead.conversationMode === 'AI') {
                const followUpMessage = `Hello ${lead.patientName}! 👋\n\nThis is a quick follow-up from **Dr. Muhammad Zaheer Anjum Clinic** (Stay Young Clinic, Lahore).\n\nWe wanted to check if you still have questions regarding **${lead.interestedTreatment || 'pain management treatment'}** or if you would like us to reserve a consultation slot for you with Dr. Zaheer this week.\n\nPlease reply here or WhatsApp us anytime at **+92 321 3733332**.`;

                try {
                    await LeadMessage.create({
                        leadId: lead._id,
                        leadCode: lead.leadId,
                        sender: 'AI',
                        messageType: 'text',
                        message: followUpMessage,
                        platformMessageId: `followup_${Date.now()}`,
                        timestamp: new Date(),
                        deliveryStatus: 'sent',
                        sentBy: 'Dr. Zaheer AI Assistant',
                        metadata: { followUp: true, followUpNotes: lead.followUpNotes }
                    });

                    lead.lastMessage = followUpMessage;
                    lead.lastMessageAt = new Date();
                    lead.followUpStatus = 'sent';
                    lead.leadStatus = 'Follow-Up';
                    await lead.save();
                    sentCount++;
                } catch (e) {
                    console.error(`[Follow-Up] Failed to send AI follow-up for lead ${lead.leadId}:`, e.message);
                }
            }
            // Case 2: Manual Mode -> Create Staff Reminder Only
            else {
                try {
                    await LeadMessage.create({
                        leadId: lead._id,
                        leadCode: lead.leadId,
                        sender: 'system',
                        messageType: 'text',
                        message: `📌 Staff Follow-Up Reminder: Scheduled follow-up was due at ${lead.followUpAt.toLocaleString()}. Note: ${lead.followUpNotes || 'No notes'}.`,
                        platformMessageId: `sys_followup_${Date.now()}`,
                        timestamp: new Date(),
                        deliveryStatus: 'delivered',
                        sentBy: 'System Reminder',
                        metadata: { followUpReminder: true }
                    });

                    lead.followUpStatus = 'completed';
                    await lead.save();
                } catch (e) {}
            }
        }

        return { checked: dueLeads.length, sent: sentCount };
    } catch (error) {
        console.error('[Follow-Up Service] Error in runFollowUpCheck:', error.message);
        return { checked: 0, sent: 0, error: error.message };
    }
};

/**
 * Initializes recurring background check every 60 seconds
 */
const initFollowUpScheduler = () => {
    // Run initial check after 10 seconds, then every 60 seconds
    setTimeout(() => {
        runFollowUpCheck();
        setInterval(runFollowUpCheck, 60000);
    }, 10000);
    console.log('[Follow-Up Service] Automated Follow-Up scheduler initialized (interval: 60s)');
};

module.exports = {
    runFollowUpCheck,
    initFollowUpScheduler
};

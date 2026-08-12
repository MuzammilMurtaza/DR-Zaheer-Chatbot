const express = require('express');
const router = express.Router();
const {
    requestHandover,
    getStaffInbox,
    updateStaffMessageStatus,
    createEmergencyAlert,
    getEmergencyAlerts,
    updateEmergencyAlertStatus
} = require('../controllers/staffController');

router.post('/handover', requestHandover);
router.get('/inbox', getStaffInbox);
router.patch('/inbox/:id', updateStaffMessageStatus);

router.post('/emergency', createEmergencyAlert);
router.get('/emergency', getEmergencyAlerts);
router.patch('/emergency/:id', updateEmergencyAlertStatus);

module.exports = router;

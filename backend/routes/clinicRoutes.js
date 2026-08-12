const express = require('express');
const router = express.Router();
const {
    getClinics,
    updateClinic,
    getOffDays,
    addOffDay,
    deleteOffDay,
    getBlockedSlots,
    addBlockedSlot,
    deleteBlockedSlot,
    getSpecialSchedules,
    addSpecialSchedule
} = require('../controllers/clinicController');

router.get('/', getClinics);
router.patch('/:id', updateClinic);

router.get('/off-days', getOffDays);
router.post('/off-days', addOffDay);
router.delete('/off-days/:id', deleteOffDay);

router.get('/blocked-slots', getBlockedSlots);
router.post('/blocked-slots', addBlockedSlot);
router.delete('/blocked-slots/:id', deleteBlockedSlot);

router.get('/special-schedules', getSpecialSchedules);
router.post('/special-schedules', addSpecialSchedule);

module.exports = router;

const express = require('express');
const router = express.Router();
const {
    createConsultationRequest,
    getConsultations,
    updateConsultationStatus
} = require('../controllers/consultationController');

router.post('/', createConsultationRequest);
router.get('/', getConsultations);
router.patch('/:id/status', updateConsultationStatus);

module.exports = router;

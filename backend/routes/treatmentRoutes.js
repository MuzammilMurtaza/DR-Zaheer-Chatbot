const express = require('express');
const router = express.Router();
const { getTreatments, createTreatment } = require('../controllers/treatmentController');

router.get('/', getTreatments);
router.post('/', createTreatment);

module.exports = router;

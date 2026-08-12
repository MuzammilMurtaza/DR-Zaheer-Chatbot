const express = require('express');
const router = express.Router();
const { getPatients } = require('../controllers/patientController');

router.get('/', getPatients);

module.exports = router;

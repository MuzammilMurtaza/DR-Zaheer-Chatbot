const express = require('express');
const router = express.Router();
const {
    uploadMedicalReport,
    getReports,
    markReportReviewed,
    downloadReportFile
} = require('../controllers/reportController');
const { uploadReport } = require('../middleware/uploadMiddleware');

router.post('/', uploadReport.single('reportFile'), uploadMedicalReport);
router.get('/', getReports);
router.patch('/:id/review', markReportReviewed);
router.get('/:id/download', downloadReportFile);

module.exports = router;

const Treatment = require('../models/Treatment');
const { successResponse, errorResponse } = require('../utils/response');

const DEFAULT_TREATMENTS = [
    // PAIN MANAGEMENT
    { title: "Chronic pain management", category: "PAIN MANAGEMENT", description: "Comprehensive multidisciplinary approach to managing long-term pain.", active: true },
    { title: "Chronic back pain", category: "PAIN MANAGEMENT", description: "Targeted regenerative and interventional therapies for back pain relief.", active: true },
    { title: "Back and neck pain", category: "PAIN MANAGEMENT", description: "Image-guided procedures for cervical and lumbar spinal pain.", active: true },
    { title: "Arthritis-related pain", category: "PAIN MANAGEMENT", description: "Non-surgical joint pain management and anti-inflammatory care.", active: true },
    { title: "Headache management", category: "PAIN MANAGEMENT", description: "Specialized treatment protocols for tension, migraine, and cervicogenic headaches.", active: true },
    { title: "Fibromyalgia", category: "PAIN MANAGEMENT", description: "Holistic pain relief and regenerative therapy for fibromyalgia symptoms.", active: true },
    { title: "Pelvic pain", category: "PAIN MANAGEMENT", description: "Interventional management for chronic pelvic pain conditions.", active: true },
    { title: "Orofacial pain", category: "PAIN MANAGEMENT", description: "Targeted therapy for jaw, facial nerve, and TMJ pain.", active: true },
    { title: "Cancer pain management", category: "PAIN MANAGEMENT", description: "Compassionate interventional pain care for oncology patients.", active: true },
    { title: "Palliative pain care", category: "PAIN MANAGEMENT", description: "Symptom management focused on improving quality of life.", active: true },
    { title: "Ozone therapy for pain", category: "PAIN MANAGEMENT", description: "Medical ozone therapy for anti-inflammatory tissue repair.", active: true },
    { title: "Shockwave therapy", category: "PAIN MANAGEMENT", description: "Extracorporeal shockwave therapy for musculoskeletal conditions.", active: true },
    { title: "Cold-laser therapy", category: "PAIN MANAGEMENT", description: "Low-level laser therapy for non-invasive cellular repair.", active: true },

    // REGENERATIVE MEDICINE
    { title: "Stem-cell therapy for joint pain", category: "REGENERATIVE MEDICINE", description: "Autologous stem cell cellular therapy for joint tissue regeneration.", active: true },
    { title: "PRP therapy for joints", category: "REGENERATIVE MEDICINE", description: "Platelet-rich plasma injections to stimulate natural cartilage repair.", active: true },
    { title: "Regenerative treatment for knee osteoarthritis", category: "REGENERATIVE MEDICINE", description: "Advanced cellular protocol to slow cartilage degradation.", active: true },
    { title: "Exosome therapy", category: "REGENERATIVE MEDICINE", description: "Cellular signaling exosome injections for tissue regeneration.", active: true },
    { title: "Image-guided regenerative procedures", category: "REGENERATIVE MEDICINE", description: "Ultrasound and fluoroscopy-guided precision injections.", active: true },

    // WELLNESS & AESTHETICS
    { title: "IV vitamin drips", category: "WELLNESS & AESTHETICS", description: "Custom nutrient infusions for immunity, energy, and recovery.", active: true },
    { title: "NAD+ IV therapy", category: "WELLNESS & AESTHETICS", description: "Cellular anti-aging and metabolic enhancement infusions.", active: true },
    { title: "Medical aesthetics", category: "WELLNESS & AESTHETICS", description: "Physician-directed aesthetic enhancements.", active: true },
    { title: "PRP for hair and skin", category: "WELLNESS & AESTHETICS", description: "Platelet-rich plasma for scalp stimulation and skin rejuvenation.", active: true },
    { title: "Botox and dermal fillers", category: "WELLNESS & AESTHETICS", description: "Cosmetic facial rejuvenation and anti-wrinkle injections.", active: true },
    { title: "Microneedling and chemical peels", category: "WELLNESS & AESTHETICS", description: "Dermatological collagen induction therapy.", active: true },
    { title: "P-Shot", category: "WELLNESS & AESTHETICS", description: "Regenerative therapy for male sexual wellness.", active: true }
];

let memoryTreatments = [...DEFAULT_TREATMENTS];

const getTreatments = async (req, res, next) => {
    try {
        let treatments = [];
        try {
            treatments = await Treatment.find({ active: true }).sort({ category: 1, title: 1 });
            if (treatments.length === 0) {
                await Treatment.insertMany(DEFAULT_TREATMENTS);
                treatments = await Treatment.find({ active: true });
            }
        } catch (e) {
            treatments = memoryTreatments.filter(t => t.active);
        }
        return successResponse(res, 200, 'Treatments fetched successfully', treatments);
    } catch (error) {
        next(error);
    }
};

const createTreatment = async (req, res, next) => {
    try {
        const { title, category, description } = req.body;
        if (!title || !category || !description) {
            return errorResponse(res, 400, 'Title, Category, and Description are required.');
        }

        let created;
        try {
            created = await Treatment.create({ title, category, description, active: true });
        } catch (e) {
            created = { _id: `trt_${Date.now()}`, title, category, description, active: true };
            memoryTreatments.push(created);
        }
        return successResponse(res, 201, 'Treatment added successfully', created);
    } catch (error) {
        next(error);
    }
};

module.exports = { getTreatments, createTreatment };

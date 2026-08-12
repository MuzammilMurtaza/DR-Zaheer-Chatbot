/* =========================================================
   DR. MUHAMMAD ZAHEER ANJUM
   AI CLINIC ASSISTANT

   FRONTEND JAVASCRIPT
   METHODS / FUNCTIONS BASED STRUCTURE
========================================================= */


/* =========================================================
   1. APPLICATION CONFIGURATION
========================================================= */

const CONFIG = {

    doctor: {
        name: "Dr. Muhammad Zaheer Anjum",
        shortName: "MZA",
        specialty: "Pain Management & Regenerative Medicine Specialist"
    },

    clinic: {
        name: "Stay Young Clinic",
        city: "Lahore",
        address:
            "684 Shadman Main Road, Shadman 1, opposite Fatima Memorial Hospital, Lahore",

        schedule:
            "Monday to Saturday, 12:00 PM – 7:30 PM",

        phone:
            "+923213733332"
    }

};


/* =========================================================
   2. APPLICATION STATE

   This stores temporary frontend data.

   Later this will be connected with backend + MongoDB.
========================================================= */

const state = {

    language: "english",

    currentStep: null,

    booking: {

        patientName: "",

        phone: "",

        appointmentType: "",

        clinic: "",

        date: "",

        time: "",

        token: "",

        appointmentId: ""

    },

    report: {

        type: "",

        phone: "",

        token: "",

        description: "",

        file: null

    }

};


/* =========================================================
   3. DOM REFERENCES
========================================================= */

const chatContent =
    document.getElementById("chatContent");

const dynamicContent =
    document.getElementById("dynamicContent");

const mainMenu =
    document.getElementById("mainMenu");

const welcomeCard =
    document.getElementById("welcomeCard");

const messageInput =
    document.getElementById("messageInput");

const sendButton =
    document.getElementById("sendButton");

const attachButton =
    document.getElementById("attachButton");

const medicalFileInput =
    document.getElementById("medicalFileInput");

const languageButton =
    document.getElementById("languageButton");

const staffDashboardButton =
    document.getElementById("staffDashboardButton");

const directionsButton =
    document.getElementById("directionsButton");

const callClinicButton =
    document.getElementById("callClinicButton");

const toast =
    document.getElementById("toast");

const toastText =
    document.getElementById("toastText");


/* =========================================================
   4. INITIALIZE APPLICATION
========================================================= */

function initializeApp() {

    setupLanguageButtons();

    setupMenuButtons();

    setupMessageComposer();

    setupUtilityButtons();

    setupFileUpload();

    scrollChatToBottom();

}


/* =========================================================
   5. LANGUAGE BUTTONS
========================================================= */

function setupLanguageButtons() {

    const buttons =
        document.querySelectorAll("[data-language]");

    buttons.forEach((button) => {

        button.addEventListener("click", () => {

            const selectedLanguage =
                button.dataset.language;

            selectLanguage(selectedLanguage);

        });

    });


    languageButton.addEventListener("click", () => {

        if (state.language === "english") {

            selectLanguage("urdu");

        } else {

            selectLanguage("english");

        }

    });

}


/* =========================================================
   6. SELECT LANGUAGE
========================================================= */

function selectLanguage(language) {

    state.language = language;

    if (language === "urdu") {

        addUserMessage("اردو");

        languageButton.textContent =
            "🌐 English";

        addBotMessage(
            "اردو منتخب کر لی گئی ہے۔ آپ نیچے موجود آپشنز استعمال کر سکتے ہیں۔"
        );

    } else {

        addUserMessage("English");

        languageButton.textContent =
            "🌐 اردو";

        addBotMessage(
            "English selected. How may I help you today?"
        );

    }

    welcomeCard.classList.add("hidden");

    showMainMenu();

}


/* =========================================================
   7. SHOW MAIN MENU
========================================================= */

function showMainMenu() {

    clearDynamicContent();

    state.currentStep = "main-menu";

    mainMenu.classList.remove("hidden");

    scrollChatToBottom();

}


/* =========================================================
   8. HIDE MAIN MENU
========================================================= */

function hideMainMenu() {

    mainMenu.classList.add("hidden");

}


/* =========================================================
   9. SETUP MENU BUTTONS
========================================================= */

function setupMenuButtons() {

    const serviceButtons =
        document.querySelectorAll(".service-option");

    serviceButtons.forEach((button) => {

        button.addEventListener("click", () => {

            const action =
                button.dataset.action;

            handleMenuAction(action);

        });

    });

}


/* =========================================================
   10. HANDLE MENU ACTION
========================================================= */

function handleMenuAction(action) {

    hideMainMenu();

    clearDynamicContent();

    switch (action) {

        case "bookAppointment":

            addUserMessage(
                "📅 Book Appointment"
            );

            startBooking();

            break;


        case "manageAppointment":

            addUserMessage(
                "🗓️ Manage Appointment"
            );

            showManageAppointment();

            break;


        case "clinicInformation":

            addUserMessage(
                "🏥 Clinic Information"
            );

            showClinicInformation();

            break;


        case "treatmentInformation":

            addUserMessage(
                "🩺 Treatment Information"
            );

            showTreatmentInformation();

            break;


        case "doctorProfile":

            addUserMessage(
                "👨‍⚕️ Doctor Profile"
            );

            showDoctorProfile();

            break;


        case "onlineConsultation":

            addUserMessage(
                "💻 Online Consultation"
            );

            startOnlineConsultation();

            break;


        case "uploadReports":

            addUserMessage(
                "📎 Upload Reports"
            );

            startReportUpload();

            break;


        case "speakToStaff":

            addUserMessage(
                "🎧 Speak to Staff"
            );

            requestStaffHandover();

            break;

    }

}


/* =========================================================
   11. ADD BOT MESSAGE
========================================================= */

function addBotMessage(message) {

    const bubble =
        document.createElement("div");

    bubble.className =
        "bot-message";

    bubble.textContent =
        message;

    dynamicContent.appendChild(bubble);

    scrollChatToBottom();

}


/* =========================================================
   12. ADD USER MESSAGE
========================================================= */

function addUserMessage(message) {

    const bubble =
        document.createElement("div");

    bubble.className =
        "user-message";

    bubble.textContent =
        message;

    dynamicContent.appendChild(bubble);

    scrollChatToBottom();

}


/* =========================================================
   13. CREATE CHAT CARD
========================================================= */

function createChatCard(title, htmlContent = "") {

    const card =
        document.createElement("article");

    card.className =
        "chat-card";

    card.innerHTML = `

        <h4>${title}</h4>

        ${htmlContent}

    `;

    dynamicContent.appendChild(card);

    scrollChatToBottom();

    return card;

}


/* =========================================================
   14. CREATE ACTION BUTTON
========================================================= */

function createActionButton(
    text,
    onClick,
    className = "chat-option"
) {

    const button =
        document.createElement("button");

    button.type =
        "button";

    button.className =
        className;

    button.textContent =
        text;

    button.addEventListener(
        "click",
        onClick
    );

    return button;

}


/* =========================================================
   15. CLEAR DYNAMIC CONTENT
========================================================= */

function clearDynamicContent() {

    dynamicContent.innerHTML = "";

}


/* =========================================================
   16. SCROLL CHAT
========================================================= */

function scrollChatToBottom() {

    setTimeout(() => {

        chatContent.scrollTop =
            chatContent.scrollHeight;

    }, 50);

}


/* =========================================================
   17. START BOOKING
========================================================= */

function startBooking() {

    resetBooking();

    state.currentStep =
        "patient-name";

    createChatCard(
        "Book Appointment",
        `
            <p>
                Please enter the patient's full name.
            </p>
        `
    );

    messageInput.placeholder =
        "Enter patient's full name...";

    messageInput.focus();

}


/* =========================================================
   18. HANDLE PATIENT NAME
========================================================= */

function collectPatientName(name) {

    state.booking.patientName =
        name.trim();

    addUserMessage(
        state.booking.patientName
    );

    state.currentStep =
        "patient-phone";

    addBotMessage(
        "Thank you. Please enter your phone number."
    );

    messageInput.placeholder =
        "Enter phone number...";

}


/* =========================================================
   19. HANDLE PHONE NUMBER
========================================================= */

function collectPhoneNumber(phone) {

    state.booking.phone =
        phone.trim();

    addUserMessage(
        state.booking.phone
    );

    showConsultationType();

}


/* =========================================================
   20. CONSULTATION TYPE
========================================================= */

function showConsultationType() {

    state.currentStep =
        "consultation-type";

    const card =
        createChatCard(

            "Consultation Type",

            `
                <p>
                    How would you like to consult
                    Dr. Muhammad Zaheer Anjum?
                </p>
            `
        );


    const inPerson =
        createActionButton(

            "🏥 In-Person Appointment",

            () => {

                selectConsultationType(
                    "In-Person Appointment"
                );

            }

        );


    const online =
        createActionButton(

            "💻 Online Appointment",

            () => {

                selectConsultationType(
                    "Online Appointment"
                );

            }

        );


    card.appendChild(inPerson);

    card.appendChild(online);

}


/* =========================================================
   21. SELECT CONSULTATION TYPE
========================================================= */

function selectConsultationType(type) {

    state.booking.appointmentType =
        type;

    addUserMessage(type);

    if (
        type ===
        "Online Appointment"
    ) {

        showOnlineAppointmentInformation();

        return;

    }

    showClinicSelection();

}


/* =========================================================
   22. ONLINE APPOINTMENT INFO
========================================================= */

function showOnlineAppointmentInformation() {

    const card =
        createChatCard(

            "Online Consultation",

            `
                <p>
                    Your appointment will be registered
                    as an online consultation request.
                </p>
            `
        );


    const continueButton =
        createActionButton(

            "Continue",

            () => {

                showAppointmentDates();

            }

        );


    card.appendChild(
        continueButton
    );

}


/* =========================================================
   23. CLINIC SELECTION
========================================================= */

function showClinicSelection() {
    state.currentStep = "clinic-selection";

    const card = createChatCard(
        "City Selection",
        `<p>Which clinic location would you like to visit?</p>`
    );

    const cities = [
        { name: "Lahore", label: "📍 Stay Young Clinic, Lahore", address: "DHA Phase 5, Bedian Road, Lahore" },
        { name: "Karachi", label: "📍 Stay Young Clinic, Karachi", address: "Clifton Block 5, Karachi" },
        { name: "Islamabad", label: "📍 Stay Young Clinic, Islamabad", address: "F-7 Markaz, Islamabad" },
        { name: "Faisalabad", label: "📍 Stay Young Clinic, Faisalabad", address: "Civil Lines, Faisalabad" },
        { name: "Gujranwala", label: "📍 Stay Young Clinic, Gujranwala", address: "DC Road, Gujranwala" },
        { name: "Multan", label: "📍 Stay Young Clinic, Multan", address: "Abdali Road, Multan" }
    ];

    cities.forEach(c => {
        card.appendChild(createActionButton(c.label, () => selectClinic(c.name, c.label, c.address)));
    });
}

/* =========================================================
   24. SELECT CLINIC
========================================================= */

function selectClinic(cityName, clinicLabel, address) {
    state.booking.city = cityName || "Lahore";
    state.booking.clinic = clinicLabel || "Stay Young Clinic, Lahore";

    addUserMessage(clinicLabel || "Stay Young Clinic, Lahore");

    createChatCard(
        clinicLabel || "Stay Young Clinic",
        `
            <p><strong>Address:</strong> ${address || CONFIG.clinic.address}</p>
            <p><strong>Schedule:</strong> ${CONFIG.clinic.schedule}</p>
        `
    );

    showAppointmentDates();
}


/* =========================================================
   25. APPOINTMENT DATES
========================================================= */

function showAppointmentDates() {

    state.currentStep =
        "appointment-date";

    const card =
        createChatCard(

            "Select Appointment Date",

            `
                <p>
                    Please select your preferred
                    appointment date.
                </p>
            `
        );


    const dates =
        generateAvailableDates();


    dates.forEach((date) => {

        const button =
            createActionButton(

                `📅 ${date.label}`,

                () => {

                    selectAppointmentDate(
                        date.value,
                        date.label
                    );

                }

            );


        card.appendChild(
            button
        );

    });

}


/* =========================================================
   26. GENERATE FRONTEND DEMO DATES

   Backend will later replace this method.
========================================================= */

function generateAvailableDates() {

    const dates = [];

    const currentDate =
        new Date();


    for (
        let dayOffset = 1;
        dayOffset <= 7;
        dayOffset++
    ) {

        const date =
            new Date(currentDate);

        date.setDate(
            currentDate.getDate() +
            dayOffset
        );


        /*
         Clinic is Monday-Saturday.
         Skip Sunday.
        */

        if (
            date.getDay() === 0
        ) {

            continue;

        }


        const label =
            date.toLocaleDateString(
                "en-GB",
                {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                }
            );


        dates.push({

            value:
                date.toISOString()
                    .split("T")[0],

            label

        });

    }


    return dates;

}


/* =========================================================
   27. SELECT DATE
========================================================= */

function selectAppointmentDate(
    value,
    label
) {

    state.booking.date =
        value;

    addUserMessage(
        `📅 ${label}`
    );

    showAppointmentTimes();

}


/* =========================================================
   28. SHOW AVAILABLE TIMES

   These are FRONTEND DEMO slots only.

   Backend will later return actual available,
   blocked and booked slots.
========================================================= */

async function showAppointmentTimes() {

    state.currentStep =
        "appointment-time";

    const card =
        createChatCard(

            "Select Appointment Time",

            `
                <p>
                    Please select an available
                    consultation time.
                </p>
            `
        );

    let timeSlots = [
        "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM",
        "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM",
        "4:00 PM", "4:30 PM", "5:00 PM", "5:30 PM",
        "6:00 PM", "6:30 PM", "7:00 PM", "7:30 PM"
    ];

    try {
        const res = await fetch(`http://localhost:5000/api/appointments/slots?date=${state.booking.date}`);
        const json = await res.json();
        if (json.success && json.data && Array.isArray(json.data.slots)) {
            timeSlots = json.data.slots;
        }
    } catch (e) {
        console.warn("Using default frontend slot generator fallback.");
    }

    if (timeSlots.length === 0) {
        const p = document.createElement("p");
        p.style.color = "var(--danger)";
        p.textContent = "No available slots for this date. Please select another date.";
        card.appendChild(p);
        return;
    }

    timeSlots.forEach((time) => {

        const button =
            createActionButton(

                `🕒 ${time}`,

                () => {

                    selectAppointmentTime(
                        time
                    );

                }

            );

        card.appendChild(
            button
        );

    });

}


/* =========================================================
   29. SELECT APPOINTMENT TIME
========================================================= */

function selectAppointmentTime(time) {

    state.booking.time =
        time;

    addUserMessage(
        `🕒 ${time}`
    );

    showBookingReview();

}


/* =========================================================
   30. BOOKING REVIEW
========================================================= */

function showBookingReview() {

    state.currentStep =
        "booking-review";


    const clinicText =

        state.booking.appointmentType ===
        "Online Appointment"

            ? "Online Consultation"

            : state.booking.clinic;


    const card =
        createChatCard(

            "Please Confirm Your Appointment",

            `

                <div class="booking-review">

                    <p>
                        <strong>Patient:</strong>
                        ${state.booking.patientName}
                    </p>

                    <p>
                        <strong>Phone Number:</strong>
                        ${state.booking.phone}
                    </p>

                    <p>
                        <strong>Appointment Type:</strong>
                        ${state.booking.appointmentType}
                    </p>

                    <p>
                        <strong>Clinic:</strong>
                        ${clinicText}
                    </p>

                    <p>
                        <strong>Date:</strong>
                        ${formatDate(
                            state.booking.date
                        )}
                    </p>

                    <p>
                        <strong>Time:</strong>
                        ${state.booking.time}
                    </p>

                </div>

            `
        );


    const confirmButton =
        createActionButton(

            "✅ Confirm Appointment",

            confirmAppointment

        );


    const changeButton =
        createActionButton(

            "✏️ Change Details",

            restartBooking

        );


    const cancelButton =
        createActionButton(

            "❌ Cancel",

            cancelCurrentBooking

        );


    card.appendChild(
        confirmButton
    );

    card.appendChild(
        changeButton
    );

    card.appendChild(
        cancelButton
    );

}


/* =========================================================
   31. CONFIRM APPOINTMENT

   For now this is FRONTEND simulation.
   Backend API will replace saving later.
========================================================= */

async function confirmAppointment(btnEvent) {
    const btn = (btnEvent && btnEvent.target) ? btnEvent.target : document.querySelector('.action-btn-confirm');
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Confirming...";
    }

    try {
        const response = await fetch("http://localhost:5000/api/appointments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                patientName: state.booking.patientName,
                phone: state.booking.phone,
                appointmentType: state.booking.appointmentType,
                clinic: state.booking.clinic || "Stay Young Clinic, Lahore",
                city: "Lahore",
                date: state.booking.date,
                time: state.booking.time
            })
        });

        const json = await response.json();

        if (json.success && json.data) {
            state.booking.token = json.data.tokenNumber;
            state.booking.appointmentId = json.data.appointmentId;
        } else {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "✅ Confirm Appointment";
            }
            showToast(json.message || "Selected appointment slot is no longer available. Please choose another time.");
            showAppointmentTimes();
            return;
        }
    } catch (e) {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "✅ Confirm Appointment";
        }
        showToast("Unable to confirm your appointment. Please try again or contact clinic staff.");
        return;
    }

    state.currentStep = "booking-confirmed";

    clearDynamicContent();

    const card = createChatCard(
        "✅ Appointment Confirmed",
        `
            <p>
                Your appointment with Dr. Muhammad Zaheer Anjum has been confirmed successfully.
            </p>
            <br>
            <p><strong>Patient:</strong> ${state.booking.patientName}</p>
            <p><strong>Phone Number:</strong> ${state.booking.phone}</p>
            <p><strong>Appointment Type:</strong> ${state.booking.appointmentType}</p>
            <p><strong>Clinic:</strong> ${state.booking.clinic || "Stay Young Clinic, Lahore"}</p>
            <p><strong>Date:</strong> ${formatDate(state.booking.date)}</p>
            <p><strong>Time:</strong> ${state.booking.time}</p>
            <p><strong>Token Number:</strong> ${state.booking.token}</p>
            <p><strong>Appointment ID:</strong> ${state.booking.appointmentId}</p>
        `
    );

    card.classList.add("success-card");

    const viewButton = createActionButton("📋 View Appointment", viewCurrentAppointment);
    const mainMenuButton = createActionButton("🏠 Main Menu", showMainMenu);

    card.appendChild(viewButton);
    card.appendChild(mainMenuButton);

    showToast("Appointment Confirmed & Saved Successfully!");
}


/* =========================================================
   32. GENERATE TOKEN
========================================================= */

function generateTokenNumber() {

    const number =
        Math.floor(
            Math.random() * 999
        ) + 1;


    return String(number)
        .padStart(3, "0");

}


/* =========================================================
   33. GENERATE APPOINTMENT ID
========================================================= */

function generateAppointmentId() {

    const year =
        new Date().getFullYear();


    const random =
        Math.floor(
            1000 +
            Math.random() * 9000
        );


    return `MZA-${year}-${random}`;

}


/* =========================================================
   34. VIEW CURRENT APPOINTMENT
========================================================= */

function viewCurrentAppointment() {

    clearDynamicContent();


    const card =
        createChatCard(

            "Appointment Details",

            `

                <p>
                    <strong>Token:</strong>
                    ${state.booking.token}
                </p>

                <p>
                    <strong>Appointment ID:</strong>
                    ${state.booking.appointmentId}
                </p>

                <p>
                    <strong>Patient:</strong>
                    ${state.booking.patientName}
                </p>

                <p>
                    <strong>Phone:</strong>
                    ${state.booking.phone}
                </p>

                <p>
                    <strong>Type:</strong>
                    ${state.booking.appointmentType}
                </p>

                <p>
                    <strong>Date:</strong>
                    ${formatDate(
                        state.booking.date
                    )}
                </p>

                <p>
                    <strong>Time:</strong>
                    ${state.booking.time}
                </p>

            `
        );


    card.appendChild(

        createActionButton(

            "🏠 Main Menu",

            showMainMenu

        )

    );

}


/* =========================================================
   35. RESTART BOOKING
========================================================= */

function restartBooking() {

    clearDynamicContent();

    startBooking();

}


/* =========================================================
   36. CANCEL BOOKING
========================================================= */

function cancelCurrentBooking() {

    resetBooking();

    clearDynamicContent();


    addBotMessage(
        "Your appointment booking has been cancelled."
    );


    const card =
        createChatCard(
            "What would you like to do next?"
        );


    card.appendChild(

        createActionButton(

            "📅 Book Appointment",

            startBooking

        )

    );


    card.appendChild(

        createActionButton(

            "🏠 Main Menu",

            showMainMenu

        )

    );

}


/* =========================================================
   37. RESET BOOKING
========================================================= */

function resetBooking() {

    state.booking = {

        patientName: "",

        phone: "",

        appointmentType: "",

        clinic: "",

        date: "",

        time: "",

        token: "",

        appointmentId: ""

    };

}


/* =========================================================
   38. MANAGE APPOINTMENT
========================================================= */

function showManageAppointment() {

    state.currentStep =
        "manage-appointment";


    const card =
        createChatCard(

            "Manage Appointment",

            `

                <p>
                    Enter your appointment ID,
                    token number or registered
                    phone number.
                </p>

            `
        );


    const input =
        document.createElement("input");


    input.type =
        "text";

    input.className =
        "manage-search-input";

    input.placeholder =
        "Appointment ID / Token / Phone";


    input.style.width =
        "100%";

    input.style.height =
        "40px";

    input.style.marginTop =
        "8px";

    input.style.padding =
        "0 10px";

    input.style.border =
        "1px solid #DCE7E3";

    input.style.borderRadius =
        "10px";


    card.appendChild(input);


    const searchButton =
        createActionButton(

            "Search Appointment",

            () => {

                searchAppointment(
                    input.value
                );

            }

        );


    card.appendChild(
        searchButton
    );


    card.appendChild(

        createActionButton(

            "🏠 Main Menu",

            showMainMenu

        )

    );

}


/* =========================================================
   39. SEARCH APPOINTMENT

   Backend implementation comes later.
========================================================= */

function searchAppointment(query) {

    if (!query.trim()) {

        showToast(
            "Please enter appointment information."
        );

        return;

    }


    addBotMessage(
        "Appointment search will connect to the clinic database in the backend step."
    );

}


/* =========================================================
   40. CLINIC INFORMATION
========================================================= */

function showClinicInformation() {

    const card =
        createChatCard(

            "Stay Young Clinic, Lahore",

            `

                <p>
                    <strong>Address:</strong>
                    ${CONFIG.clinic.address}
                </p>

                <p>
                    <strong>Schedule:</strong>
                    ${CONFIG.clinic.schedule}
                </p>

                <p>
                    <strong>Phone / WhatsApp:</strong>
                    +92 321 3733332
                </p>

            `
        );


    card.appendChild(

        createActionButton(

            "📍 Get Directions",

            openClinicDirections

        )

    );


    card.appendChild(

        createActionButton(

            "📞 Call Clinic",

            callClinic

        )

    );


    card.appendChild(

        createActionButton(

            "🏠 Main Menu",

            showMainMenu

        )

    );

}


/* =========================================================
   41. TREATMENT INFORMATION
========================================================= */

function showTreatmentInformation() {

    const card =
        createChatCard(

            "Treatment Information",

            `

                <p>
                    <strong>
                        Pain Management
                    </strong>
                </p>

                <p>
                    Back and neck pain,
                    joint pain, arthritis,
                    headaches, chronic pain,
                    pelvic and orofacial pain,
                    and palliative pain consultation.
                </p>

                <br>

                <p>
                    <strong>
                        Regenerative Medicine
                    </strong>
                </p>

                <p>
                    PRP, regenerative joint
                    consultation, shockwave,
                    ozone and other doctor-led
                    regenerative options.
                </p>

                <br>

                <p>
                    <strong>
                        Wellness & Aesthetics
                    </strong>
                </p>

                <p>
                    IV wellness consultation,
                    hair and skin PRP,
                    Botox, fillers and related
                    medical-aesthetics services.
                </p>

            `
        );


    card.appendChild(

        createActionButton(

            "📅 Book Appointment",

            startBooking

        )

    );


    card.appendChild(

        createActionButton(

            "🏠 Main Menu",

            showMainMenu

        )

    );

}


/* =========================================================
   42. DOCTOR PROFILE
========================================================= */

function showDoctorProfile() {

    const card =
        createChatCard(

            "Dr. Muhammad Zaheer Anjum",

            `

                <p>
                    Pain Management,
                    Regenerative Medicine
                    and Medical Aesthetics.
                </p>

                <br>

                <p>
                    <strong>Qualifications</strong>
                </p>

                <p>
                    MBBS (UHS, 2013)
                </p>

                <p>
                    FAAOT
                    (American Academy of Ozonotherapy, 2017)
                </p>

                <p>
                    Stem Cell Certification
                    (Global Stem Cells Group, 2019)
                </p>

                <p>
                    DMRD
                    (University of Lahore, 2023)
                </p>

                <p>
                    Diplomate of the American Board
                    of Regenerative Medicine
                    — DABRM (2024)
                </p>

                <br>

                <p>
                    <strong>Clinic:</strong>
                    Stay Young Clinic, Lahore
                </p>

            `
        );


    card.appendChild(

        createActionButton(

            "📅 Book Appointment",

            startBooking

        )

    );


    card.appendChild(

        createActionButton(

            "🏠 Main Menu",

            showMainMenu

        )

    );

}


/* =========================================================
   43. ONLINE CONSULTATION
========================================================= */

function startOnlineConsultation() {

    resetBooking();

    state.booking.appointmentType =
        "Online Appointment";

    state.currentStep =
        "patient-name";


    createChatCard(

        "Online Consultation",

        `

            <p>
                Please enter the patient's
                full name to start your
                virtual clinic request.
            </p>

        `
    );


    messageInput.placeholder =
        "Enter patient's full name...";

    messageInput.focus();

}


/* =========================================================
   44. REPORT UPLOAD START
========================================================= */

function startReportUpload() {

    state.currentStep =
        "report-type";


    const card =
        createChatCard(

            "Upload Medical Report",

            `

                <p>
                    Please select the type
                    of medical report you
                    would like to upload.
                </p>

            `
        );


    const reportTypes = [

        "MRI Scan",

        "X-Ray",

        "Prescription",

        "Laboratory Report",

        "Discharge Summary",

        "Other Report"

    ];


    reportTypes.forEach((type) => {

        card.appendChild(

            createActionButton(

                type,

                () => {

                    selectReportType(
                        type
                    );

                }

            )

        );

    });


    card.appendChild(

        createActionButton(

            "🏠 Main Menu",

            showMainMenu

        )

    );

}


/* =========================================================
   45. SELECT REPORT TYPE
========================================================= */

function selectReportType(type) {

    state.report.type =
        type;

    addUserMessage(type);

    showReportUploadForm();

}


/* =========================================================
   46. REPORT UPLOAD FORM
========================================================= */

function showReportUploadForm() {

    clearDynamicContent();


    const card =
        createChatCard(

            "Upload Medical Report",

            `

                <form class="chat-form" id="reportForm">
                    <label>Patient Phone Number</label>
                    <input type="text" id="reportPhone" placeholder="03001234567" required>

                    <label>Token Number</label>
                    <input type="text" id="reportToken" placeholder="Token Number (e.g. 009)" required>

                    <label>Appointment ID (Optional)</label>
                    <input type="text" id="reportAppointmentId" placeholder="e.g. MZA-2026-1001">

                    <label>Medical Document</label>
                    <button type="button" class="chat-option" id="chooseReportFile">
                        📎 Choose PDF / JPG / JPEG / PNG
                    </button>
                    <p id="selectedFileName" style="margin-top:8px;">No file selected</p>
                </form>
            `
        );

    const uploadButton = createActionButton("Upload Document Now", submitReportUpload, "primary-action");
    card.appendChild(uploadButton);
    card.appendChild(createActionButton("🏠 Main Menu", showMainMenu));

    document.getElementById("chooseReportFile")?.addEventListener("click", () => {
        medicalFileInput.click();
    });
}

/* =========================================================
   47. SUBMIT REPORT
========================================================= */

async function submitReportUpload() {
    const phone = document.getElementById("reportPhone")?.value.trim();
    const token = document.getElementById("reportToken")?.value.trim();
    const appointmentId = document.getElementById("reportAppointmentId")?.value.trim();

    if (!phone || !token || !state.report.file) {
        showToast("Please enter your phone number, token number, and attach a medical document.");
        return;
    }

    state.report.phone = phone;
    state.report.token = token;

    // Validate file type and size
    const allowedExts = [".pdf", ".jpg", ".jpeg", ".png"];
    const fileName = state.report.file.name.toLowerCase();
    const isAllowed = allowedExts.some(ext => fileName.endsWith(ext));
    if (!isAllowed) {
        showToast("Invalid file format. Only PDF, JPG, JPEG, and PNG files are allowed.");
        return;
    }

    if (state.report.file.size > 10 * 1024 * 1024) {
        showToast("File size exceeds 10MB limit. Please upload a smaller file.");
        return;
    }

    const formData = new FormData();
    formData.append("phone", phone);
    formData.append("token", token);
    formData.append("appointmentId", appointmentId || token);
    formData.append("reportType", state.report.type || "Other Report");
    formData.append("reportFile", state.report.file);

    try {
        const response = await fetch("http://localhost:5000/api/reports", {
            method: "POST",
            body: formData
        });
        const json = await response.json();
        if (json.success) {
            showReportUploadSuccess(json.data);
            showToast("Report Uploaded & Synced with Admin Panel");
        } else {
            showToast(json.message || "Unable to upload report. Please try again.");
        }
    } catch (e) {
        showToast("Unable to upload medical report. Please check server connection.");
    }
}

/* =========================================================
   48. REPORT SUCCESS
========================================================= */

function showReportUploadSuccess(reportData) {
    clearDynamicContent();

    const tokenText = state.report.token ? `<p><strong>Appointment / Token:</strong> ${state.report.token}</p>` : "";

    const card = createChatCard(
        "✅ Report Uploaded Successfully",
        `
            <p>
                Your medical report has been securely uploaded and saved.
            </p>
            <br>
            <p><strong>Report Type:</strong> ${state.report.type}</p>
            <p><strong>File Name:</strong> ${state.report.file.name}</p>
            ${tokenText}
        `
    );

    card.classList.add("success-card");

    card.appendChild(createActionButton("Upload Another Report", startReportUpload));
    card.appendChild(createActionButton("🏠 Main Menu", showMainMenu));

    showToast("Report Uploaded & Synced with Admin Panel");
}


/* =========================================================
   49. FILE UPLOAD
========================================================= */

function setupFileUpload() {

    medicalFileInput.addEventListener(
        "change",
        () => {

            const file =
                medicalFileInput.files[0];


            if (!file) {

                return;

            }


            const maximumSize =
                10 * 1024 * 1024;


            if (
                file.size >
                maximumSize
            ) {

                showToast(
                    "Maximum file size is 10MB."
                );

                medicalFileInput.value =
                    "";

                return;

            }


            state.report.file =
                file;


            const label =
                document.getElementById(
                    "selectedFileName"
                );


            if (label) {

                label.textContent =
                    `Selected: ${file.name}`;

            }

        }
    );


    attachButton.addEventListener(
        "click",
        () => {

            startReportUpload();

        }
    );

}


/* =========================================================
   50. STAFF HANDOVER
========================================================= */

function requestStaffHandover() {

    const card =
        createChatCard(

            "Speak to Staff",

            `

                <p>
                    Your request can be transferred
                    to a human clinic assistant.
                </p>

            `
        );


    card.appendChild(

        createActionButton(

            "Request Human Assistant",

            () => {

                addUserMessage(
                    "Request Human Assistant"
                );

                addBotMessage(
                    "Your staff assistance request has been recorded."
                );

                showToast(
                    "Staff handover requested."
                );

            }

        )

    );


    card.appendChild(

        createActionButton(

            "🏠 Main Menu",

            showMainMenu

        )

    );

}


/* =========================================================
   51. MESSAGE COMPOSER
========================================================= */

function setupMessageComposer() {

    sendButton.addEventListener(
        "click",
        sendTypedMessage
    );


    messageInput.addEventListener(
        "keydown",
        (event) => {

            if (
                event.key === "Enter"
            ) {

                sendTypedMessage();

            }

        }
    );

}


/* =========================================================
   52. SEND TYPED MESSAGE
========================================================= */

function sendTypedMessage() {

    const message =
        messageInput.value.trim();


    if (!message) {

        return;

    }


    messageInput.value = "";


    switch (
        state.currentStep
    ) {


        case "patient-name":

            collectPatientName(
                message
            );

            break;


        case "patient-phone":

            collectPhoneNumber(
                message
            );

            break;


        default:

            addUserMessage(
                message
            );

            addBotMessage(
                "Please use one of the available options so I can assist you correctly."
            );

    }

}


/* =========================================================
   53. UTILITY BUTTONS
========================================================= */

function setupUtilityButtons() {

    directionsButton
        ?.addEventListener(
            "click",
            openClinicDirections
        );


    callClinicButton
        ?.addEventListener(
            "click",
            callClinic
        );


    staffDashboardButton
        ?.addEventListener(
            "click",
            () => {
                window.location.href = "../admin/admin.html";
            }
        );

}


/* =========================================================
   54. DIRECTIONS
========================================================= */

function openClinicDirections() {

    const location =
        encodeURIComponent(
            CONFIG.clinic.address
        );


    window.open(

        `https://www.google.com/maps/search/?api=1&query=${location}`,

        "_blank"

    );

}


/* =========================================================
   55. CALL CLINIC
========================================================= */

function callClinic() {

    window.location.href =
        `tel:${CONFIG.clinic.phone}`;

}


/* =========================================================
   56. FORMAT DATE
========================================================= */

function formatDate(dateString) {

    if (!dateString) {

        return "";

    }


    const date =
        new Date(
            `${dateString}T00:00:00`
        );


    return date.toLocaleDateString(

        "en-GB",

        {

            weekday: "long",

            day: "2-digit",

            month: "long",

            year: "numeric"

        }

    );

}


/* =========================================================
   57. SHOW TOAST
========================================================= */

function showToast(message) {

    toastText.textContent =
        message;


    toast.classList.remove(
        "hidden"
    );


    clearTimeout(
        showToast.timer
    );


    showToast.timer =
        setTimeout(
            () => {

                toast.classList.add(
                    "hidden"
                );

            },
            2800
        );

}


/* =========================================================
   58. START APPLICATION
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    initializeApp
);

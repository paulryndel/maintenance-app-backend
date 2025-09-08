document.addEventListener('DOMContentLoaded', function() {
    // --- STATE MANAGEMENT ---
    let state = {
        loggedInTechnician: null,
        technicianId: null,
        photoURL: null,
        currentView: 'login', // 'login', 'homepage', 'checklist'
        customers: [],
        drafts: [],
        completed: [],
        activeChecklist: {
            isDraft: false,
            draftID: null,
            customerID: null,
            customerName: null,
            data: {}
        }
    };
    let clockInterval = null;

    // --- DOM ELEMENTS ---
    const views = {
        login: document.getElementById('login-view'),
        app: document.getElementById('app-container'),
        homepage: document.getElementById('homepage-view'),
        checklist: document.getElementById('checklist-view'),
    };
    const loginForm = document.getElementById('login-form');
    const userDisplay = document.getElementById('loggedInUserDisplay');
    const techPhoto = document.getElementById('technicianPhoto');
    const clockDisplay = document.getElementById('dateTimeClock');
    const homepageLoader = document.getElementById('homepage-loader');
    const startNewSection = document.getElementById('start-new-section');
    const draftsSection = document.getElementById('drafts-section');
    const completedSection = document.getElementById('completed-section');
    const backToHomeBtn = document.getElementById('back-to-home');
    const saveDraftBtn = document.getElementById('save-draft-button');
    const submitBtn = document.getElementById('submit-button');
    const modal = document.getElementById('submissionModal');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.getElementById('closeModal');

    // --- RENDER FUNCTIONS ---
    function render() {
        // Hide all main views
        Object.values(views).forEach(v => v.classList.add('hidden'));

        if (state.currentView === 'login') {
            views.login.classList.remove('hidden');
        } else {
            views.app.classList.remove('hidden');
            if (state.currentView === 'homepage') {
                views.homepage.classList.remove('hidden');
                renderHomepage();
            } else if (state.currentView === 'checklist') {
                views.checklist.classList.remove('hidden');
                renderChecklistPage();
            }
        }
    }

    function renderHomepage() {
        homepageLoader.classList.remove('hidden');
        ['start-new-section', 'drafts-section', 'completed-section'].forEach(id => document.getElementById(id).classList.add('hidden'));

        fetchHomepageData().then(() => {
            // Render Start New Section
            let startNewHTML = `
                <h2 class="section-title">Start New Checklist</h2>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">`;
            state.customers.forEach(cust => {
                startNewHTML += `<div class="info-card cursor-pointer start-new-card" data-customer-id="${cust.CustomerID}" data-customer-name="${cust.CustomerName}">
                    <p class="font-bold">${cust.CustomerName}</p>
                    <p class="text-sm text-gray-600">${cust.MachineType} - ${cust.SerialNo}</p>
                    <p class="text-xs text-gray-500">${cust.Country}</p>
                </div>`;
            });
            startNewHTML += `</div>`;
            startNewSection.innerHTML = startNewHTML;

            // Render Drafts Section
            draftsSection.innerHTML = `<h2 class="section-title">In-Progress Drafts</h2>`;
            if (state.drafts.length > 0) {
                let draftsHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">`;
                state.drafts.forEach(draft => {
                    draftsHTML += `<div class="info-card cursor-pointer draft-card" data-draft-id='${JSON.stringify(draft)}'>
                        <p class="font-bold">${draft.CustomerName || 'N/A'}</p>
                        <p class="text-sm text-gray-600">Last saved: ${new Date(draft.InspectedDate).toLocaleDateString()}</p>
                    </div>`;
                });
                draftsHTML += `</div>`;
                draftsSection.innerHTML += draftsHTML;
            } else {
                draftsSection.innerHTML += `<p class="text-gray-500 mt-4">No drafts found.</p>`;
            }

            // Render Completed Section
            completedSection.innerHTML = `<h2 class="section-title">Completed Checklists</h2>`;
            if (state.completed.length > 0) {
                let completedHTML = `<div class="space-y-2 mt-4">`;
                 state.completed.forEach(item => {
                    completedHTML += `<div class="info-card">
                        <p class="font-bold">${item.CustomerName || 'N/A'}</p>
                        <p class="text-sm text-gray-600">Completed on: ${new Date(item.InspectedDate).toLocaleDateString()}</p>
                    </div>`;
                });
                completedHTML += `</div>`;
                completedSection.innerHTML += completedHTML;
            } else {
                completedSection.innerHTML += `<p class="text-gray-500 mt-4">No completed checklists found.</p>`;
            }

            homepageLoader.classList.add('hidden');
            startNewSection.classList.remove('hidden');
            draftsSection.classList.remove('hidden');
            completedSection.classList.remove('hidden');
        });
    }

    function renderChecklistPage() {
        document.getElementById('checklist-customer-name').textContent = state.activeChecklist.customerName;
        // Logic to pre-fill the checklist form if it's a draft would go here
        // For now, we just render the empty checklist
        renderChecklistItems(state.activeChecklist.data);
    }

    function renderChecklistItems(data = {}) {
        const checklistBody = document.getElementById('checklist-body');
        checklistBody.innerHTML = '';
        let itemNumber = 1;
        checklistData.forEach(section => {
            checklistBody.innerHTML += `<tr class="bg-gray-100"><td colspan="9" class="px-6 py-3 font-bold text-brand-navy">${section.category}</td></tr>`;
            section.items.forEach(item => {
                const actionName = `action-row-${itemNumber}`;
                const savedValue = data[item.id] || '';
                const [savedAction, savedResult] = savedValue.split(' - ');
                
                let radioButtonsHTML = ['N', 'A', 'C', 'R', 'I'].map(action => `
                    <td class="text-center py-4">
                        <input type="radio" id="${actionName}-${action}" name="${actionName}" value="${action}" class="input-radio" ${savedAction === action ? 'checked' : ''}>
                    </td>`).join('');

                checklistBody.innerHTML += `
                    <tr class="border-b border-gray-200 hover:bg-gray-100" data-item-id="${item.id}">
                        <td class="px-4 py-4 text-center text-gray-500">${itemNumber}</td>
                        <td class="px-6 py-4">${item.text}</td>
                        ${radioButtonsHTML}
                        <td class="px-6 py-4">
                            <input type="text" class="input-field result-input w-full" placeholder="Result..." value="${savedResult || ''}">
                        </td>
                    </tr>`;
                itemNumber++;
            });
        });
    }

    // --- API & DATA FUNCTIONS ---
    async function fetchHomepageData() {
        try {
            const response = await fetch(`/api/getHomepageData?technicianId=${state.technicianId}`);
            if (!response.ok) throw new Error('Failed to load dashboard data.');
            const data = await response.json();
            state.customers = data.customers;
            state.drafts = data.drafts;
            state.completed = data.completed;
        } catch (error) {
            console.error(error);
            showModal('Error', error.message);
        }
    }

    function collectChecklistData() {
        const data = {
            CustomerID: state.activeChecklist.customerID,
            Technician: state.loggedInTechnician,
            TechnicianID: state.technicianId,
            InspectedDate: new Date().toISOString().split('T')[0],
        };
        document.querySelectorAll('#checklistTable tbody tr[data-item-id]').forEach(row => {
            const itemId = row.dataset.itemId;
            const selectedAction = row.querySelector(`input[type="radio"]:checked`);
            const resultText = row.querySelector('.result-input').value;
            data[itemId] = selectedAction ? `${selectedAction.value} - ${resultText}` : resultText;
        });
        return data;
    }
    
    // --- EVENT HANDLERS ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        document.getElementById('login-error-message').textContent = 'Checking...';
        try {
            const res = await fetch('/api/login', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ username: loginForm.username.value, password: loginForm.password.value })
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);

            state.loggedInTechnician = result.username;
            state.technicianId = result.technicianId;
            state.photoURL = result.photoURL;
            state.currentView = 'homepage';

            userDisplay.textContent = state.loggedInTechnician;
            if (state.photoURL) techPhoto.src = state.photoURL;
            
            clockInterval = setInterval(updateClock, 1000);
            updateClock();
            render();
        } catch (err) {
            document.getElementById('login-error-message').textContent = err.message;
        } finally {
            btn.disabled = false;
        }
    });

    document.getElementById('homepage-content').addEventListener('click', (e) => {
        const startCard = e.target.closest('.start-new-card');
        const draftCard = e.target.closest('.draft-card');

        if (startCard) {
            state.activeChecklist = {
                isDraft: false, draftID: null,
                customerID: startCard.dataset.customerId,
                customerName: startCard.dataset.customerName,
                data: {}
            };
            state.currentView = 'checklist';
            render();
        }

        if (draftCard) {
            const draftData = JSON.parse(draftCard.dataset.draftId);
            state.activeChecklist = {
                isDraft: true,
                draftID: draftData.DraftID,
                customerID: draftData.CustomerID,
                customerName: draftData.CustomerName,
                data: draftData
            };
            state.currentView = 'checklist';
            render();
        }
    });

    backToHomeBtn.addEventListener('click', () => {
        state.currentView = 'homepage';
        render();
    });

    saveDraftBtn.addEventListener('click', async () => {
        const checklistData = collectChecklistData();
        if (state.activeChecklist.isDraft) {
            checklistData.DraftID = state.activeChecklist.draftID;
        }
        showModal('Saving...', 'Your draft is being saved.');
        try {
            const res = await fetch('/api/saveDraft', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(checklistData)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);

            state.activeChecklist.draftID = result.draftID;
            state.activeChecklist.isDraft = true;
            showModal('Success', 'Your draft has been saved successfully.');
        } catch (err) {
            showModal('Error', err.message);
        }
    });

    submitBtn.addEventListener('click', async () => {
        const btnText = document.getElementById('submitButtonText');
        const spinner = document.getElementById('submitSpinner');
        submitBtn.disabled = true;
        btnText.textContent = 'Submitting...';
        spinner.classList.remove('hidden');

        try {
            const checklistData = collectChecklistData();
            if (state.activeChecklist.isDraft) {
                checklistData.DraftID = state.activeChecklist.draftID;
            }
            
            const res = await fetch('/api/submitChecklist', {
                method: 'POST', headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(checklistData)
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.message);
            
            showModal('Success', 'Checklist submitted successfully!');
            setTimeout(() => {
                modal.classList.add('hidden');
                state.currentView = 'homepage';
                render();
            }, 2000);

        } catch (err) {
            showModal('Error', err.message);
        } finally {
            submitBtn.disabled = false;
            btnText.textContent = 'Finalize & Submit';
            spinner.classList.add('hidden');
        }
    });

    closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));

    // --- UTILITY FUNCTIONS & INITIALIZATION ---
    function showModal(title, message) {
        modalBody.innerHTML = `<h3 class="text-xl font-bold mb-4">${title}</h3><p class="text-gray-700">${message}</p>`;
        modal.classList.remove('hidden');
    }

    const checklistData = [
        { category: 'Pump & Mechanical', items: [
            { text: 'Check the gear pump motor.', id: 'Motor_Check' }, { text: 'Check the oil level of the motor gear.', id: 'Motor_Gear_Oil' }, { text: 'Check the motor gear.', id: 'Motor_Gear_Condition' }, { text: 'Check the packing seal at the gear pump.', id: 'Pump_Seal' }, { text: 'Check for material leakage.', id: 'Material_Leakage' }, { text: 'Check the joint between the pump and drive shaft.', id: 'Shaft_Joint' }, { text: 'Check the gear pump rotation.', id: 'Pump_Rotation' }, { text: 'Check the motor gear mounting.', id: 'Motor_Mounting' }, { text: 'Check the filter screen retainer.', id: 'Filter_Retainer' }, { text: 'Check gear pump cleaning/cleanliness.', id: 'Pump_Cleanliness' }, { text: 'Check the safety pin on the shaft joint.', id: 'Shaft_Safety_Pin' }
        ]},
        { category: 'Heating System', items: [
            { text: 'Check the condition of the heater.', id: 'Heater_Condition' }, { text: 'Check the thermocouple.', id: 'Thermocouple_Check' }, { text: 'Check the temperature controller.', id: 'Temp_Controller' }, { text: 'Check the insulation for heater cables.', id: 'Heater_Cable_Insulation' }, { text: 'Check the heater cable and connection.', id: 'Heater_Cable_Connection' }
        ]},
        { category: 'Electrical & Controls', items: [
            { text: 'Check the inverter of the gear pump motor.', id: 'Motor_Inverter' }, { text: 'Check the closed-loop control for pressure.', id: 'Pressure_Control_Loop' }, { text: 'Check the motor overload circuit breaker.', id: 'Motor_Overload_Breaker' }, { text: 'Check the pressure transducer.', id: 'Pressure_Transducer' }, { text: 'Check the indicator lamps.', id: 'Indicator_Lamps' }, { text: 'Check all switches.', id: 'Switches_Check' }, { text: 'Check the condition of the PC.', id: 'PC_Condition' }
        ]},
        { category: 'Alarms & Safety', items: [
            { text: 'Check the low-temperature alarm.', id: 'Low_Temp_Alarm' }, { text: 'Check the high/low-pressure alarm.', id: 'Pressure_Alarms' }, { text: 'Check the buzzer.', id: 'Buzzer_Check' }, { text: 'Check the emergency stop button.', id: 'Emergency_Stop' }
        ]}
    ];

    // Initial render
    render();
});
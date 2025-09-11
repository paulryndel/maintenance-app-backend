window.addEventListener('error', function(e) {
  const container = document.body;
  if (container.querySelector('.js-error-alert')) return;
  
  const alert = document.createElement('div');
  alert.className = 'fixed bottom-4 left-4 right-4 bg-red-800 text-white p-4 rounded-lg shadow-lg js-error-alert';
  alert.innerHTML = `
    <p class="font-bold">Something went wrong</p>
    <p class="text-sm">${e.message}</p>
    <button class="mt-2 px-4 py-1 bg-white text-red-800 rounded text-sm font-medium">Dismiss</button>
  `;
  
  alert.querySelector('button').addEventListener('click', () => alert.remove());
  container.appendChild(alert);
  
  console.error(e);
});

document.addEventListener('DOMContentLoaded', function() {
    // --- STATE MANAGEMENT ---
    let state = {
        loggedInTechnician: null, technicianId: null, photoURL: null,
        currentView: 'login', // 'login', 'homepage', 'checklist'
        customers: [], drafts: [], completed: [],
        dashboardStats: { customersVisited: 0, machinesChecked: 0, draftsMade: 0 },
        activeChecklist: {
            isDraft: false, draftID: null, customerID: null, customerName: null, data: {}
        },
        isAddingNewCustomer: false
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
    const logoutButton = document.getElementById('logout-button');
    const userDisplay = document.getElementById('loggedInUserDisplay');
    const techPhoto = document.getElementById('technicianPhoto');
    const clockDisplay = document.getElementById('dateTimeClock');
    const homepageLoader = document.getElementById('homepage-loader');
    const dashboardContent = document.getElementById('dashboard-content');
    const draftsSection = document.getElementById('drafts-section');
    const completedSection = document.getElementById('completed-section');
    const backToHomeBtn = document.getElementById('back-to-home');
    const saveDraftBtn = document.getElementById('save-draft-button');
    const submitBtn = document.getElementById('submit-button');
    
    // Start Checklist Modal Elements
    const startChecklistBtn = document.getElementById('start-new-checklist-btn');
    const startChecklistModal = document.getElementById('start-checklist-modal');
    const cancelStartChecklistBtn = document.getElementById('cancel-start-checklist');
    const confirmStartChecklistBtn = document.getElementById('confirm-start-checklist');
    const customerSelect = document.getElementById('customer-select');
    const addNewCustomerBtn = document.getElementById('add-new-customer-btn');
    const backToSelectCustomerBtn = document.getElementById('back-to-select-customer-btn');
    const existingCustomerView = document.getElementById('existing-customer-view');
    const newCustomerView = document.getElementById('new-customer-view');

    const modal = document.getElementById('submissionModal');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.getElementById('closeModal');

    // --- RENDER FUNCTIONS ---
    function render() {
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
        dashboardContent.classList.add('hidden');

        fetchHomepageData().then(() => {
            document.getElementById('customers-visited-stat').textContent = state.dashboardStats.customersVisited;
            document.getElementById('machines-checked-stat').textContent = state.dashboardStats.machinesChecked;
            document.getElementById('drafts-made-stat').textContent = state.dashboardStats.draftsMade;

            let customerOptionsHTML = '<option value="">Choose a customer...</option>';
            state.customers.forEach(cust => {
                customerOptionsHTML += `<option value="${cust.CustomerID}" data-name="${cust.CustomerName}">${cust.CustomerName} (${cust.SerialNo})</option>`;
            });
            customerSelect.innerHTML = customerOptionsHTML;

            draftsSection.innerHTML = `<h2 class="section-title">In-Progress Drafts</h2>`;
            if (state.drafts.length > 0) {
                let draftsHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">`;
                state.drafts.forEach(draft => {
                    draftsHTML += `<div class="info-card cursor-pointer draft-card" data-draft-id='${JSON.stringify(draft)}'>
                        <p class="font-bold">${draft.CustomerName || 'N/A'}</p>
                        <p class="text-sm text-brand-gray">Last saved: ${new Date(draft.InspectedDate).toLocaleDateString()}</p>
                    </div>`;
                });
                draftsHTML += `</div>`;
                draftsSection.innerHTML += draftsHTML;
            } else {
                draftsSection.innerHTML += `<p class="text-brand-gray mt-4">No drafts found.</p>`;
            }

            completedSection.innerHTML = `<h2 class="section-title">Completed Checklists</h2>`;
            if (state.completed.length > 0) {
                let completedHTML = `<div class="space-y-2 mt-4">`;
                 state.completed.slice(0, 5).forEach(item => { // Show last 5
                    completedHTML += `<div class="info-card">
                        <p class="font-bold">${item.CustomerName || 'N/A'}</p>
                        <p class="text-sm text-brand-gray">Completed on: ${new Date(item.InspectedDate).toLocaleDateString()}</p>
                    </div>`;
                });
                completedHTML += `</div>`;
                completedSection.innerHTML += completedHTML;
            } else {
                completedSection.innerHTML += `<p class="text-brand-gray mt-4">No completed checklists found.</p>`;
            }
            
            homepageLoader.classList.add('hidden');
            dashboardContent.classList.remove('hidden');
        });
    }

    function renderChecklistPage() {
        document.getElementById('checklist-customer-name').textContent = state.activeChecklist.customerName;
        renderChecklistItems(state.activeChecklist.data);
    }
    
    function renderChecklistItems(data = {}) {
        const checklistBody = document.getElementById('checklist-body');
        checklistBody.innerHTML = '';
        let itemNumber = 1;
        checklistData.forEach(section => {
            const categoryClass = section.category === 'Heating System' ? 'heating-section-header' : 'bg-gray-100';
            checklistBody.innerHTML += `<tr class="${categoryClass}"><td colspan="9" class="px-6 py-3 font-bold text-brand-dark">${section.category}</td></tr>`;
            section.items.forEach(item => {
                const actionName = `action-row-${itemNumber}`;
                const savedValue = data[item.id] || '';
                const [savedAction, ...savedResultParts] = savedValue.split(' - ');
                const savedResult = savedResultParts.join(' - ');
                
                let radioButtonsHTML = ['N', 'A', 'C', 'R', 'I'].map(action => `
                    <td class="text-center py-4">
                        <input type="radio" id="${actionName}-${action}" name="${actionName}" value="${action}" class="input-radio" ${savedAction === action ? 'checked' : ''}>
                    </td>`).join('');

                checklistBody.innerHTML += `
                    <tr class="border-b border-gray-200 hover:bg-gray-50" data-item-id="${item.id}">
                        <td class="px-4 py-4 text-center text-brand-gray">${itemNumber}</td>
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
            state.dashboardStats = data.stats;
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
            
            saveSession(result); // Save session data
            updateClock();
            clockInterval = setInterval(updateClock, 1000);
            render();
        } catch (err) {
            document.getElementById('login-error-message').textContent = err.message;
        } finally {
            btn.disabled = false;
        }
    });

    logoutButton.addEventListener('click', () => {
        state = { ...state, loggedInTechnician: null, technicianId: null, photoURL: null, currentView: 'login' };
        clearInterval(clockInterval);
        loginForm.reset();
        render();
    });

    dashboardContent.addEventListener('click', (e) => {
        const draftCard = e.target.closest('.draft-card');
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
    
    startChecklistBtn.addEventListener('click', () => {
        state.isAddingNewCustomer = false;
        existingCustomerView.classList.remove('hidden');
        newCustomerView.classList.add('hidden');
        startChecklistModal.classList.remove('hidden');
    });

    cancelStartChecklistBtn.addEventListener('click', () => {
        startChecklistModal.classList.add('hidden');
    });

    addNewCustomerBtn.addEventListener('click', () => {
        state.isAddingNewCustomer = true;
        existingCustomerView.classList.add('hidden');
        newCustomerView.classList.remove('hidden');
    });

    backToSelectCustomerBtn.addEventListener('click', () => {
        state.isAddingNewCustomer = false;
        existingCustomerView.classList.remove('hidden');
        newCustomerView.classList.add('hidden');
    });

    confirmStartChecklistBtn.addEventListener('click', async () => {
        try {
            let customerID, customerName;

            if (state.isAddingNewCustomer) {
                const newCustomerData = {
                    CustomerName: document.getElementById('new-customer-name').value,
                    Country: document.getElementById('new-customer-country').value,
                    MachineType: document.getElementById('new-customer-machinetype').value,
                    SerialNo: document.getElementById('new-customer-serialno').value,
                };
                if (!newCustomerData.CustomerName || !newCustomerData.Country || !newCustomerData.MachineType || !newCustomerData.SerialNo) {
                    throw new Error("All customer fields are required.");
                }

                const res = await fetch('/api/createCustomer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newCustomerData)
                });
                const result = await res.json();
                if (!res.ok) throw new Error(result.message);
                
                customerID = result.customerID;
                customerName = newCustomerData.CustomerName;
            } else {
                const selectedOption = customerSelect.options[customerSelect.selectedIndex];
                if (!selectedOption.value) throw new Error("Please select a customer.");
                customerID = selectedOption.value;
                customerName = selectedOption.dataset.name;
            }

            state.activeChecklist = {
                isDraft: false, draftID: null,
                customerID: customerID,
                customerName: customerName,
                data: {}
            };
            state.currentView = 'checklist';
            startChecklistModal.classList.add('hidden');
            render();

        } catch (error) {
            alert(error.message);
        }
    });

    backToHomeBtn.addEventListener('click', () => { state.currentView = 'homepage'; render(); });

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
    function updateClock() {
        const now = new Date();
        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        const dateString = now.toLocaleDateString(undefined, options);
        const timeString = now.toLocaleTimeString();
        clockDisplay.textContent = `${dateString}, ${timeString}`;
    }

    function showModal(title, message) {
        modalBody.innerHTML = `<h3 class="text-xl font-bold mb-4">${title}</h3><p class="text-brand-gray">${message}</p>`;
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
    
    // --- SESSION MANAGEMENT ---
    function saveSession(userData) {
        localStorage.setItem('maintenanceApp_session', JSON.stringify({
            technicianId: userData.technicianId,
            username: userData.username,
            loggedInAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 hour session
        }));
    }

    function checkExistingSession() {
        try {
            const session = JSON.parse(localStorage.getItem('maintenanceApp_session') || '{}');
            if (session.technicianId && session.expiresAt && new Date(session.expiresAt) > new Date()) {
                // Auto-login with saved session
                state.technicianId = session.technicianId;
                state.loggedInTechnician = session.username;
                userDisplay.textContent = session.username;
                switchView('home');
                updateClock();
                clockInterval = setInterval(updateClock, 1000);
                showToast('info', 'Welcome back');
                return true;
            }
        } catch (e) {
            console.error("Session restore failed:", e);
            localStorage.removeItem('maintenanceApp_session');
        }
        return false;
    }

    // --- DARK MODE FUNCTIONS ---
    function toggleDarkMode() {
        document.documentElement.classList.toggle('dark');
        const isDark = document.documentElement.classList.contains('dark');
        localStorage.setItem('darkMode', isDark ? 'dark' : 'light');
        showToast('info', `${isDark ? 'Dark' : 'Light'} mode activated`);
    }

    // Initialize from saved preference
    function initTheme() {
        if (localStorage.getItem('darkMode') === 'dark' || 
            (!localStorage.getItem('darkMode') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark');
        }
    }

    initTheme(); // Call on load

    render();

    // In checklist page
    function updateCompletionPercent() {
      const items = document.querySelectorAll('tr[data-item-id]');
      const completed = document.querySelectorAll('input[type="radio"]:checked').length;
      const percent = Math.floor((completed / items.length) * 100);
      
      document.getElementById('completion-bar').style.width = `${percent}%`;
      document.getElementById('completion-text').textContent = `${percent}% Complete`;
    }

    // Call after any radio change
    document.addEventListener('change', function(e) {
      if (e.target.matches('input[type="radio"]')) {
        updateCompletionPercent();
      }
    });
});
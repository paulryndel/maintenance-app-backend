document.addEventListener('DOMContentLoaded', function() {
    // --- STATE MANAGEMENT ---
    let state = {
        loggedInTechnician: null, technicianId: null, photoURL: null,
        currentView: 'login', // 'login', 'homepage', 'checklist'
        customers: [], drafts: [], completed: [],
        dashboardStats: { customersVisited: 0, machinesChecked: 0, draftsMade: 0 },
        activeChecklist: {
            isDraft: false, draftID: null, customerID: null, customerName: null, data: {}
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
    const dashboardContent = document.getElementById('dashboard-content');
    const draftsSection = document.getElementById('drafts-section');
    const completedSection = document.getElementById('completed-section');
    const backToHomeBtn = document.getElementById('back-to-home');
    const saveDraftBtn = document.getElementById('save-draft-button');
    const submitBtn = document.getElementById('submit-button');
    const startChecklistBtn = document.getElementById('start-new-checklist-btn');
    const startChecklistModal = document.getElementById('start-checklist-modal');
    const cancelStartChecklistBtn = document.getElementById('cancel-start-checklist');
    const confirmStartChecklistBtn = document.getElementById('confirm-start-checklist');
    const customerSelect = document.getElementById('customer-select');
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
            // Populate Stat Cards
            document.getElementById('customers-visited-stat').textContent = state.dashboardStats.customersVisited;
            document.getElementById('machines-checked-stat').textContent = state.dashboardStats.machinesChecked;
            document.getElementById('drafts-made-stat').textContent = state.dashboardStats.draftsMade;

            // Populate Customer Select Dropdown
            let customerOptionsHTML = '<option value="">Choose a customer...</option>';
            state.customers.forEach(cust => {
                customerOptionsHTML += `<option value="${cust.CustomerID}" data-name="${cust.CustomerName}">${cust.CustomerName} (${cust.SerialNo})</option>`;
            });
            customerSelect.innerHTML = customerOptionsHTML;

            // Render Drafts
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

            // Render Completed
            completedSection.innerHTML = `<h2 class="section-title">Completed Checklists</h2>`;
            if (state.completed.length > 0) {
                let completedHTML = `<div class="space-y-2 mt-4">`;
                 state.completed.slice(0, 5).forEach(item => { // Show last 5
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
            dashboardContent.classList.remove('hidden');
        });
    }
    
    // (renderChecklistPage and renderChecklistItems remain largely the same)

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
    
    // (collectChecklistData remains the same)

    // --- EVENT HANDLERS ---
    // (Login and other handlers are mostly the same)
    
    startChecklistBtn.addEventListener('click', () => {
        startChecklistModal.classList.remove('hidden');
    });

    cancelStartChecklistBtn.addEventListener('click', () => {
        startChecklistModal.classList.add('hidden');
    });

    confirmStartChecklistBtn.addEventListener('click', () => {
        const selectedOption = customerSelect.options[customerSelect.selectedIndex];
        if (!selectedOption.value) {
            alert("Please select a customer.");
            return;
        }
        state.activeChecklist = {
            isDraft: false, draftID: null,
            customerID: selectedOption.value,
            customerName: selectedOption.dataset.name,
            data: {}
        };
        state.currentView = 'checklist';
        startChecklistModal.classList.add('hidden');
        render();
    });

    // --- INITIALIZATION ---
    // (The rest of the JS file remains the same)
    render();
});
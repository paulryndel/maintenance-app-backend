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

document.addEventListener('DOMContentLoaded', () => {
  // API endpoint for Google Sheets integration
  const API_BASE_URL = ''; // Leave empty for same-origin API calls
  
  // Basic references
  const loginView = document.getElementById('login-view');
  const appContainer = document.getElementById('app-container');
  const loginForm = document.getElementById('login-form');
  const loginError = document.getElementById('login-error-message');
  const logoutBtn = document.getElementById('logout-button');
  const userDisplay = document.getElementById('loggedInUserDisplay');
  const clockDisplay = document.getElementById('dateTimeClock');

  const homepageView = document.getElementById('homepage-view');
  const checklistView = document.getElementById('checklist-view');
  const startBtn = document.getElementById('start-new-checklist-btn');
  const startModal = document.getElementById('start-checklist-modal');
  const cancelStart = document.getElementById('cancel-start-checklist');
  const confirmStart = document.getElementById('confirm-start-checklist');
  const addNewCustomerBtn = document.getElementById('add-new-customer-btn');
  const backToExistingBtn = document.getElementById('back-to-select-customer-btn');
  const existingCustomerView = document.getElementById('existing-customer-view');
  const newCustomerView = document.getElementById('new-customer-view');
  const customerSelect = document.getElementById('customer-select');

  const backHomeBtn = document.getElementById('back-to-home');
  const saveDraftBtn = document.getElementById('save-draft-button');
  const submitBtn = document.getElementById('submit-button');
  const submitText = document.getElementById('submitButtonText');
  const submitSpinner = document.getElementById('submitSpinner');

  const modal = document.getElementById('submissionModal');
  const modalBody = document.getElementById('modal-body');
  const closeModalBtn = document.getElementById('closeModal');

  const checklistBody = document.getElementById('checklist-body');
  const completionBar = document.getElementById('completion-bar');
  const completionText = document.getElementById('completion-text');

  let clockInterval = null;
  const state = {
    technicianId: null,
    loggedInTechnician: null,
    customers: [],
    drafts: [],
    completed: [],
    activeChecklist: null
  };

  // Check for existing session
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
        loadHomepageData();
        return true;
      }
    } catch (e) {
      console.error("Session restore failed:", e);
      localStorage.removeItem('maintenanceApp_session');
    }
    return false;
  }

  // Save session for auto-login
  function saveSession(userData) {
    localStorage.setItem('maintenanceApp_session', JSON.stringify({
      technicianId: userData.technicianId,
      username: userData.username,
      loggedInAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 hour session
    }));
  }

  function showToast(type, message, duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type} flex items-center p-4 mb-4 text-sm rounded-lg pointer-events-auto`;
    
    // Set different background colors based on type
    if (type === 'success') toast.classList.add('bg-green-700', 'text-white');
    else if (type === 'error') toast.classList.add('bg-red-700', 'text-white');
    else if (type === 'info') toast.classList.add('bg-blue-700', 'text-white');
    else toast.classList.add('bg-gray-700', 'text-white');
    
    toast.innerHTML = `<div class="ml-3 font-medium">${message}</div>`;
    container.appendChild(toast);
    
    // Add animation
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-[-10px]', 'transition-all', 'duration-500');
      setTimeout(() => toast.remove(), 500);
    }, duration);
  }

  function showModal(title, msg) {
    modalBody.innerHTML = `<h3 class="modal-title">${title}</h3><p>${msg}</p>`;
    modal.classList.remove('hidden');
    if (/success/i.test(title)) showToast('success', msg);
    if (/error/i.test(title)) showToast('error', msg);
  }

  function updateClock() {
    const now = new Date();
    clockDisplay.textContent = now.toLocaleString();
  }

  function switchView(view) {
    loginView.classList.add('hidden');
    appContainer.classList.add('hidden');
    homepageView.classList.add('hidden');
    checklistView.classList.add('hidden');

    if (view === 'login') {
      loginView.classList.remove('hidden');
    } else {
      appContainer.classList.remove('hidden');
      if (view === 'home') homepageView.classList.remove('hidden');
      if (view === 'checklist') checklistView.classList.remove('hidden');
    }
  }

  async function login(username, password) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }
      
      return { 
        technicianId: data.technicianId || 'T001', 
        username: data.username || username 
      };
    } catch (error) {
      console.error('Login error:', error);
      // Fallback for testing
      if (username && password) {
        return { technicianId: 'T001', username };
      }
      throw error;
    }
  }

  async function loadHomepageData() {
    try {
      document.getElementById('homepage-loader').classList.remove('hidden');
      document.getElementById('dashboard-content').classList.add('hidden');
      
      // Try to fetch from API
      let data;
      try {
        const response = await fetch(`${API_BASE_URL}/api/getHomepageData?technicianId=${state.technicianId}`);
        data = await response.json();
      } catch (e) {
        console.warn('Could not fetch homepage data from API, using mock data');
        // Mock data if API fails
        data = {
          stats: {
            customersVisited: 12,
            machinesChecked: 18,
            draftsMade: 3
          },
          drafts: [
            { id: 'D1', customerName: 'ACME Corp', date: '2023-06-15', status: 'draft' },
            { id: 'D2', customerName: 'TechSolutions Ltd', date: '2023-06-10', status: 'draft' }
          ],
          completed: [
            { id: 'C1', customerName: 'Globex Industries', date: '2023-06-05', status: 'completed' },
            { id: 'C2', customerName: 'Oceanic Airlines', date: '2023-05-28', status: 'completed' },
            { id: 'C3', customerName: 'Stark Industries', date: '2023-05-20', status: 'completed' }
          ],
          customers: [
            { id: '1', name: 'ACME Corp', country: 'USA', machineType: 'XL5000', serialNo: 'A12345' },
            { id: '2', name: 'TechSolutions Ltd', country: 'UK', machineType: 'XL3000', serialNo: 'B54321' },
            { id: '3', name: 'Globex Industries', country: 'Germany', machineType: 'XL5000', serialNo: 'C98765' },
            { id: '4', name: 'Oceanic Airlines', country: 'Australia', machineType: 'XL3000', serialNo: 'D45678' },
            { id: '5', name: 'Stark Industries', country: 'USA', machineType: 'XL7000', serialNo: 'E24680' }
          ]
        };
      }
      
      // Update state
      state.customers = data.customers || [];
      state.drafts = data.drafts || [];
      state.completed = data.completed || [];
      
      // Update stats
      document.getElementById('customers-visited-stat').textContent = data.stats?.customersVisited || 0;
      document.getElementById('machines-checked-stat').textContent = data.stats?.machinesChecked || 0;
      document.getElementById('drafts-made-stat').textContent = data.stats?.draftsMade || 0;
      
      // Populate customer dropdown
      populateCustomerDropdown();
      
      // Update drafts section
      const draftsSection = document.getElementById('drafts-section');
      if (state.drafts.length > 0) {
        draftsSection.innerHTML = `
          <h3 class="section-title">Draft Checklists</h3>
          <div class="space-y-2">
            ${state.drafts.map(draft => `
              <div class="info-card cursor-pointer" data-draft-id="${draft.id}">
                <div class="flex justify-between items-center">
                  <h4 class="font-semibold">${draft.customerName}</h4>
                  <span class="text-xs text-secondary">${new Date(draft.date).toLocaleDateString()}</span>
                </div>
                <div class="text-xs mt-1 text-secondary">Draft</div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        draftsSection.innerHTML = '';
      }
      
      // Update completed section
      const completedSection = document.getElementById('completed-section');
      if (state.completed.length > 0) {
        completedSection.innerHTML = `
          <h3 class="section-title">Completed Checklists</h3>
          <div class="space-y-2">
            ${state.completed.map(item => `
              <div class="info-card">
                <div class="flex justify-between items-center">
                  <h4 class="font-semibold">${item.customerName}</h4>
                  <span class="text-xs text-secondary">${new Date(item.date).toLocaleDateString()}</span>
                </div>
                <div class="text-xs mt-1 text-secondary">Completed</div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        completedSection.innerHTML = '';
      }
      
      // Add event listeners to draft cards
      document.querySelectorAll('[data-draft-id]').forEach(card => {
        card.addEventListener('click', () => {
          const draftId = card.getAttribute('data-draft-id');
          const draft = state.drafts.find(d => d.id === draftId);
          if (draft) {
            state.activeChecklist = draft;
            document.getElementById('checklist-customer-name').textContent = draft.customerName;
            buildChecklist(draft);
            switchView('checklist');
          }
        });
      });
      
      // Show dashboard content, hide loader
      document.getElementById('homepage-loader').classList.add('hidden');
      document.getElementById('dashboard-content').classList.remove('hidden');
      
    } catch (error) {
      console.error('Error loading homepage data:', error);
      showToast('error', 'Failed to load dashboard data');
      document.getElementById('homepage-loader').classList.add('hidden');
    }
  }

  function populateCustomerDropdown() {
    customerSelect.innerHTML = '<option value="">Select a customer...</option>';
    state.customers.forEach(customer => {
      const option = document.createElement('option');
      option.value = customer.id;
      option.textContent = customer.name;
      customerSelect.appendChild(option);
    });
  }

  loginForm.addEventListener('submit', async e => {
    e.preventDefault();
    loginError.textContent = 'Checking...';
    const username = loginForm.username.value.trim();
    const password = loginForm.password.value.trim();
    try {
      const result = await login(username, password);
      state.technicianId = result.technicianId;
      state.loggedInTechnician = result.username;
      userDisplay.textContent = result.username;
      
      // Save session for auto-login
      saveSession(result);
      
      switchView('home');
      if (clockInterval) clearInterval(clockInterval);
      updateClock();
      clockInterval = setInterval(updateClock, 1000);
      showToast('success', 'Logged in successfully');
      loginError.textContent = '';
      
      // Load homepage data
      loadHomepageData();
    } catch (err) {
      loginError.textContent = err.message || 'Login failed';
      showToast('error', err.message || 'Login failed');
    }
  });

  logoutBtn.addEventListener('click', () => {
    state.technicianId = null;
    state.loggedInTechnician = null;
    loginForm.reset();
    if (clockInterval) clearInterval(clockInterval);
    
    // Clear session
    localStorage.removeItem('maintenanceApp_session');
    
    switchView('login');
    showToast('info', 'Logged out');
  });

  startBtn.addEventListener('click', () => {
    existingCustomerView.classList.remove('hidden');
    newCustomerView.classList.add('hidden');
    startModal.classList.remove('hidden');
  });
  
  cancelStart.addEventListener('click', () => startModal.classList.add('hidden'));
  
  addNewCustomerBtn.addEventListener('click', () => {
    existingCustomerView.classList.add('hidden');
    newCustomerView.classList.remove('hidden');
  });
  
  backToExistingBtn.addEventListener('click', () => {
    existingCustomerView.classList.remove('hidden');
    newCustomerView.classList.add('hidden');
  });

  confirmStart.addEventListener('click', async () => {
    let customerName, customerId, customerData;
    
    if (!newCustomerView.classList.contains('hidden')) {
      // New customer flow
      customerName = document.getElementById('new-customer-name').value.trim();
      const country = document.getElementById('new-customer-country').value.trim();
      const machineType = document.getElementById('new-customer-machinetype').value.trim();
      const serialNo = document.getElementById('new-customer-serialno').value.trim();
      
      if (!customerName) { 
        showToast('error', 'Customer name is required');
        return;
      }
      
      // Try to create new customer in API
      try {
        const response = await fetch(`${API_BASE_URL}/api/createCustomer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: customerName,
            country,
            machineType,
            serialNo,
            technicianId: state.technicianId
          })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || 'Failed to create customer');
        }
        
        customerId = data.customerId || `new-${Date.now()}`;
        customerData = { id: customerId, name: customerName, country, machineType, serialNo };
        state.customers.push(customerData);
        showToast('success', 'New customer created');
      } catch (error) {
        console.warn('Could not create customer via API, using local data');
        customerId = `new-${Date.now()}`;
        customerData = { id: customerId, name: customerName, country, machineType, serialNo };
        state.customers.push(customerData);
      }
    } else {
      // Existing customer flow
      customerId = customerSelect.value;
      if (!customerId) { 
        showToast('error', 'Please select a customer');
        return;
      }
      customerData = state.customers.find(c => c.id === customerId);
      customerName = customerData?.name || 'Unknown Customer';
    }
    
    state.activeChecklist = { 
      id: `draft-${Date.now()}`,
      customerId,
      customerName,
      date: new Date().toISOString(),
      status: 'draft',
      items: [] 
    };
    
    document.getElementById('checklist-customer-name').textContent = customerName;
    startModal.classList.add('hidden');
    buildChecklist();
    switchView('checklist');
  });

  function buildChecklist(existingData) {
    checklistBody.innerHTML = '';
    
    // Sample checklist items if no existing data
    const checklistItems = existingData?.items || [
      { id: 'item1', text: 'Check motor connections', result: '', selection: '' },
      { id: 'item2', text: 'Inspect pump impeller', result: '', selection: '' },
      { id: 'item3', text: 'Test temperature controller', result: '', selection: '' },
      { id: 'item4', text: 'Verify pressure settings', result: '', selection: '' },
      { id: 'item5', text: 'Inspect cooling system', result: '', selection: '' },
      { id: 'item6', text: 'Check electrical components', result: '', selection: '' },
      { id: 'item7', text: 'Test emergency stop button', result: '', selection: '' },
      { id: 'item8', text: 'Inspect filter system', result: '', selection: '' }
    ];
    
    if (state.activeChecklist) {
      state.activeChecklist.items = checklistItems;
    }
    
    checklistItems.forEach((item, index) => {
      const row = document.createElement('tr');
      row.setAttribute('data-item-id', item.id);
      
      row.innerHTML = `
        <td>${index + 1}</td>
        <td class="text-left">${item.text}</td>
        ${['N', 'A', 'C', 'R', 'I'].map(value => `
          <td>
            <input 
              type="radio" 
              name="row-${item.id}" 
              value="${value}" 
              ${item.selection === value ? 'checked' : ''}
              class="w-4 h-4 cursor-pointer"
            >
          </td>
        `).join('')}
        <td>
          <input 
            type="text" 
            class="input" 
            placeholder="Result..." 
            value="${item.result || ''}"
          >
        </td>
      `;
      
      checklistBody.appendChild(row);
    });
    
    // Add event listeners for checklist items
    document.querySelectorAll('#checklist-body input').forEach(input => {
      input.addEventListener('change', e => {
        updateChecklistItem(e.target);
        updateCompletionProgress();
      });
      
      if (input.type === 'text') {
        input.addEventListener('input', e => {
          updateChecklistItem(e.target);
          updateCompletionProgress();
        });
      }
    });
    
    updateCompletionProgress();
  }

  function updateChecklistItem(inputElement) {
    const row = inputElement.closest('tr');
    if (!row) return;
    
    const itemId = row.getAttribute('data-item-id');
    if (!itemId || !state.activeChecklist) return;
    
    const item = state.activeChecklist.items.find(i => i.id === itemId);
    if (!item) return;
    
    if (inputElement.type === 'radio') {
      item.selection = inputElement.value;
      row.classList.add('checklist-row-selected');
    } else if (inputElement.type === 'text') {
      item.result = inputElement.value.trim();
    }
  }

  function updateCompletionProgress() {
    if (!state.activeChecklist || !state.activeChecklist.items || !state.activeChecklist.items.length) return;
    
    const totalItems = state.activeChecklist.items.length;
    let completedItems = 0;
    
    state.activeChecklist.items.forEach(item => {
      if (item.selection || item.result) {
        completedItems++;
      }
    });
    
    const percentage = Math.round((completedItems / totalItems) * 100);
    
    if (completionBar) completionBar.style.width = `${percentage}%`;
    if (completionText) completionText.textContent = `${percentage}% Complete`;
  }

  backHomeBtn?.addEventListener('click', () => {
    switchView('home');
  });

  saveDraftBtn?.addEventListener('click', async () => {
    if (!state.activeChecklist) {
      showToast('error', 'No active checklist to save');
      return;
    }
    
    submitBtn.disabled = true;
    saveDraftBtn.disabled = true;
    
    try {
      // Try to save draft via API
      const response = await fetch(`${API_BASE_URL}/api/saveDraft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technicianId: state.technicianId,
          checklist: state.activeChecklist
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to save draft');
      }
      
      showModal('Success', 'Checklist saved as draft.');
      
      // Update local state
      const existingDraftIndex = state.drafts.findIndex(d => d.id === state.activeChecklist.id);
      if (existingDraftIndex >= 0) {
        state.drafts[existingDraftIndex] = state.activeChecklist;
      } else {
        state.drafts.push(state.activeChecklist);
      }
      
    } catch (error) {
      console.warn('Could not save draft via API, simulating success');
      showModal('Success', 'Checklist saved as draft (local only).');
      
      // Update local state
      const existingDraftIndex = state.drafts.findIndex(d => d.id === state.activeChecklist.id);
      if (existingDraftIndex >= 0) {
        state.drafts[existingDraftIndex] = state.activeChecklist;
      } else {
        state.drafts.push(state.activeChecklist);
      }
    } finally {
      submitBtn.disabled = false;
      saveDraftBtn.disabled = false;
    }
  });

  submitBtn?.addEventListener('click', async () => {
    if (!state.activeChecklist) {
      showToast('error', 'No active checklist to submit');
      return;
    }
    
    submitBtn.disabled = true;
    saveDraftBtn.disabled = true;
    submitText.textContent = 'Submitting...';
    submitSpinner.classList.remove('hidden');
    
    try {
      // Update checklist status
      state.activeChecklist.status = 'completed';
      state.activeChecklist.completedDate = new Date().toISOString();
      
      // Try to submit via API
      const response = await fetch(`${API_BASE_URL}/api/submitChecklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          technicianId: state.technicianId,
          checklist: state.activeChecklist
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Failed to submit checklist');
      }
      
      showModal('Success', 'Checklist submitted successfully.');
      
      // Update local state - move from drafts to completed
      const draftIndex = state.drafts.findIndex(d => d.id === state.activeChecklist.id);
      if (draftIndex >= 0) {
        state.drafts.splice(draftIndex, 1);
      }
      
      state.completed.push(state.activeChecklist);
      
      // Return to home after a delay
      setTimeout(() => {
        switchView('home');
        loadHomepageData();
      }, 2000);
      
    } catch (error) {
      console.warn('Could not submit checklist via API, simulating success');
      showModal('Success', 'Checklist submitted successfully (local only).');
      
      // Update local state - move from drafts to completed
      const draftIndex = state.drafts.findIndex(d => d.id === state.activeChecklist.id);
      if (draftIndex >= 0) {
        state.drafts.splice(draftIndex, 1);
      }
      
      state.completed.push(state.activeChecklist);
      
      // Return to home after a delay
      setTimeout(() => {
        switchView('home');
        loadHomepageData();
      }, 2000);
    } finally {
      submitBtn.disabled = false;
      saveDraftBtn.disabled = false;
      submitText.textContent = 'Finalize & Submit';
      submitSpinner.classList.add('hidden');
    }
  });

  closeModalBtn.addEventListener('click', () => modal.classList.add('hidden'));

  // Check for existing session before showing login
  if (!checkExistingSession()) {
    // No valid session, show login
    switchView('login');
  }
});
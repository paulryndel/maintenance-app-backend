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
        isAddingNewCustomer: false,
        editingPhotoForItem: null
    };
    let clockInterval = null;
    let fabricCanvas = null;

    // --- DOM ELEMENTS ---
    const views = {
        login: document.getElementById('login-view'),
        app: document.getElementById('app-container'),
        homepage: document.getElementById('homepage-view'),
        checklist: document.getElementById('checklist-view'),
    };
    const loginForm = document.getElementById('login-form');
    const backHomeButton = document.getElementById('back-home-button');
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
    // ...existing code...
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

    const photoInput = document.getElementById('issue-photo');
    const uploadStatus = document.getElementById('upload-status');
    const photoUrlInput = document.getElementById('issue-photo-url');

    const editorModal = document.getElementById('image-editor-modal');
    const editorCanvasEl = document.getElementById('image-editor-canvas');
    const addCircleBtn = document.getElementById('editor-add-circle');
    const addTextBtn = document.getElementById('editor-add-text');
    const deleteSelectedBtn = document.getElementById('editor-delete-selected');
    const clearEditsBtn = document.getElementById('editor-clear');
    const cancelEditorBtn = document.getElementById('editor-cancel');
    const saveAndUploadBtn = document.getElementById('editor-save-upload');

    const photoViewerModal = document.getElementById('photo-viewer-modal');
    const photoViewerTitle = document.getElementById('photo-viewer-title');
    const photoViewerBody = document.getElementById('photo-viewer-body');
    const photoViewerCloseBtn = document.getElementById('photo-viewer-close');

    const mobileTabBar = document.getElementById('mobile-tab-bar');
    const searchBar = document.getElementById('search-bar');
    let searchQuery = '';


    // --- RENDER FUNCTIONS ---
    function render() {
        Object.values(views).forEach(v => v.classList.add('hidden'));
        // Hide both header rows by default
        document.getElementById('homepage-header-row').style.display = 'none';
        document.getElementById('other-header-row').style.display = 'none';
        if (state.currentView === 'login') {
            views.login.classList.remove('hidden');
            if (mobileTabBar) mobileTabBar.classList.add('hidden');
        } else {
            views.app.classList.remove('hidden');
            if (state.currentView === 'homepage') {
                views.homepage.classList.remove('hidden');
                if (mobileTabBar) mobileTabBar.classList.remove('hidden');
                // Show homepage header row (logo + search)
                document.getElementById('homepage-header-row').style.display = 'flex';
                document.getElementById('other-header-row').style.display = 'none';
                renderHomepage();
            } else if (state.currentView === 'checklist') {
                views.checklist.classList.remove('hidden');
                if (mobileTabBar) mobileTabBar.classList.add('hidden');
                // Show other header row (user info + logout)
                document.getElementById('homepage-header-row').style.display = 'none';
                document.getElementById('other-header-row').style.display = 'flex';
                renderChecklistPage();
            } else {
                // For any other view, show other header row
                document.getElementById('homepage-header-row').style.display = 'none';
                document.getElementById('other-header-row').style.display = 'flex';
            }
        }
    }

    if (searchBar) {
        searchBar.addEventListener('input', function(e) {
            searchQuery = e.target.value.trim().toLowerCase();
            renderHomepage();
        });
    }

    function filterItems(items) {
        if (!searchQuery) return items;
        return items.filter(item => {
            return (
                (item.CustomerName && item.CustomerName.toLowerCase().includes(searchQuery)) ||
                (item.MachineType && item.MachineType.toLowerCase().includes(searchQuery)) ||
                (item.SerialNo && item.SerialNo.toLowerCase().includes(searchQuery))
            );
        });
    }

    function renderHomepage() {
        // Always show counters, even during loading
        document.getElementById('customers-visited-stat').textContent = state.dashboardStats.customersVisited;
        document.getElementById('machines-checked-stat').textContent = state.dashboardStats.machinesChecked;
        document.getElementById('drafts-made-stat').textContent = state.dashboardStats.draftsMade;

        homepageLoader.classList.remove('hidden');
        dashboardContent.classList.add('hidden');

        fetchHomepageData().then(() => {
            // Counters already set above, so don't hide them
            dashboardContent.classList.remove('hidden');
            homepageLoader.classList.add('hidden');

            let customerOptionsHTML = '<option value="">Choose a customer...</option>';
            state.customers.forEach(cust => {
                customerOptionsHTML += `<option value="${cust.CustomerID}" data-name="${cust.CustomerName}">${cust.CustomerName} (${cust.SerialNo})</option>`;
            });
            customerSelect.innerHTML = customerOptionsHTML;

            // Filter drafts and completed by search
            const filteredDrafts = filterItems(state.drafts);
            const filteredCompleted = filterItems(state.completed);

            draftsSection.innerHTML = `<h2 class="section-title">In-Progress Drafts</h2>`;
            let draftsHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">`;
            if (filteredDrafts.length > 0) {
                filteredDrafts.forEach(draft => {
                    draftsHTML += `<div class="info-card cursor-pointer draft-card" data-draft-id='${JSON.stringify(draft)}'>
                        <p class="font-bold">${draft.CustomerName || 'N/A'}</p>
                        <p class="text-sm text-brand-gray">Model: ${draft.MachineType || 'N/A'}</p>
                        <p class="text-sm text-brand-gray">Serial: ${draft.SerialNo || 'N/A'}</p>
                        <p class="text-xs text-brand-gray mt-2">Last saved: ${new Date(draft.InspectedDate).toLocaleDateString()}</p>
                    </div>`;
                });
            } else {
                draftsHTML += `<p class="text-brand-gray mt-4">No drafts found.</p>`;
            }
            draftsHTML += `</div>`;
            draftsSection.innerHTML += draftsHTML;

            completedSection.innerHTML = `<h2 class="section-title">Completed Checklists</h2>`;
            let completedHTML = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">`;
            if (filteredCompleted.length > 0) {
                filteredCompleted.forEach(item => {
                    completedHTML += `<div class="info-card">
                        <p class="font-bold">${item.CustomerName || 'N/A'}</p>
                        <p class="text-sm text-brand-gray">Completed on: ${new Date(item.InspectedDate).toLocaleDateString()}</p>
                        <button class="button-secondary export-pdf-btn mt-2" data-checklist-id="${item.ChecklistID}">Export PDF</button>
                    </div>`;
                });
            } else {
                completedHTML += `<p class="text-brand-gray mt-4">No completed checklists found.</p>`;
            }
            completedHTML += `</div>`;
            completedSection.innerHTML += completedHTML;
        });
    }

    function renderChecklistPage() {
        document.getElementById('checklist-customer-name').textContent = state.activeChecklist.customerName;
        photoInput.value = '';
        photoUrlInput.value = state.activeChecklist.data.PhotoURL || '';
        uploadStatus.textContent = photoUrlInput.value ? 'Photo attached.' : '';
        renderChecklistItems(state.activeChecklist.data);
    }
    
    function renderChecklistItems(data = {}) {
        const checklistBody = document.getElementById('checklist-body');
        checklistBody.innerHTML = '';
        let itemNumber = 1;
        checklistData.forEach(section => {
            const categoryClass = section.category === 'Heating System' ? 'heating-section-header' : 'bg-gray-100';
            checklistBody.innerHTML += `<tr class="${categoryClass}"><td colspan="10" class="px-6 py-3 font-bold text-brand-dark">${section.category}</td></tr>`;
            section.items.forEach(item => {
                const actionName = `action-row-${itemNumber}`;
                
                let savedAction = '', savedResult = '', savedPhotos = [];
                if (data[item.id]) {
                    try {
                        const itemData = JSON.parse(data[item.id]);
                        if (typeof itemData === 'object' && itemData !== null) {
                            savedAction = itemData.status || '';
                            savedResult = itemData.result || '';
                            if (itemData.photos) {
                                savedPhotos = itemData.photos.map(photo => {
                                    if (photo.includes('drive.google.com')) {
                                        const fileId = new URL(photo).searchParams.get('id');
                                        return `/api/getImage?fileId=${fileId}`;
                                    }
                                    return photo;
                                });
                            }
                        }
                    } catch (e) {
                        console.error(`Error parsing data for item ${item.id}:`, data[item.id], e);
                        // Fallback for old string format if necessary
                        [savedAction, ...savedResultParts] = String(data[item.id]).split(' - ');
                        savedResult = savedResultParts.join(' - ');
                    }
                }

                let radioButtonsHTML = ['N', 'A', 'C', 'R', 'I'].map(action => `
                    <td class="text-center py-4">
                        <input type="radio" id="${actionName}-${action}" name="${actionName}" value="${action}" class="input-radio" ${savedAction === action ? 'checked' : ''}>
                    </td>`).join('');

                let photoThumbnailsHTML = savedPhotos.map(url => `
                    <div class="thumbnail-wrapper">
                        <img src="${url}" alt="thumbnail" class="photo-thumbnail w-24 h-24 object-cover rounded-md border" data-full-url="${url}" referrerpolicy="no-referrer">
                        <button class="delete-photo-btn" data-url-to-delete="${url}">×</button>
                    </div>
                `).join('');

                checklistBody.innerHTML += `
                    <tr class="border-b border-gray-200 hover:bg-gray-50" data-item-id="${item.id}" data-item-text="${item.text}">
                        <td class="px-4 py-4 text-center text-brand-gray">${itemNumber}</td>
                        <td class="px-6 py-4">${item.text}</td>
                        ${radioButtonsHTML}
                        <td class="px-6 py-4">
                            <input type="text" class="input-field result-input w-full" placeholder="Result..." value="${savedResult || ''}">
                        </td>
                        <td class="px-4 py-4 text-center">
                            <div class="flex flex-col items-end gap-2">
                                <button class="add-photo-btn button-secondary text-xs" data-item-id="${item.id}">+ Photo</button>
                                <div class="photo-thumbnail-container" id="photos-for-${item.id}">${photoThumbnailsHTML}</div>
                            </div>
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
            InspectedDate: state.activeChecklist.data?.InspectedDate || new Date().toISOString().split('T')[0],
            PhotoURL: document.getElementById('issue-photo-url').value || ''
        };

        document.querySelectorAll('#checklistTable tbody tr[data-item-id]').forEach(row => {
            const itemId = row.dataset.itemId;
            const selectedAction = row.querySelector(`input[type="radio"]:checked`);
            const resultText = row.querySelector('.result-input').value;
            
            const photoURLs = Array.from(row.querySelectorAll('.photo-thumbnail')).map(img => img.dataset.fullUrl);

            // This is the important change: Stringify the object for each item
            data[itemId] = JSON.stringify({
                status: selectedAction ? selectedAction.value : '',
                result: resultText,
                photos: photoURLs
            });
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
            if (!res.ok) {
                const text = await res.text();
                try {
                    const json = JSON.parse(text);
                    throw new Error(json.message || 'Login failed.');
                } catch (jsonError) {
                    throw new Error(text || 'An unknown login error occurred.');
                }
            }
            const result = await res.json();

            state.loggedInTechnician = result.username;
            state.technicianId = result.technicianId;
            state.photoURL = result.photoURL;
            state.currentView = 'homepage';

            userDisplay.textContent = state.loggedInTechnician;
            setTechnicianPhoto(state.loggedInTechnician, state.photoURL);
            
            updateClock();
            clockInterval = setInterval(updateClock, 1000);
            render();
        } catch (err) {
            document.getElementById('login-error-message').textContent = err.message;
        } finally {
            btn.disabled = false;
        }
    });

    if (backHomeButton) {
        backHomeButton.addEventListener('click', () => {
            state.currentView = 'homepage';
            render();
        });
    }

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
    
    function updateImageSrc(src) {
        if (src.includes('drive.google.com')) {
            const fileId = new URL(src).searchParams.get('id');
            return `/api/getImage?fileId=${fileId}`;
        }
        return src;
    }

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
            if (!res.ok) throw new Error(result.message || 'Failed to save draft.');
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
            if (!res.ok) throw new Error(result.message || 'Internal Server Error.');
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

    // --- EVENT DELEGATION FOR CHECKLIST ---
    document.getElementById('checklistTable').addEventListener('click', (e) => {
        if (e.target.classList.contains('add-photo-btn')) {
            state.editingPhotoForItem = e.target.dataset.itemId;
            photoInput.click();
        }
        else if (e.target.classList.contains('photo-thumbnail')) {
            const row = e.target.closest('tr');
            const itemText = row.dataset.itemText;
            const allThumbnails = row.querySelectorAll('.photo-thumbnail');
            const photoURLs = Array.from(allThumbnails).map(img => img.dataset.fullUrl);
            
            photoViewerTitle.textContent = `Photos for: ${itemText}`;
            photoViewerBody.innerHTML = photoURLs.map(url => `<img src="${url}" class="h-auto rounded-lg mb-4">`).join('');
            photoViewerModal.classList.remove('hidden');
        }
        else if (e.target.classList.contains('delete-photo-btn')) {
            e.target.closest('.thumbnail-wrapper').remove();
        }
    });

    photoViewerCloseBtn.addEventListener('click', () => {
        photoViewerModal.classList.add('hidden');
    });

    // --- IMAGE EDITOR LOGIC ---
    photoInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file || !state.editingPhotoForItem) return;
        const reader = new FileReader();
        reader.onload = (f) => initEditor(f.target.result);
        reader.readAsDataURL(file);
    });

    function initEditor(imgDataUrl) {
        editorModal.classList.remove('hidden');
        if (fabricCanvas) fabricCanvas.dispose();
        fabricCanvas = new fabric.Canvas(editorCanvasEl);

        fabric.Image.fromURL(imgDataUrl, (img) => {
            const modalContent = editorModal.querySelector('.modal-content');
            const maxWidth = modalContent.clientWidth - 48;
            const scale = maxWidth / img.width;
            
            fabricCanvas.setWidth(img.width * scale);
            fabricCanvas.setHeight(img.height * scale);
            img.set({ scaleX: scale, scaleY: scale, selectable: false, evented: false });
            fabricCanvas.setBackgroundImage(img, fabricCanvas.renderAll.bind(fabricCanvas));
        });
    }

    addCircleBtn.addEventListener('click', () => {
        if (!fabricCanvas) return;
        const circle = new fabric.Circle({
            radius: 50, fill: 'transparent', stroke: 'red', strokeWidth: 5,
            left: fabricCanvas.getCenter().left - 50, top: fabricCanvas.getCenter().top - 50,
        });
        fabricCanvas.add(circle);
        fabricCanvas.setActiveObject(circle);
    });

    addTextBtn.addEventListener('click', () => {
        if (!fabricCanvas) return;
        const text = new fabric.IText('Double-click to edit', {
            left: fabricCanvas.getCenter().left - 150, top: fabricCanvas.getCenter().top - 20,
            fill: 'red', fontSize: 40, fontFamily: 'Inter',
        });
        fabricCanvas.add(text);
        fabricCanvas.setActiveObject(text);
        text.enterEditing();
        text.selectAll();
    });

    deleteSelectedBtn.addEventListener('click', () => {
        if (!fabricCanvas) return;
        const activeObject = fabricCanvas.getActiveObject();
        if (activeObject) fabricCanvas.remove(activeObject);
    });

    clearEditsBtn.addEventListener('click', () => {
        if (!fabricCanvas) return;
        const objects = fabricCanvas.getObjects().filter(obj => obj !== fabricCanvas.backgroundImage);
        objects.forEach(obj => fabricCanvas.remove(obj));
    });

    function cleanupEditor() {
        editorModal.classList.add('hidden');
        if (fabricCanvas) {
            fabricCanvas.dispose();
            fabricCanvas = null;
        }
        photoInput.value = '';
        state.editingPhotoForItem = null;
    }

    cancelEditorBtn.addEventListener('click', cleanupEditor);

    saveAndUploadBtn.addEventListener('click', () => {
        if (!fabricCanvas || !state.editingPhotoForItem) return;
        fabricCanvas.discardActiveObject().renderAll();

        fabricCanvas.getElement().toBlob(async (blob) => {
            const editedFile = new File([blob], `edited-photo-${Date.now()}.png`, { type: 'image/png' });
            const formData = new FormData();
            formData.append('image', editedFile);

            const statusDiv = document.getElementById(`photos-for-${state.editingPhotoForItem}`);
            const tempSpinnerId = `spinner-${Date.now()}`;
            
            const spinnerWrapper = document.createElement('div');
            spinnerWrapper.id = tempSpinnerId;
            spinnerWrapper.className = 'thumbnail-wrapper';
            spinnerWrapper.innerHTML = `<div class="spinner" style="width: 48px; height: 48px;"></div>`;
            statusDiv.appendChild(spinnerWrapper);

            try {
                const response = await fetch('/api/uploadImage', { method: 'POST', body: formData });
                const result = await response.json();
                if (!response.ok) throw new Error(result.details || result.error || 'Upload failed');
                
                // Use the new getImage proxy endpoint
                const imageUrl = `/api/getImage?fileId=${result.fileId}`;

                const newThumbnailHTML = `
                    <div class="thumbnail-wrapper">
                        <img src="${imageUrl}" alt="thumbnail" class="photo-thumbnail w-24 h-24 object-cover rounded-md border" data-full-url="${imageUrl}">
                        <button class="delete-photo-btn" data-url-to-delete="${result.fileId}">×</button>
                    </div>`;
                
                const tempSpinner = document.getElementById(tempSpinnerId);
                if (tempSpinner) {
                    tempSpinner.outerHTML = newThumbnailHTML;
                }

            } catch (error) {
                console.error('Error uploading photo:', error);
                alert(`Error uploading photo: ${error.message}`);
                const tempSpinner = document.getElementById(tempSpinnerId);
                if (tempSpinner) tempSpinner.remove();
            } finally {
                cleanupEditor();
            }
        }, 'image/png');
    });

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
    function setTechnicianPhoto(name, photoURL) {
        if (footerTechnicianPhoto) {
            if (photoURL) {
                footerTechnicianPhoto.src = photoURL;
            } else {
                footerTechnicianPhoto.src = 'https://i.postimg.cc/YStWH6PQ/Logo-LT.jpg'; // fallback image
            }
            footerTechnicianPhoto.alt = name || 'Technician';
        }
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
    
    // --- TAB BAR LOGIC ---
    const tabDrafts = document.getElementById('tab-drafts');
    const tabCompleted = document.getElementById('tab-completed');
    let activeTab = 'drafts';

    function showTab(tab) {
        activeTab = tab;
        if (tab === 'drafts') {
            draftsSection.classList.remove('hidden');
            completedSection.classList.add('hidden');
            tabDrafts.classList.add('bg-primary', 'text-white', 'shadow-xl', 'border-t-4', 'border-accent', 'rounded-t-2xl');
            tabDrafts.classList.remove('text-brand-dark', 'bg-brand-gray', 'text-secondary');
            tabCompleted.classList.remove('bg-primary', 'text-white', 'shadow-xl', 'border-t-4', 'border-accent', 'rounded-t-2xl');
            tabCompleted.classList.add('text-brand-dark');
        } else {
            draftsSection.classList.add('hidden');
            completedSection.classList.remove('hidden');
            tabCompleted.classList.add('bg-primary', 'text-white', 'shadow-xl', 'border-t-4', 'border-accent', 'rounded-t-2xl');
            tabCompleted.classList.remove('text-brand-dark', 'bg-brand-gray', 'text-secondary');
            tabDrafts.classList.remove('bg-primary', 'text-white', 'shadow-xl', 'border-t-4', 'border-accent', 'rounded-t-2xl');
            tabDrafts.classList.add('text-brand-dark');
        }
    }

    tabDrafts.addEventListener('click', function() { showTab('drafts'); });
    tabCompleted.addEventListener('click', function() { showTab('completed'); });

    render();
});
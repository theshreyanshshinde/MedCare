// MedCare Medicine Manager
const Medicines = {
    modal: null,
    form: null,
    currentEditId: null,
    selectedType: 'tablet',
    selectedFrequency: 'once',

    pillIcons: {
        tablet: `<svg viewBox="0 0 32 32" fill="currentColor"><rect x="8" y="10" width="16" height="12" rx="6"/></svg>`,
        capsule: `<svg viewBox="0 0 32 32" fill="currentColor"><rect x="6" y="12" width="20" height="8" rx="4"/></svg>`,
        liquid: `<svg viewBox="0 0 32 32" fill="currentColor"><path d="M12 6h8v4l4 14a2 2 0 01-2 2H10a2 2 0 01-2-2l4-14V6z"/></svg>`,
        injection: `<svg viewBox="0 0 32 32" fill="currentColor"><path d="M22 4l6 6-14 14-6-6 14-14zM8 24l-4 4"/></svg>`,
        drops: `<svg viewBox="0 0 32 32" fill="currentColor"><path d="M16 4c-4 6-8 10-8 14a8 8 0 1016 0c0-4-4-8-8-14z"/></svg>`
    },

    init() {
        this.modal = document.getElementById('medicineModal');
        this.form = document.getElementById('medicineForm');
        this.setupEventListeners();
    },

    setupEventListeners() {
        // Add medicine button
        document.getElementById('addMedicineBtn')?.addEventListener('click', () => this.openModal());

        // Form submission
        this.form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveMedicine();
        });

        // Close modal
        this.modal?.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        this.modal?.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeModal());

        // Pill type picker
        document.getElementById('pillTypePicker')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.pill-type');
            if (btn) {
                document.querySelectorAll('.pill-type').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedType = btn.dataset.type;
            }
        });

        // Frequency picker
        document.getElementById('frequencyPicker')?.addEventListener('click', (e) => {
            const btn = e.target.closest('.freq-btn');
            if (btn) {
                document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.selectedFrequency = btn.dataset.freq;
                this.updateTimeSlots();
            }
        });

        // Add time button
        document.getElementById('addTimeBtn')?.addEventListener('click', () => this.addTimeSlot());

        // Search
        document.getElementById('medicineSearch')?.addEventListener('input', (e) => {
            this.render(e.target.value);
        });

        // Listen for updates
        document.addEventListener('medicines-updated', () => this.render());
        document.addEventListener('profile-changed', () => this.render());
    },

    updateTimeSlots() {
        const container = document.getElementById('timeSlots');
        if (!container) return;

        let times = [];
        switch (this.selectedFrequency) {
            case 'once':
                times = ['08:00'];
                break;
            case 'twice':
                times = ['08:00', '20:00'];
                break;
            case 'thrice':
                times = ['08:00', '14:00', '20:00'];
                break;
            case 'custom':
                times = ['08:00'];
                break;
        }

        container.innerHTML = times.map((time, i) => `
            <div class="time-slot">
                <input type="time" class="time-input" value="${time}">
                ${times.length > 1 ? `<button type="button" class="remove-time" onclick="Medicines.removeTimeSlot(this)">×</button>` : ''}
            </div>
        `).join('');
    },

    addTimeSlot() {
        const container = document.getElementById('timeSlots');
        if (!container) return;

        const slot = document.createElement('div');
        slot.className = 'time-slot';
        slot.innerHTML = `
            <input type="time" class="time-input" value="12:00">
            <button type="button" class="remove-time" onclick="Medicines.removeTimeSlot(this)">×</button>
        `;
        container.appendChild(slot);

        // Show remove buttons on all slots if more than one
        const slots = container.querySelectorAll('.time-slot');
        if (slots.length > 1) {
            slots.forEach(s => {
                const removeBtn = s.querySelector('.remove-time');
                if (removeBtn) removeBtn.hidden = false;
            });
        }
    },

    removeTimeSlot(btn) {
        const slot = btn.closest('.time-slot');
        const container = document.getElementById('timeSlots');

        if (container.querySelectorAll('.time-slot').length > 1) {
            slot.remove();
        }

        // Hide remove button if only one slot left
        const remaining = container.querySelectorAll('.time-slot');
        if (remaining.length === 1) {
            const removeBtn = remaining[0].querySelector('.remove-time');
            if (removeBtn) removeBtn.hidden = true;
        }
    },

    openModal(medicineId = null) {
        const currentProfile = Profiles.getCurrentProfile();
        if (!currentProfile) {
            App.showToast('Please select a profile first', 'warning');
            return;
        }

        this.currentEditId = medicineId;
        this.form.reset();

        const title = document.getElementById('medicineModalTitle');

        // Reset type picker
        document.querySelectorAll('.pill-type').forEach(b => b.classList.remove('active'));
        document.querySelector('.pill-type[data-type="tablet"]')?.classList.add('active');
        this.selectedType = 'tablet';

        // Reset frequency
        document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.freq-btn[data-freq="once"]')?.classList.add('active');
        this.selectedFrequency = 'once';

        this.updateTimeSlots();

        if (medicineId) {
            title.textContent = 'Edit Medicine';
            const medicines = Storage.getMedicines();
            const medicine = medicines.find(m => m.id === medicineId);

            if (medicine) {
                document.getElementById('medicineName').value = medicine.name;
                document.getElementById('dosage').value = medicine.dosage || '';
                document.getElementById('quantity').value = medicine.quantity || '';
                document.getElementById('reminderType').value = medicine.reminderType || 'notification';
                document.getElementById('snoozeInterval').value = medicine.snoozeInterval || 10;
                document.getElementById('isCritical').checked = medicine.isCritical || false;
                document.getElementById('notes').value = medicine.notes || '';

                // Set type
                this.selectedType = medicine.type;
                document.querySelectorAll('.pill-type').forEach(b => b.classList.remove('active'));
                document.querySelector(`.pill-type[data-type="${medicine.type}"]`)?.classList.add('active');

                // Set frequency
                this.selectedFrequency = medicine.frequency;
                document.querySelectorAll('.freq-btn').forEach(b => b.classList.remove('active'));
                document.querySelector(`.freq-btn[data-freq="${medicine.frequency}"]`)?.classList.add('active');

                // Set times
                const container = document.getElementById('timeSlots');
                container.innerHTML = medicine.times.map((time, i) => `
                    <div class="time-slot">
                        <input type="time" class="time-input" value="${time}">
                        ${medicine.times.length > 1 ? `<button type="button" class="remove-time" onclick="Medicines.removeTimeSlot(this)">×</button>` : ''}
                    </div>
                `).join('');
            }
        } else {
            title.textContent = 'Add Medicine';
        }

        this.modal.classList.add('open');
    },

    closeModal() {
        this.modal.classList.remove('open');
        this.currentEditId = null;
    },

    saveMedicine() {
        const currentProfile = Profiles.getCurrentProfile();
        if (!currentProfile) {
            App.showToast('Please select a profile first', 'error');
            return;
        }

        const name = document.getElementById('medicineName').value.trim();
        if (!name) {
            App.showToast('Please enter medicine name', 'error');
            return;
        }

        // Collect times
        const timeInputs = document.querySelectorAll('#timeSlots .time-input');
        const times = Array.from(timeInputs).map(input => input.value).filter(t => t);

        if (times.length === 0) {
            App.showToast('Please add at least one schedule time', 'error');
            return;
        }

        const medicine = {
            id: this.currentEditId || Storage.generateId(),
            profileId: currentProfile.id,
            name,
            type: this.selectedType,
            dosage: document.getElementById('dosage').value.trim(),
            quantity: document.getElementById('quantity').value.trim(),
            frequency: this.selectedFrequency,
            times: times.sort(),
            reminderType: document.getElementById('reminderType').value,
            snoozeInterval: parseInt(document.getElementById('snoozeInterval').value),
            isCritical: document.getElementById('isCritical').checked,
            notes: document.getElementById('notes').value.trim(),
            createdAt: this.currentEditId ? undefined : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        Storage.saveMedicine(medicine);
        this.closeModal();
        App.showToast(this.currentEditId ? 'Medicine updated' : 'Medicine added', 'success');

        // Schedule reminders
        Reminders.scheduleMedicineReminders(medicine);
    },

    deleteMedicine(medicineId) {
        if (confirm('Delete this medicine?')) {
            Storage.deleteMedicine(medicineId);
            Reminders.cancelMedicineReminders(medicineId);
            App.showToast('Medicine deleted', 'success');
        }
    },

    render(searchQuery = '') {
        const grid = document.getElementById('medicinesGrid');
        if (!grid) return;

        const currentProfile = Profiles.getCurrentProfile();
        if (!currentProfile) {
            grid.innerHTML = `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                </svg>
                <p>No profile selected</p>
                <span>Create or select a profile to manage medicines</span>
            </div>`;
            return;
        }

        let medicines = Storage.getMedicines(currentProfile.id);

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            medicines = medicines.filter(m =>
                m.name.toLowerCase().includes(query) ||
                m.type.toLowerCase().includes(query)
            );
        }

        if (medicines.length === 0) {
            grid.innerHTML = `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M10.5 20.5L3.5 13.5a4.95 4.95 0 117 -7l7 7a4.95 4.95 0 11-7 7z"/>
                    <path d="M8.5 8.5l7 7"/>
                </svg>
                <p>${searchQuery ? 'No medicines found' : 'No medicines added'}</p>
                <span>${searchQuery ? 'Try a different search' : 'Click "Add Medicine" to start'}</span>
            </div>`;
            return;
        }

        grid.innerHTML = medicines.map(medicine => `
            <div class="medicine-card" data-medicine-id="${medicine.id}">
                <div class="medicine-card-header">
                    <div class="medicine-card-icon" style="background: linear-gradient(135deg, ${currentProfile.color}, ${Profiles.darkenColor(currentProfile.color)})">
                        ${this.pillIcons[medicine.type]}
                    </div>
                    <div class="medicine-card-info">
                        <div class="medicine-card-name">${medicine.name}</div>
                        <div class="medicine-card-type">${medicine.type}${medicine.isCritical ? ' • Critical' : ''}</div>
                    </div>
                    <button class="medicine-card-menu" onclick="Medicines.showMenu('${medicine.id}', event)">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
                        </svg>
                    </button>
                </div>
                <div class="medicine-card-details">
                    ${medicine.dosage ? `<p><strong>Dosage:</strong> ${medicine.dosage}</p>` : ''}
                    ${medicine.quantity ? `<p><strong>Quantity:</strong> ${medicine.quantity}</p>` : ''}
                    ${medicine.notes ? `<p><strong>Notes:</strong> ${medicine.notes}</p>` : ''}
                </div>
                <div class="medicine-card-schedule">
                    ${medicine.times.map(time => `<span class="time-badge">${this.formatTime(time)}</span>`).join('')}
                </div>
            </div>
        `).join('');
    },

    showMenu(medicineId, event) {
        event.stopPropagation();
        // Simple context menu
        const action = confirm('Edit this medicine?\n\nClick OK to edit, Cancel to delete.');
        if (action) {
            this.openModal(medicineId);
        } else if (confirm('Are you sure you want to delete this medicine?')) {
            this.deleteMedicine(medicineId);
        }
    },

    formatTime(time24) {
        const [hours, minutes] = time24.split(':');
        const h = parseInt(hours);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:${minutes} ${ampm}`;
    },

    getMedicineById(id) {
        const medicines = Storage.getMedicines();
        return medicines.find(m => m.id === id);
    }
};

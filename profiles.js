// MedCare Profile Manager
const Profiles = {
    modal: null,
    form: null,
    currentEditId: null,
    selectedColor: '#667eea',
    selectedPhoto: null,

    init() {
        this.modal = document.getElementById('profileModal');
        this.form = document.getElementById('profileForm');
        this.setupEventListeners();
        this.render();
    },

    setupEventListeners() {
        // Add profile buttons
        document.getElementById('addProfileBtn')?.addEventListener('click', () => this.openModal());
        document.getElementById('addProfileBtnDash')?.addEventListener('click', () => this.openModal());

        // Profile dropdown toggle
        const currentProfile = document.getElementById('currentProfile');
        const dropdown = document.getElementById('profileDropdown');

        currentProfile?.addEventListener('click', () => {
            currentProfile.classList.toggle('open');
            dropdown.classList.toggle('open');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.profile-selector')) {
                currentProfile?.classList.remove('open');
                dropdown?.classList.remove('open');
            }
        });

        // Form submission
        this.form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });

        // Close modal buttons
        this.modal?.querySelectorAll('[data-close-modal]').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        // Backdrop click
        this.modal?.querySelector('.modal-backdrop')?.addEventListener('click', () => this.closeModal());

        // Photo upload
        const photoInput = document.getElementById('profilePhoto');
        const uploadBtn = document.getElementById('uploadPhotoBtn');

        uploadBtn?.addEventListener('click', () => photoInput?.click());
        photoInput?.addEventListener('change', (e) => this.handlePhotoUpload(e));

        // Color picker
        document.getElementById('colorPicker')?.addEventListener('click', (e) => {
            if (e.target.classList.contains('color-option')) {
                document.querySelectorAll('.color-option').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                this.selectedColor = e.target.dataset.color;
            }
        });

        // Listen for storage updates
        document.addEventListener('profiles-updated', () => this.render());
        document.addEventListener('profile-changed', () => this.render());
    },

    handlePhotoUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            this.selectedPhoto = event.target.result;
            const preview = document.getElementById('photoPreview');
            preview.innerHTML = `<img src="${this.selectedPhoto}" alt="Profile photo">`;
        };
        reader.readAsDataURL(file);
    },

    openModal(profileId = null) {
        this.currentEditId = profileId;
        this.form.reset();
        this.selectedPhoto = null;

        const title = document.getElementById('profileModalTitle');
        const preview = document.getElementById('photoPreview');

        // Reset photo preview
        preview.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
            <circle cx="12" cy="7" r="4"/>
        </svg>`;

        // Reset color picker
        document.querySelectorAll('.color-option').forEach(c => c.classList.remove('active'));
        document.querySelector('.color-option')?.classList.add('active');
        this.selectedColor = '#667eea';

        if (profileId) {
            title.textContent = 'Edit Profile';
            const profiles = Storage.getProfiles();
            const profile = profiles.find(p => p.id === profileId);

            if (profile) {
                document.getElementById('profileName').value = profile.name;
                document.getElementById('profileRelation').value = profile.relation || '';
                document.getElementById('emergencyContact').value = profile.emergencyContact || '';
                document.getElementById('emergencyEmail').value = profile.emergencyEmail || '';

                this.selectedColor = profile.color;
                const colorBtn = document.querySelector(`.color-option[data-color="${profile.color}"]`);
                if (colorBtn) {
                    document.querySelectorAll('.color-option').forEach(c => c.classList.remove('active'));
                    colorBtn.classList.add('active');
                }

                if (profile.photo) {
                    this.selectedPhoto = profile.photo;
                    preview.innerHTML = `<img src="${profile.photo}" alt="Profile photo">`;
                }
            }
        } else {
            title.textContent = 'Add Profile';
        }

        this.modal.classList.add('open');
    },

    closeModal() {
        this.modal.classList.remove('open');
        this.currentEditId = null;
    },

    saveProfile() {
        const name = document.getElementById('profileName').value.trim();
        if (!name) {
            App.showToast('Please enter a name', 'error');
            return;
        }

        const profile = {
            id: this.currentEditId || Storage.generateId(),
            name,
            relation: document.getElementById('profileRelation').value.trim(),
            color: this.selectedColor,
            photo: this.selectedPhoto,
            emergencyContact: document.getElementById('emergencyContact').value.trim(),
            emergencyEmail: document.getElementById('emergencyEmail').value.trim(),
            createdAt: this.currentEditId ? undefined : new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        Storage.saveProfile(profile);

        // Set as current if first profile
        if (Storage.getProfiles().length === 1) {
            Storage.setCurrentProfileId(profile.id);
        }

        this.closeModal();
        App.showToast(this.currentEditId ? 'Profile updated' : 'Profile created', 'success');
    },

    deleteProfile(profileId) {
        if (confirm('Delete this profile and all associated medicines?')) {
            Storage.deleteProfile(profileId);

            // Reset current profile if deleted
            if (Storage.getCurrentProfileId() === profileId) {
                const profiles = Storage.getProfiles();
                Storage.setCurrentProfileId(profiles[0]?.id || null);
            }

            App.showToast('Profile deleted', 'success');
        }
    },

    selectProfile(profileId) {
        Storage.setCurrentProfileId(profileId);
        document.getElementById('currentProfile')?.classList.remove('open');
        document.getElementById('profileDropdown')?.classList.remove('open');
    },

    render() {
        this.renderProfileDropdown();
        this.renderProfilesGrid();
        this.updateCurrentProfile();
    },

    renderProfileDropdown() {
        const list = document.getElementById('profileList');
        if (!list) return;

        const profiles = Storage.getProfiles();
        const currentId = Storage.getCurrentProfileId();

        if (profiles.length === 0) {
            list.innerHTML = '<div class="empty-state small"><p>No profiles yet</p></div>';
            return;
        }

        list.innerHTML = profiles.map(profile => `
            <div class="profile-item ${profile.id === currentId ? 'active' : ''}" 
                 data-profile-id="${profile.id}"
                 onclick="Profiles.selectProfile('${profile.id}')">
                <div class="profile-avatar" style="background: linear-gradient(135deg, ${profile.color}, ${this.darkenColor(profile.color)})">
                    ${profile.photo
                ? `<img src="${profile.photo}" alt="${profile.name}">`
                : this.getInitials(profile.name)}
                </div>
                <div class="profile-info">
                    <span class="profile-name">${profile.name}</span>
                    <span class="profile-subtitle">${profile.relation || 'Patient'}</span>
                </div>
            </div>
        `).join('');
    },

    renderProfilesGrid() {
        const grid = document.getElementById('profilesGrid');
        if (!grid) return;

        const profiles = Storage.getProfiles();

        if (profiles.length === 0) {
            grid.innerHTML = '<div class="empty-state small"><p>No profiles yet</p></div>';
            return;
        }

        grid.innerHTML = profiles.map(profile => `
            <div class="profile-card" onclick="Profiles.selectProfile('${profile.id}')" 
                 ondblclick="Profiles.openModal('${profile.id}')">
                <div class="profile-card-avatar" style="background: linear-gradient(135deg, ${profile.color}, ${this.darkenColor(profile.color)})">
                    ${profile.photo
                ? `<img src="${profile.photo}" alt="${profile.name}">`
                : this.getInitials(profile.name)}
                </div>
                <span class="profile-card-name">${profile.name}</span>
            </div>
        `).join('');
    },

    updateCurrentProfile() {
        const container = document.getElementById('currentProfile');
        if (!container) return;

        const currentId = Storage.getCurrentProfileId();
        const profiles = Storage.getProfiles();
        const profile = profiles.find(p => p.id === currentId);

        if (profile) {
            container.innerHTML = `
                <div class="profile-avatar" style="background: linear-gradient(135deg, ${profile.color}, ${this.darkenColor(profile.color)})">
                    ${profile.photo
                    ? `<img src="${profile.photo}" alt="${profile.name}">`
                    : this.getInitials(profile.name)}
                </div>
                <div class="profile-info">
                    <span class="profile-name">${profile.name}</span>
                    <span class="profile-subtitle">${profile.relation || 'Patient'}</span>
                </div>
                <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 9l6 6 6-6"/>
                </svg>
            `;
        } else {
            container.innerHTML = `
                <div class="profile-avatar" style="background: linear-gradient(135deg, #667eea, #764ba2)">
                    <span>+</span>
                </div>
                <div class="profile-info">
                    <span class="profile-name">Add Profile</span>
                    <span class="profile-subtitle">Get started</span>
                </div>
                <svg class="dropdown-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 9l6 6 6-6"/>
                </svg>
            `;
        }
    },

    getInitials(name) {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    },

    darkenColor(hex) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = -40;
        const R = Math.max(0, (num >> 16) + amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) + amt);
        const B = Math.max(0, (num & 0x0000FF) + amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    },

    getCurrentProfile() {
        const currentId = Storage.getCurrentProfileId();
        const profiles = Storage.getProfiles();
        return profiles.find(p => p.id === currentId);
    }
};

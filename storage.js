// MedCare Storage Manager
const Storage = {
    keys: {
        PROFILES: 'medcare_profiles',
        MEDICINES: 'medcare_medicines',
        DOSES: 'medcare_doses',
        MESSAGES: 'medcare_messages',
        SETTINGS: 'medcare_settings',
        CURRENT_PROFILE: 'medcare_current_profile'
    },

    get(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('Storage get error:', e);
            return null;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },

    remove(key) {
        localStorage.removeItem(key);
    },

    // Profile methods
    getProfiles() {
        return this.get(this.keys.PROFILES) || [];
    },

    saveProfile(profile) {
        const profiles = this.getProfiles();
        const index = profiles.findIndex(p => p.id === profile.id);
        if (index >= 0) {
            profiles[index] = profile;
        } else {
            profiles.push(profile);
        }
        this.set(this.keys.PROFILES, profiles);
        this.broadcast('profiles-updated', profiles);
        return profile;
    },

    deleteProfile(profileId) {
        let profiles = this.getProfiles();
        profiles = profiles.filter(p => p.id !== profileId);
        this.set(this.keys.PROFILES, profiles);
        
        // Also delete associated medicines
        let medicines = this.getMedicines();
        medicines = medicines.filter(m => m.profileId !== profileId);
        this.set(this.keys.MEDICINES, medicines);
        
        this.broadcast('profiles-updated', profiles);
        return profiles;
    },

    getCurrentProfileId() {
        return this.get(this.keys.CURRENT_PROFILE);
    },

    setCurrentProfileId(id) {
        this.set(this.keys.CURRENT_PROFILE, id);
        this.broadcast('profile-changed', id);
    },

    // Medicine methods
    getMedicines(profileId = null) {
        const medicines = this.get(this.keys.MEDICINES) || [];
        if (profileId) {
            return medicines.filter(m => m.profileId === profileId);
        }
        return medicines;
    },

    saveMedicine(medicine) {
        const medicines = this.getMedicines();
        const index = medicines.findIndex(m => m.id === medicine.id);
        if (index >= 0) {
            medicines[index] = medicine;
        } else {
            medicines.push(medicine);
        }
        this.set(this.keys.MEDICINES, medicines);
        this.broadcast('medicines-updated', medicines);
        return medicine;
    },

    deleteMedicine(medicineId) {
        let medicines = this.getMedicines();
        medicines = medicines.filter(m => m.id !== medicineId);
        this.set(this.keys.MEDICINES, medicines);
        this.broadcast('medicines-updated', medicines);
        return medicines;
    },

    // Dose tracking
    getDoses(date = null) {
        const doses = this.get(this.keys.DOSES) || [];
        if (date) {
            const dateStr = this.formatDate(date);
            return doses.filter(d => d.date === dateStr);
        }
        return doses;
    },

    recordDose(medicineId, scheduleTime, status, date = new Date()) {
        const doses = this.getDoses();
        const dateStr = this.formatDate(date);
        const doseId = `${medicineId}_${dateStr}_${scheduleTime}`;
        
        const existingIndex = doses.findIndex(d => d.id === doseId);
        const dose = {
            id: doseId,
            medicineId,
            scheduleTime,
            date: dateStr,
            status, // 'taken', 'missed', 'skipped', 'snoozed'
            timestamp: new Date().toISOString(),
            takenBy: this.get(this.keys.SETTINGS)?.userName || 'Caregiver'
        };
        
        if (existingIndex >= 0) {
            doses[existingIndex] = dose;
        } else {
            doses.push(dose);
        }
        
        this.set(this.keys.DOSES, doses);
        this.broadcast('doses-updated', doses);
        return dose;
    },

    getDoseStatus(medicineId, scheduleTime, date = new Date()) {
        const dateStr = this.formatDate(date);
        const doseId = `${medicineId}_${dateStr}_${scheduleTime}`;
        const doses = this.getDoses();
        return doses.find(d => d.id === doseId);
    },

    // Messages
    getMessages(profileId = null) {
        const messages = this.get(this.keys.MESSAGES) || [];
        if (profileId) {
            return messages.filter(m => m.profileId === profileId);
        }
        return messages;
    },

    saveMessage(message) {
        const messages = this.getMessages();
        messages.push(message);
        this.set(this.keys.MESSAGES, messages);
        this.broadcast('messages-updated', messages);
        return message;
    },

    // Settings
    getSettings() {
        return this.get(this.keys.SETTINGS) || {
            enableNotifications: true,
            enableSound: true,
            darkMode: true,
            userName: 'Caregiver'
        };
    },

    saveSettings(settings) {
        this.set(this.keys.SETTINGS, settings);
        this.broadcast('settings-updated', settings);
        return settings;
    },

    // Utilities
    formatDate(date) {
        return new Date(date).toISOString().split('T')[0];
    },

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // BroadcastChannel for multi-tab sync
    channel: null,
    
    initBroadcast() {
        if ('BroadcastChannel' in window) {
            this.channel = new BroadcastChannel('medcare_sync');
            this.channel.onmessage = (event) => {
                const { type, data } = event.data;
                document.dispatchEvent(new CustomEvent(type, { detail: data }));
            };
        }
    },

    broadcast(type, data) {
        if (this.channel) {
            this.channel.postMessage({ type, data });
        }
        document.dispatchEvent(new CustomEvent(type, { detail: data }));
    },

    // Export/Import
    exportData() {
        return {
            profiles: this.getProfiles(),
            medicines: this.getMedicines(),
            doses: this.getDoses(),
            messages: this.getMessages(),
            settings: this.getSettings(),
            exportedAt: new Date().toISOString()
        };
    },

    importData(data) {
        if (data.profiles) this.set(this.keys.PROFILES, data.profiles);
        if (data.medicines) this.set(this.keys.MEDICINES, data.medicines);
        if (data.doses) this.set(this.keys.DOSES, data.doses);
        if (data.messages) this.set(this.keys.MESSAGES, data.messages);
        if (data.settings) this.set(this.keys.SETTINGS, data.settings);
        this.broadcast('data-imported', data);
    },

    clearAll() {
        Object.values(this.keys).forEach(key => this.remove(key));
        this.broadcast('data-cleared', null);
    },

    // Sample data for demo
    loadSampleData() {
        const profiles = [
            {
                id: 'p1',
                name: 'Mom',
                relation: 'Mother',
                color: '#667eea',
                photo: null,
                emergencyContact: '',
                emergencyEmail: '',
                createdAt: new Date().toISOString()
            },
            {
                id: 'p2',
                name: 'Dad',
                relation: 'Father',
                color: '#43e97b',
                photo: null,
                emergencyContact: '',
                emergencyEmail: '',
                createdAt: new Date().toISOString()
            }
        ];

        const medicines = [
            {
                id: 'm1',
                profileId: 'p1',
                name: 'Metformin',
                type: 'tablet',
                dosage: '500mg',
                quantity: '1 tablet',
                frequency: 'twice',
                times: ['08:00', '20:00'],
                reminderType: 'notification',
                snoozeInterval: 10,
                isCritical: false,
                notes: 'Take with food',
                createdAt: new Date().toISOString()
            },
            {
                id: 'm2',
                profileId: 'p1',
                name: 'Lisinopril',
                type: 'tablet',
                dosage: '10mg',
                quantity: '1 tablet',
                frequency: 'once',
                times: ['09:00'],
                reminderType: 'alarm',
                snoozeInterval: 5,
                isCritical: true,
                notes: 'Blood pressure medication',
                createdAt: new Date().toISOString()
            },
            {
                id: 'm3',
                profileId: 'p2',
                name: 'Vitamin D',
                type: 'capsule',
                dosage: '1000 IU',
                quantity: '1 capsule',
                frequency: 'once',
                times: ['07:00'],
                reminderType: 'notification',
                snoozeInterval: 15,
                isCritical: false,
                notes: '',
                createdAt: new Date().toISOString()
            }
        ];

        this.set(this.keys.PROFILES, profiles);
        this.set(this.keys.MEDICINES, medicines);
        this.setCurrentProfileId('p1');
        
        return { profiles, medicines };
    }
};

// Initialize broadcast channel
Storage.initBroadcast();

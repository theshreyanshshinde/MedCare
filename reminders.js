// MedCare Reminders Manager
const Reminders = {
    timers: new Map(),
    audioContext: null,
    escalationLevel: new Map(), // Track escalation per reminder

    init() {
        this.requestNotificationPermission();
        this.scheduleAllReminders();
        this.setupVisibilityHandler();
    },

    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    },

    setupVisibilityHandler() {
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.checkMissedReminders();
            }
        });
    },

    scheduleAllReminders() {
        // Clear existing timers
        this.timers.forEach((timer) => clearTimeout(timer));
        this.timers.clear();

        const medicines = Storage.getMedicines();
        medicines.forEach(medicine => this.scheduleMedicineReminders(medicine));
    },

    scheduleMedicineReminders(medicine) {
        const today = new Date();
        const dateStr = Storage.formatDate(today);

        medicine.times.forEach(time => {
            const dose = Storage.getDoseStatus(medicine.id, time, today);
            if (dose?.status === 'taken' || dose?.status === 'skipped') return;

            const [hours, minutes] = time.split(':').map(Number);
            const scheduleTime = new Date();
            scheduleTime.setHours(hours, minutes, 0, 0);

            const now = Date.now();
            const delay = scheduleTime.getTime() - now;

            if (delay > 0) {
                const timerId = `${medicine.id}_${time}`;
                const timer = setTimeout(() => {
                    this.triggerReminder(medicine, time);
                }, delay);
                this.timers.set(timerId, timer);
            } else if (delay > -3600000) { // Within last hour
                // Check if past and not taken
                const dose = Storage.getDoseStatus(medicine.id, time, today);
                if (!dose || dose.status === 'pending') {
                    this.triggerReminder(medicine, time);
                }
            }
        });
    },

    triggerReminder(medicine, time) {
        const profile = Storage.getProfiles().find(p => p.id === medicine.profileId);
        const settings = Storage.getSettings();
        const timerId = `${medicine.id}_${time}`;

        // Get current escalation level
        const currentLevel = this.escalationLevel.get(timerId) || 0;
        this.escalationLevel.set(timerId, currentLevel + 1);

        // Determine reminder type based on escalation
        let reminderType = medicine.reminderType;
        if (currentLevel >= 2 && !medicine.isCritical) {
            reminderType = 'alarm';
        }
        if (medicine.isCritical && currentLevel >= 1) {
            reminderType = 'critical';
        }

        // Show notification
        if (settings.enableNotifications) {
            this.showNotification(medicine, profile, time, reminderType);
        }

        // Play sound based on type
        if (settings.enableSound) {
            this.playSound(reminderType);
        }

        // Show in-app alert
        this.showInAppAlert(medicine, time);

        // Schedule escalation
        if (currentLevel < 3) {
            const escalationDelay = medicine.isCritical ? 60000 : 180000; // 1 min or 3 min
            const timer = setTimeout(() => {
                const dose = Storage.getDoseStatus(medicine.id, time);
                if (!dose || dose.status === 'pending') {
                    this.triggerReminder(medicine, time);
                }
            }, escalationDelay);
            this.timers.set(`${timerId}_escalate`, timer);
        } else if (medicine.isCritical) {
            // Final escalation - emergency contact alert
            this.triggerEmergencyAlert(medicine, profile, time);
        }
    },

    showNotification(medicine, profile, time, type) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        const options = {
            body: `${medicine.dosage || ''} for ${profile?.name || 'Patient'}`,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: `${medicine.id}_${time}`,
            requireInteraction: type === 'critical',
            actions: [
                { action: 'take', title: 'Mark as Given' },
                { action: 'snooze', title: 'Snooze' }
            ]
        };

        const notification = new Notification(`💊 ${medicine.name}`, options);

        notification.onclick = () => {
            window.focus();
            Schedule.showSnoozeModal(medicine.id, time);
            notification.close();
        };
    },

    showInAppAlert(medicine, time) {
        Schedule.showSnoozeModal(medicine.id, time);
    },

    playSound(type) {
        try {
            if (!this.audioContext) {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }

            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);

            switch (type) {
                case 'notification':
                    oscillator.frequency.value = 440;
                    gainNode.gain.value = 0.1;
                    oscillator.start();
                    oscillator.stop(this.audioContext.currentTime + 0.2);
                    break;
                case 'alarm':
                    oscillator.frequency.value = 880;
                    gainNode.gain.value = 0.3;
                    oscillator.start();
                    setTimeout(() => {
                        oscillator.frequency.value = 660;
                    }, 200);
                    oscillator.stop(this.audioContext.currentTime + 0.5);
                    break;
                case 'critical':
                    oscillator.type = 'square';
                    oscillator.frequency.value = 1000;
                    gainNode.gain.value = 0.5;
                    oscillator.start();

                    let freq = 1000;
                    const interval = setInterval(() => {
                        freq = freq === 1000 ? 800 : 1000;
                        oscillator.frequency.value = freq;
                    }, 200);

                    setTimeout(() => {
                        clearInterval(interval);
                        oscillator.stop();
                    }, 2000);
                    break;
                default:
                    oscillator.frequency.value = 520;
                    gainNode.gain.value = 0.1;
                    oscillator.start();
                    oscillator.stop(this.audioContext.currentTime + 0.15);
            }
        } catch (e) {
            console.log('Audio not supported');
        }
    },

    triggerEmergencyAlert(medicine, profile, time) {
        const emergencyEmail = profile?.emergencyEmail;
        const emergencyPhone = profile?.emergencyContact;

        App.showToast(`⚠️ EMERGENCY: ${medicine.name} not given to ${profile?.name}!`, 'error');

        // Show emergency modal
        const message = `URGENT: ${medicine.name} for ${profile?.name} scheduled at ${Medicines.formatTime(time)} has not been given.\n\nThis is a critical medication.`;

        if (emergencyEmail) {
            const subject = encodeURIComponent(`[URGENT] Medication Alert - ${profile?.name}`);
            const body = encodeURIComponent(message);
            window.open(`mailto:${emergencyEmail}?subject=${subject}&body=${body}`, '_blank');
        }

        if (emergencyPhone) {
            const smsBody = encodeURIComponent(message);
            window.open(`sms:${emergencyPhone}?body=${smsBody}`, '_blank');
        }

        // Keep alarming
        this.playCriticalAlarm();
    },

    playCriticalAlarm() {
        const alarmInterval = setInterval(() => {
            this.playSound('critical');
        }, 3000);

        // Store interval to cancel later
        this.timers.set('critical_alarm', alarmInterval);
    },

    snooze(medicineId, time, minutes) {
        Storage.recordDose(medicineId, time, 'snoozed');

        const timerId = `${medicineId}_${time}`;

        // Clear existing timers
        clearTimeout(this.timers.get(timerId));
        clearTimeout(this.timers.get(`${timerId}_escalate`));

        // Reset escalation
        this.escalationLevel.set(timerId, 0);

        // Schedule new reminder
        const medicine = Medicines.getMedicineById(medicineId);
        if (medicine) {
            const delay = minutes * 60 * 1000;
            const timer = setTimeout(() => {
                this.triggerReminder(medicine, time);
            }, delay);
            this.timers.set(timerId, timer);
        }
    },

    cancelReminder(medicineId, time) {
        const timerId = `${medicineId}_${time}`;
        clearTimeout(this.timers.get(timerId));
        clearTimeout(this.timers.get(`${timerId}_escalate`));
        clearInterval(this.timers.get('critical_alarm'));
        this.timers.delete(timerId);
        this.escalationLevel.delete(timerId);
    },

    cancelMedicineReminders(medicineId) {
        this.timers.forEach((timer, key) => {
            if (key.startsWith(medicineId)) {
                clearTimeout(timer);
                this.timers.delete(key);
            }
        });
    },

    checkMissedReminders() {
        const today = new Date();
        const now = `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`;

        const medicines = Storage.getMedicines();
        medicines.forEach(medicine => {
            medicine.times.forEach(time => {
                if (time < now) {
                    const dose = Storage.getDoseStatus(medicine.id, time, today);
                    if (!dose || dose.status === 'pending' || dose.status === 'snoozed') {
                        // Mark as missed if more than 2 hours past
                        const [hours, minutes] = time.split(':').map(Number);
                        const scheduleTime = new Date();
                        scheduleTime.setHours(hours, minutes, 0, 0);

                        if (Date.now() - scheduleTime.getTime() > 7200000) { // 2 hours
                            Storage.recordDose(medicine.id, time, 'missed', today);
                        }
                    }
                }
            });
        });
    }
};

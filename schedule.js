// MedCare Schedule Manager
const Schedule = {
    currentDate: new Date(),

    init() {
        this.setupEventListeners();
        this.render();
    },

    setupEventListeners() {
        document.getElementById('prevDay')?.addEventListener('click', () => this.navigateDay(-1));
        document.getElementById('nextDay')?.addEventListener('click', () => this.navigateDay(1));
        document.getElementById('viewAllSchedule')?.addEventListener('click', () => App.switchView('daily'));

        // Listen for updates
        document.addEventListener('medicines-updated', () => this.render());
        document.addEventListener('doses-updated', () => this.render());
        document.addEventListener('profile-changed', () => this.render());
    },

    navigateDay(delta) {
        this.currentDate.setDate(this.currentDate.getDate() + delta);
        this.render();
    },

    render() {
        this.renderDailyView();
        this.renderDashboardSchedule();
        this.renderNextUp();
        this.updateStats();
    },

    renderDailyView() {
        const container = document.getElementById('dailyList');
        const dateDisplay = document.getElementById('currentDateDisplay');
        const fullDate = document.getElementById('fullDateDisplay');

        if (!container) return;

        // Update date header
        const today = new Date();
        const isToday = this.isSameDay(this.currentDate, today);
        const isYesterday = this.isSameDay(this.currentDate, new Date(today.setDate(today.getDate() - 1)));
        const isTomorrow = this.isSameDay(this.currentDate, new Date(new Date().setDate(new Date().getDate() + 1)));

        if (dateDisplay) {
            if (isToday) dateDisplay.textContent = 'Today';
            else if (isYesterday) dateDisplay.textContent = 'Yesterday';
            else if (isTomorrow) dateDisplay.textContent = 'Tomorrow';
            else dateDisplay.textContent = this.formatDateShort(this.currentDate);
        }

        if (fullDate) {
            fullDate.textContent = this.formatDateLong(this.currentDate);
        }

        // Get scheduled items
        const items = this.getScheduledItems(this.currentDate);

        if (items.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
                <p>No medications for this day</p>
                <span>Add medicines to start tracking</span>
            </div>`;
            return;
        }

        container.innerHTML = items.map(item => this.renderMedicineItem(item)).join('');
    },

    getScheduledItems(date) {
        const profiles = Storage.getProfiles();
        const currentProfileId = Storage.getCurrentProfileId();
        const medicines = currentProfileId
            ? Storage.getMedicines(currentProfileId)
            : Storage.getMedicines();
        const items = [];

        medicines.forEach(medicine => {
            const profile = profiles.find(p => p.id === medicine.profileId);
            if (!profile) return;

            medicine.times.forEach(time => {
                const dose = Storage.getDoseStatus(medicine.id, time, date);
                items.push({
                    medicine,
                    profile,
                    time,
                    status: dose?.status || 'pending'
                });
            });
        });

        // Sort by time
        items.sort((a, b) => a.time.localeCompare(b.time));
        return items;
    },

    renderMedicineItem(item) {
        const { medicine, profile, time, status } = item;
        const isPast = this.isTimePast(time);
        const statusClass = status === 'taken' ? 'completed' : (status === 'missed' || (isPast && status === 'pending') ? 'missed' : '');
        const criticalClass = medicine.isCritical ? 'critical' : '';

        return `
            <div class="medicine-item ${statusClass} ${criticalClass}" 
                 data-medicine-id="${medicine.id}" 
                 data-time="${time}"
                 onclick="Schedule.handleItemClick('${medicine.id}', '${time}')">
                <span class="medicine-time">${Medicines.formatTime(time)}</span>
                <div class="medicine-icon" style="background: linear-gradient(135deg, ${profile.color}, ${Profiles.darkenColor(profile.color)})">
                    ${Medicines.pillIcons[medicine.type]}
                </div>
                <div class="medicine-details">
                    <div class="medicine-name">${medicine.name}</div>
                    <div class="medicine-dosage">${medicine.dosage || ''} ${medicine.quantity || ''}</div>
                </div>
                <div class="medicine-actions">
                    <button class="check-btn ${status === 'taken' ? 'checked' : ''}" 
                            onclick="event.stopPropagation(); Schedule.toggleDose('${medicine.id}', '${time}')">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                            <path d="M20 6L9 17l-5-5"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    },

    handleItemClick(medicineId, time) {
        const dose = Storage.getDoseStatus(medicineId, time, this.currentDate);
        if (dose?.status === 'taken') return;

        // Show snooze modal
        this.showSnoozeModal(medicineId, time);
    },

    toggleDose(medicineId, time) {
        const dose = Storage.getDoseStatus(medicineId, time, this.currentDate);
        const newStatus = dose?.status === 'taken' ? 'pending' : 'taken';

        Storage.recordDose(medicineId, time, newStatus, this.currentDate);

        if (newStatus === 'taken') {
            App.showToast('Medicine marked as given', 'success');
            Reminders.cancelReminder(medicineId, time);
        }

        this.render();
    },

    showSnoozeModal(medicineId, time) {
        const modal = document.getElementById('snoozeModal');
        const medicine = Medicines.getMedicineById(medicineId);
        const profile = Profiles.getCurrentProfile();

        if (!modal || !medicine) return;

        document.getElementById('snoozeMedicineName').textContent = medicine.name;
        document.getElementById('snoozeTime').textContent = `Scheduled for ${Medicines.formatTime(time)}`;

        const iconContainer = document.getElementById('snoozeIcon');
        iconContainer.style.background = `linear-gradient(135deg, ${profile?.color || '#667eea'}, ${Profiles.darkenColor(profile?.color || '#667eea')})`;
        iconContainer.innerHTML = Medicines.pillIcons[medicine.type];

        // Snooze buttons
        modal.querySelectorAll('.snooze-btn').forEach(btn => {
            btn.onclick = () => {
                const minutes = parseInt(btn.dataset.snooze);
                Reminders.snooze(medicineId, time, minutes);
                modal.classList.remove('open');
                App.showToast(`Snoozed for ${minutes} minutes`, 'info');
            };
        });

        // Mark done button
        document.getElementById('markDoneBtn').onclick = () => {
            Storage.recordDose(medicineId, time, 'taken', this.currentDate);
            Reminders.cancelReminder(medicineId, time);
            modal.classList.remove('open');
            App.showToast('Medicine marked as given', 'success');
            this.render();
        };

        // Skip button
        document.getElementById('skipDoseBtn').onclick = () => {
            Storage.recordDose(medicineId, time, 'skipped', this.currentDate);
            Reminders.cancelReminder(medicineId, time);
            modal.classList.remove('open');
            App.showToast('Dose skipped', 'warning');
            this.render();
        };

        modal.classList.add('open');
        modal.querySelector('.modal-backdrop').onclick = () => modal.classList.remove('open');
    },

    renderDashboardSchedule() {
        const container = document.getElementById('scheduleTimeline');
        if (!container) return;

        const items = this.getScheduledItems(new Date());
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // Get upcoming items
        const upcoming = items.filter(item => item.time >= currentTime && item.status !== 'taken');

        if (upcoming.length === 0) {
            container.innerHTML = '<div class="empty-state small"><p>No more medications today</p></div>';
            return;
        }

        container.innerHTML = upcoming.slice(0, 5).map(item => `
            <div class="timeline-item" onclick="Schedule.handleItemClick('${item.medicine.id}', '${item.time}')">
                <span class="timeline-time">${Medicines.formatTime(item.time)}</span>
                <div class="timeline-content">
                    <div class="timeline-medicine">${item.medicine.name}</div>
                    <div class="timeline-profile">${item.profile.name}</div>
                </div>
            </div>
        `).join('');
    },

    renderNextUp() {
        const container = document.getElementById('nextUpContent');
        const timeElement = document.getElementById('nextUpTime');
        if (!container) return;

        const items = this.getScheduledItems(new Date());
        const now = new Date();
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const next = items.find(item => item.time >= currentTime && item.status !== 'taken');

        if (!next) {
            container.innerHTML = `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M10.5 20.5L3.5 13.5a4.95 4.95 0 117 -7l7 7a4.95 4.95 0 11-7 7z"/>
                    <path d="M8.5 8.5l7 7"/>
                </svg>
                <p>No upcoming medications</p>
                <span>All done for today!</span>
            </div>`;
            if (timeElement) timeElement.textContent = '--:--';
            return;
        }

        if (timeElement) timeElement.textContent = Medicines.formatTime(next.time);

        container.innerHTML = `
            <div class="medicine-item" onclick="Schedule.handleItemClick('${next.medicine.id}', '${next.time}')">
                <div class="medicine-icon" style="background: linear-gradient(135deg, ${next.profile.color}, ${Profiles.darkenColor(next.profile.color)})">
                    ${Medicines.pillIcons[next.medicine.type]}
                </div>
                <div class="medicine-details">
                    <div class="medicine-name">${next.medicine.name}</div>
                    <div class="medicine-dosage">${next.medicine.dosage || ''} for ${next.profile.name}</div>
                </div>
                <button class="check-btn" onclick="event.stopPropagation(); Schedule.toggleDose('${next.medicine.id}', '${next.time}')">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <path d="M20 6L9 17l-5-5"/>
                    </svg>
                </button>
            </div>
        `;
    },

    updateStats() {
        const items = this.getScheduledItems(new Date());
        const taken = items.filter(i => i.status === 'taken').length;

        const todaysDoses = document.getElementById('todaysDoses');
        const completedDoses = document.getElementById('completedDoses');

        if (todaysDoses) todaysDoses.textContent = items.length;
        if (completedDoses) completedDoses.textContent = taken;
    },

    isTimePast(time) {
        const now = new Date();
        const [hours, minutes] = time.split(':').map(Number);
        const scheduleTime = new Date();
        scheduleTime.setHours(hours, minutes, 0, 0);
        return now > scheduleTime && this.isSameDay(this.currentDate, new Date());
    },

    isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    },

    formatDateShort(date) {
        return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    },

    formatDateLong(date) {
        return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    }
};

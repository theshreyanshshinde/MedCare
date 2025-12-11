// MedCare Calendar Manager
const Calendar = {
    currentDate: new Date(),
    viewType: 'week',

    init() {
        this.setupEventListeners();
        this.render();
    },

    setupEventListeners() {
        document.getElementById('calPrev')?.addEventListener('click', () => this.navigate(-1));
        document.getElementById('calNext')?.addEventListener('click', () => this.navigate(1));
        document.getElementById('todayBtn')?.addEventListener('click', () => this.goToToday());

        document.querySelectorAll('[data-cal-view]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('[data-cal-view]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.viewType = e.target.dataset.calView;
                this.render();
            });
        });

        document.addEventListener('medicines-updated', () => this.render());
        document.addEventListener('profile-changed', () => this.render());
    },

    navigate(delta) {
        if (this.viewType === 'week') {
            this.currentDate.setDate(this.currentDate.getDate() + (delta * 7));
        } else {
            this.currentDate.setMonth(this.currentDate.getMonth() + delta);
        }
        this.render();
    },

    goToToday() {
        this.currentDate = new Date();
        this.render();
    },

    render() {
        if (this.viewType === 'week') {
            this.renderWeekView();
        } else {
            this.renderMonthView();
        }
        this.updateTitle();
    },

    updateTitle() {
        const title = document.getElementById('calendarTitle');
        if (!title) return;

        if (this.viewType === 'week') {
            const weekStart = this.getWeekStart(this.currentDate);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            title.textContent = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        } else {
            title.textContent = this.currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }
    },

    renderWeekView() {
        const container = document.getElementById('calendarContainer');
        if (!container) return;

        const weekStart = this.getWeekStart(this.currentDate);
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const hours = Array.from({ length: 24 }, (_, i) => i);

        let html = `
            <div class="calendar-header">
                <div class="calendar-header-cell"></div>
                ${Array.from({ length: 7 }, (_, i) => {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            const isToday = this.isSameDay(date, new Date());
            return `<div class="calendar-header-cell ${isToday ? 'today' : ''}">
                        ${days[date.getDay()]} ${date.getDate()}
                    </div>`;
        }).join('')}
            </div>
            <div class="week-grid" style="max-height: 500px; overflow-y: auto;">
                <div class="week-time-col">
                    ${hours.map(h => `<div class="week-time-slot">${this.formatHour(h)}</div>`).join('')}
                </div>
                ${Array.from({ length: 7 }, (_, i) => {
            const date = new Date(weekStart);
            date.setDate(date.getDate() + i);
            return this.renderWeekDayColumn(date, hours);
        }).join('')}
            </div>
        `;

        container.innerHTML = html;
        this.enableDragAndDrop();
    },

    renderWeekDayColumn(date, hours) {
        const items = Schedule.getScheduledItems(date);
        const profile = Profiles.getCurrentProfile();

        let eventsHtml = items.map(item => {
            const [hours, minutes] = item.time.split(':').map(Number);
            const top = hours * 60 + minutes;
            return `
                <div class="week-event" 
                     style="top: ${top}px; height: 50px; background: linear-gradient(135deg, ${item.profile.color}, ${Profiles.darkenColor(item.profile.color)})"
                     draggable="true"
                     data-medicine-id="${item.medicine.id}"
                     data-date="${Storage.formatDate(date)}"
                     data-time="${item.time}">
                    ${item.medicine.name}
                </div>
            `;
        }).join('');

        return `
            <div class="week-day-col" data-date="${Storage.formatDate(date)}">
                ${hours.map(() => `<div class="week-slot"></div>`).join('')}
                ${eventsHtml}
            </div>
        `;
    },

    renderMonthView() {
        const container = document.getElementById('calendarContainer');
        if (!container) return;

        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDay = firstDay.getDay();
        const daysInMonth = lastDay.getDate();

        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        let html = `
            <div class="calendar-header">
                ${days.map(d => `<div class="calendar-header-cell">${d}</div>`).join('')}
            </div>
            <div class="calendar-grid">
        `;

        // Previous month days
        const prevMonth = new Date(year, month, 0);
        const prevDays = prevMonth.getDate();
        for (let i = startDay - 1; i >= 0; i--) {
            const day = prevDays - i;
            html += `<div class="calendar-cell other-month"><div class="calendar-date">${day}</div></div>`;
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const isToday = this.isSameDay(date, new Date());
            const items = Schedule.getScheduledItems(date);

            html += `
                <div class="calendar-cell ${isToday ? 'today' : ''}" data-date="${Storage.formatDate(date)}">
                    <div class="calendar-date">${day}</div>
                    <div class="calendar-events">
                        ${items.slice(0, 3).map(item => `
                            <div class="calendar-event" 
                                 style="background: ${item.profile.color}"
                                 onclick="Schedule.handleItemClick('${item.medicine.id}', '${item.time}')">
                                ${Medicines.formatTime(item.time)} ${item.medicine.name}
                            </div>
                        `).join('')}
                        ${items.length > 3 ? `<div class="calendar-event" style="background: var(--bg-glass)">+${items.length - 3} more</div>` : ''}
                    </div>
                </div>
            `;
        }

        // Next month days
        const totalCells = startDay + daysInMonth;
        const remainingCells = 7 - (totalCells % 7);
        if (remainingCells < 7) {
            for (let i = 1; i <= remainingCells; i++) {
                html += `<div class="calendar-cell other-month"><div class="calendar-date">${i}</div></div>`;
            }
        }

        html += '</div>';
        container.innerHTML = html;
    },

    enableDragAndDrop() {
        const events = document.querySelectorAll('.week-event');
        const slots = document.querySelectorAll('.week-slot');

        events.forEach(event => {
            event.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', JSON.stringify({
                    medicineId: event.dataset.medicineId,
                    date: event.dataset.date,
                    time: event.dataset.time
                }));
                event.style.opacity = '0.5';
            });

            event.addEventListener('dragend', (e) => {
                event.style.opacity = '1';
            });
        });

        slots.forEach((slot, index) => {
            slot.addEventListener('dragover', (e) => {
                e.preventDefault();
                slot.style.background = 'rgba(102, 126, 234, 0.2)';
            });

            slot.addEventListener('dragleave', (e) => {
                slot.style.background = '';
            });

            slot.addEventListener('drop', (e) => {
                e.preventDefault();
                slot.style.background = '';

                try {
                    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
                    const col = slot.closest('.week-day-col');
                    const newDate = col.dataset.date;
                    const slotIndex = Array.from(col.querySelectorAll('.week-slot')).indexOf(slot);
                    const newTime = `${String(slotIndex).padStart(2, '0')}:00`;

                    // Update medicine schedule (simplified - just show toast for demo)
                    App.showToast(`Rescheduled to ${newDate} at ${Medicines.formatTime(newTime)}`, 'info');
                    this.render();
                } catch (err) {
                    console.error('Drop error:', err);
                }
            });
        });
    },

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        d.setDate(d.getDate() - day);
        return d;
    },

    isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
            d1.getMonth() === d2.getMonth() &&
            d1.getDate() === d2.getDate();
    },

    formatHour(hour) {
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const h12 = hour % 12 || 12;
        return `${h12}${ampm}`;
    }
};

// MedCare Main App Controller
const App = {
    currentView: 'dashboard',

    init() {
        // Initialize modules
        Profiles.init();
        Medicines.init();
        Schedule.init();
        Reminders.init();
        Calendar.init();
        Reports.init();
        Chat.init();

        this.setupEventListeners();
        this.setupSettings();
        this.loadInitialData();

        console.log('MedCare initialized');
    },

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                if (view) this.switchView(view);
            });
        });

        // Settings modal
        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            document.getElementById('settingsModal')?.classList.add('open');
        });

        // Close modals
        document.querySelectorAll('.modal').forEach(modal => {
            modal.querySelectorAll('[data-close-modal]').forEach(btn => {
                btn.addEventListener('click', () => modal.classList.remove('open'));
            });
            modal.querySelector('.modal-backdrop')?.addEventListener('click', () => {
                modal.classList.remove('open');
            });
        });

        // Settings controls
        document.getElementById('enableNotifications')?.addEventListener('change', (e) => {
            const settings = Storage.getSettings();
            settings.enableNotifications = e.target.checked;
            Storage.saveSettings(settings);
            if (e.target.checked) Reminders.requestNotificationPermission();
        });

        document.getElementById('enableSound')?.addEventListener('change', (e) => {
            const settings = Storage.getSettings();
            settings.enableSound = e.target.checked;
            Storage.saveSettings(settings);
        });

        document.getElementById('darkMode')?.addEventListener('change', (e) => {
            const settings = Storage.getSettings();
            settings.darkMode = e.target.checked;
            Storage.saveSettings(settings);
            document.body.classList.toggle('light-mode', !e.target.checked);
        });

        // Data management
        document.getElementById('exportDataBtn')?.addEventListener('click', () => {
            const data = Storage.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `medcare-backup-${Storage.formatDate(new Date())}.json`;
            a.click();
            URL.revokeObjectURL(url);
            this.showToast('Data exported successfully', 'success');
        });

        document.getElementById('importDataBtn')?.addEventListener('click', () => {
            document.getElementById('importFile')?.click();
        });

        document.getElementById('importFile')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    Storage.importData(data);
                    this.showToast('Data imported successfully', 'success');
                    window.location.reload();
                } catch (err) {
                    this.showToast('Invalid backup file', 'error');
                }
            };
            reader.readAsText(file);
        });

        document.getElementById('clearDataBtn')?.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete all data? This cannot be undone.')) {
                Storage.clearAll();
                this.showToast('All data cleared', 'success');
                window.location.reload();
            }
        });

        // Mobile sidebar toggle
        document.getElementById('sidebarToggle')?.addEventListener('click', () => {
            document.getElementById('sidebar')?.classList.toggle('open');
        });

        // Notification button
        document.getElementById('notificationBtn')?.addEventListener('click', () => {
            this.showToast('Notifications center coming soon!', 'info');
        });

        // Window resize
        window.addEventListener('resize', () => {
            Reports.render();
        });

        // Periodic refresh
        setInterval(() => {
            Schedule.render();
            Reminders.checkMissedReminders();
        }, 60000); // Every minute
    },

    setupSettings() {
        const settings = Storage.getSettings();

        const notifCheckbox = document.getElementById('enableNotifications');
        const soundCheckbox = document.getElementById('enableSound');
        const darkCheckbox = document.getElementById('darkMode');

        if (notifCheckbox) notifCheckbox.checked = settings.enableNotifications;
        if (soundCheckbox) soundCheckbox.checked = settings.enableSound;
        if (darkCheckbox) darkCheckbox.checked = settings.darkMode;

        if (!settings.darkMode) {
            document.body.classList.add('light-mode');
        }
    },

    loadInitialData() {
        // Check if first run - load sample data
        const profiles = Storage.getProfiles();
        if (profiles.length === 0) {
            // Show welcome state - don't auto-load sample data
            // User can add their own profiles
        }
    },

    switchView(view) {
        this.currentView = view;

        // Update navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.view === view);
        });

        // Update views
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
        });
        document.getElementById(`${view}View`)?.classList.add('active');

        // Update page title
        const titles = {
            dashboard: { title: 'Dashboard', subtitle: 'Overview of all medications' },
            daily: { title: 'Daily View', subtitle: 'Today\'s medication schedule' },
            medicines: { title: 'Medicines', subtitle: 'Manage medicine list' },
            calendar: { title: 'Calendar', subtitle: 'Weekly and monthly view' },
            reports: { title: 'Reports', subtitle: 'Compliance analytics' },
            chat: { title: 'Chat', subtitle: 'Care team coordination' }
        };

        const pageTitle = titles[view] || { title: 'MedCare', subtitle: '' };
        document.getElementById('pageTitle').textContent = pageTitle.title;
        document.getElementById('pageSubtitle').textContent = pageTitle.subtitle;

        // Render view-specific content
        switch (view) {
            case 'dashboard':
                Schedule.render();
                break;
            case 'daily':
                Schedule.render();
                break;
            case 'medicines':
                Medicines.render();
                break;
            case 'calendar':
                Calendar.render();
                break;
            case 'reports':
                Reports.render();
                break;
            case 'chat':
                Chat.render();
                break;
        }

        // Close mobile sidebar
        document.getElementById('sidebar')?.classList.remove('open');
    },

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="background:none;border:none;color:inherit;cursor:pointer;margin-left:12px;">×</button>
        `;

        container.appendChild(toast);

        // Auto remove
        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

// Handle service worker for offline support (optional enhancement)
if ('serviceWorker' in navigator) {
    // Could register service worker here for PWA capabilities
}

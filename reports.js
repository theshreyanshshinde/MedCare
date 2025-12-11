// MedCare Reports Manager
const Reports = {
    period: 'week',
    chart: null,

    init() {
        this.setupEventListeners();
        this.render();
    },

    setupEventListeners() {
        document.querySelectorAll('[data-period]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('[data-period]').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.period = e.target.dataset.period;
                this.render();
            });
        });

        document.getElementById('exportReportBtn')?.addEventListener('click', () => this.exportReport());

        document.addEventListener('doses-updated', () => this.render());
        document.addEventListener('profile-changed', () => this.render());
    },

    render() {
        this.renderChart();
        this.renderStats();
        this.renderBreakdown();
    },

    getReportData() {
        const endDate = new Date();
        const startDate = new Date();

        if (this.period === 'week') {
            startDate.setDate(startDate.getDate() - 7);
        } else {
            startDate.setDate(startDate.getDate() - 30);
        }

        const currentProfileId = Storage.getCurrentProfileId();
        const medicines = currentProfileId
            ? Storage.getMedicines(currentProfileId)
            : Storage.getMedicines();
        const doses = Storage.getDoses();

        const data = {
            labels: [],
            taken: [],
            missed: [],
            pending: [],
            totalDoses: 0,
            takenOnTime: 0,
            takenLate: 0,
            missed: 0,
            byMedicine: {}
        };

        // Generate date labels
        const days = this.period === 'week' ? 7 : 30;
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = Storage.formatDate(date);

            data.labels.push(date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            }));

            let dayTaken = 0;
            let dayMissed = 0;
            let dayPending = 0;

            medicines.forEach(medicine => {
                medicine.times.forEach(time => {
                    data.totalDoses++;
                    const doseId = `${medicine.id}_${dateStr}_${time}`;
                    const dose = doses.find(d => d.id === doseId);

                    if (!data.byMedicine[medicine.id]) {
                        data.byMedicine[medicine.id] = {
                            name: medicine.name,
                            taken: 0,
                            missed: 0,
                            total: 0
                        };
                    }
                    data.byMedicine[medicine.id].total++;

                    if (dose) {
                        if (dose.status === 'taken') {
                            dayTaken++;
                            data.takenOnTime++;
                            data.byMedicine[medicine.id].taken++;
                        } else if (dose.status === 'missed') {
                            dayMissed++;
                            data.byMedicine[medicine.id].missed++;
                        }
                    } else {
                        // Check if past
                        const now = new Date();
                        const doseDate = new Date(dateStr + 'T' + time);
                        if (doseDate < now) {
                            dayMissed++;
                            data.byMedicine[medicine.id].missed++;
                        } else {
                            dayPending++;
                        }
                    }
                });
            });

            data.taken.push(dayTaken);
            data.missed.push(dayMissed);
            data.pending.push(dayPending);
        }

        data.missed = data.missed.reduce((a, b) => a + b, 0);

        return data;
    },

    renderChart() {
        const canvas = document.getElementById('reportChart');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const data = this.getReportData();

        // Clear canvas
        canvas.width = canvas.offsetWidth;
        canvas.height = 300;

        const padding = 40;
        const chartWidth = canvas.width - padding * 2;
        const chartHeight = canvas.height - padding * 2;

        // Clear
        ctx.fillStyle = 'rgba(26, 26, 46, 0.5)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const maxValue = Math.max(...data.taken, ...data.missed, 1);
        const barWidth = chartWidth / data.labels.length / 2.5;
        const gap = chartWidth / data.labels.length;

        // Draw bars
        data.taken.forEach((value, i) => {
            const x = padding + i * gap + gap / 2 - barWidth;
            const barHeight = (value / maxValue) * chartHeight;
            const y = canvas.height - padding - barHeight;

            // Taken bar
            const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
            gradient.addColorStop(0, '#43e97b');
            gradient.addColorStop(1, '#38f9d7');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barHeight, 4);
            ctx.fill();

            // Missed bar
            const missedHeight = (data.missed[i] / maxValue) * chartHeight;
            const missedY = canvas.height - padding - missedHeight;
            const missedGradient = ctx.createLinearGradient(x + barWidth + 4, missedY, x + barWidth + 4, missedY + missedHeight);
            missedGradient.addColorStop(0, '#f5576c');
            missedGradient.addColorStop(1, '#f093fb');
            ctx.fillStyle = missedGradient;
            ctx.beginPath();
            ctx.roundRect(x + barWidth + 4, missedY, barWidth, missedHeight, 4);
            ctx.fill();
        });

        // Draw labels
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '10px Inter';
        ctx.textAlign = 'center';

        const labelStep = Math.ceil(data.labels.length / 7);
        data.labels.forEach((label, i) => {
            if (i % labelStep === 0) {
                const x = padding + i * gap + gap / 2;
                ctx.fillText(label, x, canvas.height - 10);
            }
        });

        // Draw Y axis labels
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const value = Math.round((maxValue / 4) * i);
            const y = canvas.height - padding - (chartHeight / 4) * i;
            ctx.fillText(value.toString(), padding - 10, y + 4);

            // Grid line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(canvas.width - padding, y);
            ctx.stroke();
        }
    },

    renderStats() {
        const data = this.getReportData();

        document.getElementById('totalDoses').textContent = data.totalDoses;
        document.getElementById('takenOnTime').textContent = data.takenOnTime;
        document.getElementById('takenLate').textContent = data.takenLate;
        document.getElementById('missedDoses').textContent = data.missed;
    },

    renderBreakdown() {
        const container = document.getElementById('medicineBreakdown');
        if (!container) return;

        const data = this.getReportData();
        const profile = Profiles.getCurrentProfile();

        if (Object.keys(data.byMedicine).length === 0) {
            container.innerHTML = '<div class="empty-state small"><p>No data yet</p></div>';
            return;
        }

        container.innerHTML = Object.values(data.byMedicine).map(med => {
            const compliance = med.total > 0 ? Math.round((med.taken / med.total) * 100) : 0;
            return `
                <div class="breakdown-item" style="margin-bottom: 12px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span style="font-size: 0.875rem;">${med.name}</span>
                        <span style="font-size: 0.875rem; color: ${compliance >= 80 ? 'var(--success)' : compliance >= 50 ? 'var(--warning)' : 'var(--danger)'}">
                            ${compliance}%
                        </span>
                    </div>
                    <div style="height: 6px; background: var(--bg-glass); border-radius: 3px; overflow: hidden;">
                        <div style="width: ${compliance}%; height: 100%; background: ${profile?.color || 'var(--accent-primary)'}; border-radius: 3px;"></div>
                    </div>
                </div>
            `;
        }).join('');
    },

    exportReport() {
        const data = this.getReportData();
        const profile = Profiles.getCurrentProfile();

        const report = {
            generatedAt: new Date().toISOString(),
            period: this.period,
            profile: profile?.name || 'All Profiles',
            summary: {
                totalDoses: data.totalDoses,
                takenOnTime: data.takenOnTime,
                takenLate: data.takenLate,
                missed: data.missed,
                complianceRate: data.totalDoses > 0 ? Math.round((data.takenOnTime / data.totalDoses) * 100) : 0
            },
            byMedicine: data.byMedicine,
            dailyData: data.labels.map((label, i) => ({
                date: label,
                taken: data.taken[i],
                missed: data.missed[i]
            }))
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `medcare-report-${this.period}-${Storage.formatDate(new Date())}.json`;
        a.click();
        URL.revokeObjectURL(url);

        App.showToast('Report exported', 'success');
    }
};

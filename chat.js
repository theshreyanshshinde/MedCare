// MedCare Chat Manager
const Chat = {
    currentContactId: null,

    init() {
        this.setupEventListeners();
        this.render();
    },

    setupEventListeners() {
        document.getElementById('sendMessageBtn')?.addEventListener('click', () => this.sendMessage());

        document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        document.addEventListener('messages-updated', () => this.render());
        document.addEventListener('profile-changed', () => this.render());
    },

    render() {
        this.renderContacts();
        this.renderMessages();
    },

    renderContacts() {
        const container = document.getElementById('chatContacts');
        if (!container) return;

        const profiles = Storage.getProfiles();
        const messages = Storage.getMessages();

        if (profiles.length === 0) {
            container.innerHTML = '<div class="empty-state small"><p>No profiles yet</p></div>';
            return;
        }

        // Create chat contacts for each profile (representing care team discussions)
        const contacts = profiles.map(profile => {
            const profileMessages = messages.filter(m => m.profileId === profile.id);
            const lastMessage = profileMessages[profileMessages.length - 1];
            const unread = profileMessages.filter(m => !m.read && m.sender !== 'me').length;

            return {
                id: profile.id,
                name: `${profile.name}'s Care Team`,
                avatar: profile.photo,
                color: profile.color,
                initials: Profiles.getInitials(profile.name),
                lastMessage: lastMessage?.text || 'Start a conversation',
                unread
            };
        });

        container.innerHTML = contacts.map(contact => `
            <div class="chat-contact ${contact.id === this.currentContactId ? 'active' : ''}" 
                 onclick="Chat.selectContact('${contact.id}')">
                <div class="chat-contact-avatar" style="background: linear-gradient(135deg, ${contact.color}, ${Profiles.darkenColor(contact.color)})">
                    ${contact.avatar ? `<img src="${contact.avatar}" alt="${contact.name}">` : contact.initials}
                </div>
                <div class="chat-contact-info">
                    <div class="chat-contact-name">${contact.name}</div>
                    <div class="chat-contact-preview">${contact.lastMessage}</div>
                </div>
                ${contact.unread > 0 ? `<span class="chat-badge">${contact.unread}</span>` : ''}
            </div>
        `).join('');

        // Update badge
        const totalUnread = contacts.reduce((sum, c) => sum + c.unread, 0);
        const badge = document.getElementById('chatBadge');
        if (badge) {
            badge.textContent = totalUnread || '';
            badge.style.display = totalUnread > 0 ? 'block' : 'none';
        }
    },

    selectContact(contactId) {
        this.currentContactId = contactId;

        // Enable input
        const input = document.getElementById('messageInput');
        const sendBtn = document.getElementById('sendMessageBtn');
        if (input) input.disabled = false;
        if (sendBtn) sendBtn.disabled = false;

        // Mark messages as read
        const messages = Storage.getMessages();
        messages.forEach(m => {
            if (m.profileId === contactId) m.read = true;
        });
        Storage.set(Storage.keys.MESSAGES, messages);

        this.render();
    },

    renderMessages() {
        const container = document.getElementById('chatMessages');
        const header = document.getElementById('chatHeader');

        if (!container) return;

        if (!this.currentContactId) {
            container.innerHTML = `<div class="empty-state">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
                </svg>
                <p>Start a conversation</p>
                <span>Coordinate care with your team</span>
            </div>`;
            if (header) header.innerHTML = '<span>Select a conversation</span>';
            return;
        }

        const profile = Storage.getProfiles().find(p => p.id === this.currentContactId);
        if (header && profile) {
            header.innerHTML = `<span>${profile.name}'s Care Team</span>`;
        }

        const messages = Storage.getMessages(this.currentContactId);

        if (messages.length === 0) {
            container.innerHTML = `<div class="empty-state">
                <p>No messages yet</p>
                <span>Start the conversation</span>
            </div>`;
            return;
        }

        container.innerHTML = messages.map(msg => `
            <div class="message ${msg.sender === 'me' ? 'sent' : 'received'}">
                <div>${msg.text}</div>
                <div class="message-time">${this.formatTime(msg.timestamp)}</div>
            </div>
        `).join('');

        // Scroll to bottom
        container.scrollTop = container.scrollHeight;
    },

    sendMessage() {
        if (!this.currentContactId) return;

        const input = document.getElementById('messageInput');
        const text = input?.value.trim();

        if (!text) return;

        const message = {
            id: Storage.generateId(),
            profileId: this.currentContactId,
            text,
            sender: 'me',
            timestamp: new Date().toISOString(),
            read: true
        };

        Storage.saveMessage(message);
        input.value = '';

        // Simulate response after delay
        setTimeout(() => {
            this.simulateResponse();
        }, 1000 + Math.random() * 2000);
    },

    simulateResponse() {
        if (!this.currentContactId) return;

        const responses = [
            "Got it, thanks for the update!",
            "I'll check on that.",
            "Thanks for letting me know.",
            "Noted. Keep me posted.",
            "Great, medication given on time!",
            "I'll take the next dose.",
            "How is the patient feeling today?",
            "Any side effects to report?",
            "Let's review the schedule tomorrow.",
            "Acknowledged. 👍"
        ];

        const message = {
            id: Storage.generateId(),
            profileId: this.currentContactId,
            text: responses[Math.floor(Math.random() * responses.length)],
            sender: 'other',
            senderName: 'Care Team Member',
            timestamp: new Date().toISOString(),
            read: false
        };

        Storage.saveMessage(message);
    },

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();

        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }

        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
            ' ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }
};

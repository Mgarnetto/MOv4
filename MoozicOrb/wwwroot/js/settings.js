const SettingsManager = {

    // --- UPLOAD HELPER ---
    async uploadImage(fileInput) {
        if (!fileInput.files || fileInput.files.length === 0) return null;

        const formData = new FormData();
        formData.append("file", fileInput.files[0]);

        try {
            const res = await fetch('/api/upload/image', {
                method: 'POST',
                headers: {
                    'X-Session-Id': window.AuthState?.sessionId || ''
                },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                return data.url;
            } else {
                console.warn("Upload failed:", await res.text());
            }
        } catch (err) {
            console.error("Upload error:", err);
        }
        return null;
    },

    // --- PAGE SETTINGS (Bio, Cover, Layout, AND NEW FIELDS) ---
    async initPageSettings() {
        // 1. Bind Cover Upload
        const coverInput = document.getElementById('coverUploadInput');
        if (coverInput) {
            coverInput.addEventListener('change', async (e) => {
                const url = await this.uploadImage(e.target);
                if (url) {
                    const preview = document.getElementById('coverPreview');
                    if (preview) {
                        preview.style.backgroundImage = `url('${url}')`;
                        window.newCoverUrl = url;
                    }
                }
            });
        }

        // 2. Initialize Drag & Drop
        this.initDraggableLayout();

        // 3. Bind Form Save
        const form = document.getElementById('pageSettingsForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                // Scrape layout order
                const layoutOrder = [];
                document.querySelectorAll('#layoutSortContainer .sort-item').forEach(el => {
                    layoutOrder.push(el.getAttribute('data-key'));
                });

                const coverPreview = document.getElementById('coverPreview');
                const currentCover = coverPreview ? coverPreview.getAttribute('data-current') : "";

                // Helper: Convert empty strings to NULL for C# Integer compatibility
                const getInt = (id) => {
                    const el = document.getElementById(id);
                    if (!el || el.value === "") return null;
                    return parseInt(el.value);
                };

                const payload = {
                    Bio: document.getElementById('inputBio')?.value || "",
                    BookingEmail: document.getElementById('inputEmail')?.value || "",
                    CoverImage: window.newCoverUrl || currentCover,
                    LayoutOrder: layoutOrder,

                    // New Fields using getInt to prevent 400 Bad Request on empty selections
                    PhoneBooking: document.getElementById('inputPhoneBooking')?.value || null,
                    AccountTypePrimary: getInt('inputAccountTypePrimary'),
                    AccountTypeSecondary: getInt('inputAccountTypeSecondary'),
                    GenrePrimary: getInt('inputGenrePrimary'),
                    GenreSecondary: getInt('inputGenreSecondary')
                };

                await this.submitJson('/settings/update-page', payload);
            });
        }
    },

    // --- DRAGGABLE LOGIC (Unchanged) ---
    initDraggableLayout() {
        const container = document.getElementById('layoutSortContainer');
        if (!container) return;

        let draggedItem = null;

        container.addEventListener('dragstart', (e) => {
            if (!e.target.classList.contains('sort-item')) return;
            draggedItem = e.target;
            e.target.style.opacity = '0.5';
            e.target.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', '');
        });

        container.addEventListener('dragend', (e) => {
            if (!e.target.classList.contains('sort-item')) return;
            e.target.style.opacity = '1';
            e.target.classList.remove('dragging');
            draggedItem = null;
        });

        container.addEventListener('dragover', (e) => {
            e.preventDefault();
            const afterElement = this.getDragAfterElement(container, e.clientY);
            const currentDraggable = document.querySelector('.dragging');
            if (!currentDraggable) return;

            if (afterElement == null) {
                container.appendChild(currentDraggable);
            } else {
                container.insertBefore(currentDraggable, afterElement);
            }
        });
    },

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.sort-item:not(.dragging)')];
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    },

    // --- ACCOUNT SETTINGS (Profile, AND NEW FIELDS) ---
    async initAccountSettings() {
        const avatarInput = document.getElementById('avatarUploadInput');
        if (avatarInput) {
            avatarInput.addEventListener('change', async (e) => {
                const url = await this.uploadImage(e.target);
                if (url) {
                    const preview = document.getElementById('avatarPreview');
                    if (preview) preview.style.backgroundImage = `url('${url}')`;
                    await this.submitJson('/settings/update-avatar', { url: url }, false);
                    if (window.SidebarManager && window.SidebarManager.updateProfile) {
                        window.SidebarManager.updateProfile();
                    }
                }
            });
        }

        const form = document.getElementById('accountSettingsForm');
        if (form) {
            form.addEventListener('submit', async (e) => {
                e.preventDefault();

                const getInt = (id) => {
                    const el = document.getElementById(id);
                    if (!el || el.value === "") return null;
                    return parseInt(el.value);
                };

                const payload = {
                    DisplayName: document.getElementById('inputDisplayName')?.value || "",
                    Email: document.getElementById('inputEmailDisplay')?.value || "",

                    // New Fields
                    Dob: document.getElementById('inputDob')?.value || null,

                    // Use getInt for IDs to ensure safety
                    LocationId: getInt('inputLocationId'),
                    PhoneMain: document.getElementById('inputPhoneMain')?.value || null,
                    VisibilityId: getInt('inputVisibility') || 0
                };

                await this.submitJson('/settings/update-account', payload);
            });
        }
    },

    // --- GENERIC SUBMITTER ---
    async submitJson(url, payload, showAlert = true) {
        const btn = document.querySelector('button[type="submit"]');
        let originalText = "";

        if (btn) {
            originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = "Saving...";
        }

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Session-Id': window.AuthState?.sessionId || ''
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                if (showAlert) alert("Saved successfully!");
            } else {
                if (showAlert) alert("Failed to save.");
                console.warn(await res.text());
            }
        } catch (err) {
            console.error(err);
            if (showAlert) alert("Error saving settings.");
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerText = originalText || "Save Changes";
            }
        }
    }
};

window.initSettings = function () {
    SettingsManager.initPageSettings();
    SettingsManager.initAccountSettings();
}
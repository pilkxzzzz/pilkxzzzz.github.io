import { SUPABASE_URL, SUPABASE_KEY } from './config.js';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Константи
const DEFAULT_AVATAR = 'https://via.placeholder.com/150';
const API_URL = 'http://192.168.0.105:3000';
const ENCRYPTION_KEY = 'your-secret-key';

let tg = window.Telegram.WebApp;
let currentUser = null;

// Допоміжні функції
function showMessage(message) {
    alert(message);
}

function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Функція для входу
async function loginUser(email, password) {
    try {
        const { user, error } = await supabase.auth.signIn({
            email: email,
            password: password
        });

        if (error) throw error;

        // Отримуємо профіль користувача
        const { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) throw profileError;

        return { ...user, profile };
    } catch (error) {
        console.error('Помилка входу:', error);
        showMessage('Помилка входу: ' + error.message);
        return null;
    }
}

// Функція для завантаження профілю
async function loadProfile() {
    console.log('Завантаження профілю...');
    
    if (!currentUser) {
        console.error('Користувач не авторизований');
        showMessage('Помилка завантаження профілю');
        return;
    }

    try {
        // Оновлюємо дані користувача з сервера
        const response = await fetch(`${API_URL}/users?username=${currentUser.username}`);
        const users = await response.json();
        const userData = users[0];

        if (!userData) {
            console.error('Користувача не знайдено');
            return;
        }

        // Оновлюємо локальні дані
        currentUser = userData;
        localStorage.setItem('currentUser', JSON.stringify(userData));

        // Оновлюємо елементи інтерфейсу
        const userAvatar = document.getElementById('userAvatar');
        if (userAvatar) {
            userAvatar.src = userData.avatar || DEFAULT_AVATAR;
        }

        const userUsername = document.getElementById('userUsername');
        if (userUsername) {
            userUsername.textContent = `@${userData.username}`;
        }

        const nicknameInput = document.getElementById('nickname');
        if (nicknameInput) {
            nicknameInput.value = userData.username || '';
        }

        const bioTextarea = document.getElementById('bio');
        if (bioTextarea) {
            bioTextarea.value = userData.bio || '';
        }

        // Оновлюємо статус Telegram
        const telegramStatus = document.getElementById('telegramStatus');
        if (telegramStatus) {
            if (userData.telegramUsername) {
                telegramStatus.innerHTML = `
                    <span class="icon">✈️</span>
                    <span id="telegramUsername">@${userData.telegramUsername}</span>
                    <button class="button secondary" id="disconnectTelegramBtn">
                        Відключити
                    </button>
                `;
            } else {
                telegramStatus.innerHTML = `
                    <span class="icon">✈️</span>
                    <span id="telegramUsername">Не підключено</span>
                    <button class="button secondary" id="connectTelegramBtn">
                        Підключити
                    </button>
                `;
            }
        }

        // Завантажуємо налаштування
        if (userData.settings) {
            const darkMode = document.getElementById('darkMode');
            if (darkMode) darkMode.checked = userData.settings.darkMode;

            const notifications = document.getElementById('notifications');
            if (notifications) notifications.checked = userData.settings.notifications;

            const language = document.getElementById('language');
            if (language) language.value = userData.settings.language || 'uk';

            const privacy = document.getElementById('privacy');
            if (privacy) privacy.value = userData.settings.privacy || 'public';

            // Застосовуємо налаштування
            applySettings(userData.settings);
        }

        // Оновлюємо обробники подій для всіх кнопок
        setupButtonHandlers();

        console.log('Профіль успішно ��авантажено');
    } catch (error) {
        console.error('Помилка завантаження профілю:', error);
        showMessage('Помилка завантаження профілю');
    }

    // Оновлюємо лічильник сповіщень
    updateNotificationsCount();

    // Показуємо кнопку адмін-панелі тільки для адміністраторів
    const adminButton = document.getElementById('adminPanelBtn');
    if (adminButton) {
        adminButton.style.display = isAdmin(currentUser) ? 'block' : 'none';
    }
}

// Функція перевірки прав адміністратора
function isAdmin(user) {
    return user && user.role === 'admin';
}

// Оновлена функція показу адмін-панелі
function showAdminPanel() {
    if (isAdmin(currentUser)) {
        showPage('admin-page');
        loadAdminData();
    } else {
        showMessage('У вас немає прав адміністратора');
        showPage('profile-page');
    }
}

// Додамо перевірку прав для адмін-функцій
async function sendMessageToUser(username) {
    if (!isAdmin(currentUser)) {
        showMessage('У вас немає прав адміністратора');
        return;
    }
    const message = prompt('Введіть повідомлення для користувача @' + username);
    if (!message) return;
    
    try {
        const response = await fetch(`${API_URL}/users?username=${username}`);
        const users = await response.json();
        const user = users[0];
        
        if (!user) throw new Error('Користувача не знайдено');
        
        const notification = {
            id: Date.now(),
            from: 'pilk',
            type: 'admin_message',
            message: message,
            read: false,
            date: new Date().toISOString(),
            status: 'sent'
        };
        
        const updatedUser = {
            ...user,
            notifications: [...(user.notifications || []), notification]
        };
        
        await fetch(`${API_URL}/users/${user.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedUser)
        });
        
        showMessage('Повідомлення надіслано');
    } catch (error) {
        console.error('Помилка відправки повідомлення:', error);
        showMessage('Помилка відправки повідомлення');
    }
}

async function banUser(username) {
    if (!isAdmin(currentUser)) {
        showMessage('У вас немає прав адміністратора');
        return;
    }
    if (!confirm(`Ви впевнені, що хочете заблокувати користувача @${username}?`)) return;
    
    try {
        const response = await fetch(`${API_URL}/users?username=${username}`);
        const users = await response.json();
        const user = users[0];
        
        if (!user) throw new Error('Користувача не знайдено');
        
        const updatedUser = {
            ...user,
            banned: true,
            banDate: new Date().toISOString()
        };
        
        await fetch(`${API_URL}/users/${user.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedUser)
        });
        
        showMessage('Користувача заблоковано');
        loadAdminData();
    } catch (error) {
        console.error('Помилка блокування користувача:', error);
        showMessage('Помилка блокування користувача');
    }
}

// Додайте нову функцію для налаштування обробників кнопок
function setupButtonHandlers() {
    // Кнопка збереження профілю
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.onclick = saveProfile;
    }

    // Кнопка виходу
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = logout;
    }

    // Кнопка переходу до стрічки
    const goToFeedBtn = document.getElementById('goToFeedBtn');
    if (goToFeedBtn) {
        goToFeedBtn.onclick = async () => {
            showPage('feed-page');
            await loadUsers(); // Завантажуємо користувачів при переході на стрічку
        };
    }

    // Кнопка повернення до профілю
    const backToProfileBtn = document.getElementById('backToProfileBtn');
    if (backToProfileBtn) {
        backToProfileBtn.onclick = () => {
            showPage('profile-page');
        };
    }

    // Кнопка налаштувань
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        settingsBtn.onclick = () => showModal('settingsModal');
    }

    // Кнопка сповіщень
    const notificationsBtn = document.getElementById('notificationsBtn');
    if (notificationsBtn) {
        notificationsBtn.onclick = () => {
            showModal('notificationsModal');
            showNotifications();
        };
    }

    // Кнопка підключення Telegram
    const connectTelegramBtn = document.getElementById('connectTelegramBtn');
    if (connectTelegramBtn) {
        connectTelegramBtn.onclick = () => showModal('telegramModal');
    }

    // Кнопка відключення Telegram
    const disconnectTelegramBtn = document.getElementById('disconnectTelegramBtn');
    if (disconnectTelegramBtn) {
        disconnectTelegramBtn.onclick = async () => {
            if (confirm('Ви впевнені, що хочете відключити Telegram?')) {
                await saveTelegramUsername('');
                showMessage('Telegram відключено');
            }
        };
    }

    // Ороник дя завантаження аватара
    const avatarInput = document.getElementById('avatarInput');
    const avatarWrapper = document.getElementById('avatarWrapper');
    if (avatarInput && avatarWrapper) {
        avatarWrapper.onclick = () => avatarInput.click();
        avatarInput.onchange = handleAvatarUpload;
    }

    // Кнопка збереження налаштувань
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    if (saveSettingsBtn) {
        saveSettingsBtn.onclick = saveSettings;
    }

    // Кнопка для показу орми ручного введення
    const manualTelegramBtn = document.getElementById('manualTelegramBtn');
    const manualTelegramForm = document.getElementById('manualTelegramForm');
    
    if (manualTelegramBtn && manualTelegramForm) {
        manualTelegramBtn.onclick = () => {
            manualTelegramBtn.style.display = 'none';
            manualTelegramForm.style.display = 'block';
        };
    }

    // Форма для ручного введення Telegram
    if (manualTelegramForm) {
        manualTelegramForm.onsubmit = async (e) => {
            e.preventDefault();
            const usernameInput = manualTelegramForm.querySelector('input[name="telegramUsername"]');
            const username = usernameInput.value.trim();
            
            if (username) {
                await saveTelegramUsername(username);
                manualTelegramForm.reset();
                hideModal('telegramModal');
            }
        };
    }

    // Додайте оброник для кнопки "Скасувати"
    const closeModalBtns = document.querySelectorAll('.close-modal');
    closeModalBtns.forEach(btn => {
        btn.onclick = () => {
            // Скидаємо стан форми при закритті модального вікна
            if (manualTelegramForm) {
                manualTelegramForm.style.display = 'none';
                manualTelegramForm.reset();
            }
            if (manualTelegramBtn) {
                manualTelegramBtn.style.display = 'block';
            }
            hideModal('telegramModal');
        };
    });

    // Додаємо обробник для кнопки преміум
    const premiumBtn = document.getElementById('premiumBtn');
    if (premiumBtn) {
        premiumBtn.onclick = () => {
            showModal('premiumModal');
            updatePremiumUI(); // Оновлюємо UI в залежності від статусу преміум
        };
    }

    // Додаємо обробник для кнопки покупки преміум
    const purchasePremiumBtn = document.getElementById('purchasePremiumBtn');
    if (purchasePremiumBtn) {
        purchasePremiumBtn.onclick = purchasePremium;
    }

    // Додаємо обробник для кнопки збереження налаштувань преміуму
    const savePremiumBtn = document.getElementById('savePremiumBtn');
    if (savePremiumBtn) {
        savePremiumBtn.onclick = savePremiumSettings;
    }
}

// Функція для збереження профілю
async function saveProfile() {
    if (!currentUser) return;

    const nicknameInput = document.getElementById('nickname');
    const bioTextarea = document.getElementById('bio');

    const updatedData = {
        ...currentUser,
        username: nicknameInput.value.trim(),
        bio: bioTextarea.value.trim()
    };

    try {
        const response = await fetch(`${API_URL}/users/${currentUser.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedData)
        });

        if (response.ok) {
            currentUser = updatedData;
            localStorage.setItem('currentUser', JSON.stringify(updatedData));
            showMessage('Профіль успішно оновлено');
        } else {
            throw new Error('Помилка оновлення профілю');
        }
    } catch (error) {
        console.error('Помилка збереження профілю:', error);
        showMessage('Помилка збереження профілю');
    }
}

// Функція для виходу
function logout() {
    currentUser = null;
    localStorage.removeItem('currentUser');
    showPage('auth-page');
    showMessage('Ви успішно вийшли');
}

// Функція для показу сторінки
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.add('active');
        
        // Завантажуємо користувачів при показі стрічки
        if (pageId === 'feed-page') {
            loadUsers();
        }
    }
}

// Функція для відключення Telegram
async function disconnectTelegram() {
    if (!currentUser) return;

    try {
        const updatedUser = {
            ...currentUser,
            telegramUsername: ''
        };

        const response = await fetch(`${API_URL}/users/${currentUser.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedUser)
        });

        if (response.ok) {
            currentUser = updatedUser;
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            await loadProfile();
            showMessage('Telegram відключено');
        } else {
            throw new Error('Помилка відключення Telegram');
        }
    } catch (error) {
        console.error('Помилка відключення Telegram:', error);
        showMessage('Помилка відключення Telegram');
    }
}

// Функція для обробки завантаження аватара
async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const avatar = e.target.result;
            
            const updatedUser = {
                ...currentUser,
                avatar
            };

            const response = await fetch(`${API_URL}/users/${currentUser.id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(updatedUser)
            });

            if (response.ok) {
                currentUser = updatedUser;
                localStorage.setItem('currentUser', JSON.stringify(updatedUser));
                document.getElementById('userAvatar').src = avatar;
                showMessage('Аватар оновлено');
            } else {
                throw new Error('Помилка оновлення аватара');
            }
        };
        reader.readAsDataURL(file);
    } catch (error) {
        console.error('Помилка завантаження аватар��:', error);
        showMessage('Помилка завантаження аватара');
    }
}

// Додайте нову функцію для збереження налаштувань
async function saveSettings() {
    if (!currentUser) return;

    const darkMode = document.getElementById('darkMode').checked;
    const notifications = document.getElementById('notifications').checked;
    const language = document.getElementById('language').value;
    const privacy = document.getElementById('privacy').value;

    const updatedUser = {
        ...currentUser,
        settings: {
            darkMode,
            notifications,
            language,
            privacy
        }
    };

    try {
        const response = await fetch(`${API_URL}/users/${currentUser.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedUser)
        });

        if (response.ok) {
            currentUser = updatedUser;
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            hideModal('settingsModal');
            showMessage('Налаштування збережено');
            
            // Застосовуємо налаштування
            applySettings(updatedUser.settings);
        } else {
            throw new Error('Помилка збереження налаштувань');
        }
    } catch (error) {
        console.error('Помилка збереження налаштувань:', error);
        showMessage('Помилка збереження налаштувань');
    }
}

// Функція для застосування налаштувань
function applySettings(settings) {
    if (settings.darkMode) {
        document.body.classList.add('dark-mode');
    } else {
        document.body.classList.remove('dark-mode');
    }

    // Можна додати інші налаштування ту
}

// Ініціалізація після завантаження DOM
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOMContentLoaded запущено');

    // Перевірка авторизації при завантаженні
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            console.log('Знайдено збереженого користувача:', currentUser);
            
            // Перевіряємо чи користувач все ще існує на сервері
            const response = await fetch(`${API_URL}/users?username=${currentUser.username}`);
            const users = await response.json();
            
            if (users[0]) {
                console.log('Користувач підтверджений на сервері');
                currentUser = users[0];
                localStorage.setItem('currentUser', JSON.stringify(currentUser));
                await loadProfile();
                showPage('profile-page');
            } else {
                console.log('Користувача не знайдено на сервері');
                localStorage.removeItem('currentUser');
                currentUser = null;
                showPage('auth-page');
            }
        } catch (error) {
            console.error('Помилка перевірки авторизації:', error);
            localStorage.removeItem('currentUser');
            currentUser = null;
            showPage('auth-page');
        }
    } else {
        console.log('Збережений користувач не знайдений');
        showPage('auth-page');
    }

    // Обробник кнопки входу
    const loginBtn = document.getElementById('loginBtn');
    console.log('Знайдена кнопка входу:', loginBtn);
    
    if (loginBtn) {
        loginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Кнопка входу натиснута');
            const modal = document.getElementById('loginModal');
            console.log('Знайдене модальне вікно:', modal);
            if (modal) {
                modal.classList.add('active');
            }
        });
    }

    // Обробник кнопки реєстрації
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Кнопка реєстрації натиснута');
            const modal = document.getElementById('registerModal');
            if (modal) {
                modal.classList.add('active');
            }
        });
    }

    // Обробник форми входу
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Форма входу відправлена');
            
            const username = loginForm.querySelector('input[name="username"]').value.trim();
            const password = loginForm.querySelector('input[name="password"]').value.trim();
            
            if (!username || !password) {
                showMessage('Заповніть всі поля');
                return;
            }
            
            console.log('Дані для входу:', { username, password });
            
            try {
                const user = await loginUser(username, password);
                if (user) {
                    console.log('Користувач успішно увійшов:', user);
                    currentUser = user;
                    localStorage.setItem('currentUser', JSON.stringify(user));
                    
                    hideModal('loginModal');
                    loginForm.reset();
                    loadProfile();
                    showPage('profile-page');
                    showMessage('Вхід успішний');
                } else {
                    showMessage('Нправильний логін або пароль');
                }
            } catch (error) {
                console.error('Помилка входу:', error);
                showMessage('Помилка входу');
            }
        });
    }

    // Обробник форми реєстрації
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = registerForm.querySelector('input[name="username"]').value.trim();
            const password = registerForm.querySelector('input[name="password"]').value.trim();
            const confirmPassword = registerForm.querySelector('input[name="confirmPassword"]').value.trim();
            
            if (!username || !password || !confirmPassword) {
                showMessage('Заповніть всі поля');
                return;
            }
            
            if (password !== confirmPassword) {
                showMessage('Парлі не співпадають');
                return;
            }
            
            const user = await registerUser(username, password);
            if (user) {
                currentUser = user;
                localStorage.setItem('currentUser', JSON.stringify(user));
                hideModal('registerModal');
                registerForm.reset();
                loadProfile();
                showPage('profile-page');
            }
        });
    }

    // Обробники закриття модальних вікон
    document.querySelectorAll('.close-modal').forEach(button => {
        button.addEventListener('click', () => {
            const modal = button.closest('.modal');
            if (modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Додаємо обробник для кнопки адмін-панелі
    document.getElementById('adminPanelBtn')?.addEventListener('click', () => {
        showAdminPanel();
    });
});

// Додайте функцію для реєстрації
async function registerUser(username, password) {
    try {
        // Хешуємо пароль (в реальному додатку використовуйте більш безпечний метод)
        const password_hash = CryptoJS.SHA256(password).toString();

        // Створюємо користувача в auth
        const { user, error: authError } = await supabase.auth.signUp({
            email: `${username}@example.com`, // тимчасовий email
            password: password
        });

        if (authError) throw authError;

        // Створюємо профіль користувача
        const { error: profileError } = await supabase
            .from('user_profiles')
            .insert([{
                id: user.id,
                username: username,
                display_name: username,
                avatar_url: null,
                bio: '',
                telegram_username: null
            }]);

        if (profileError) throw profileError;

        // Створюємо налаштування користувача
        const { error: settingsError } = await supabase
            .from('user_settings')
            .insert([{
                user_id: user.id,
                theme: 'light',
                notifications: true,
                language: 'uk',
                privacy: 'public'
            }]);

        if (settingsError) throw settingsError;

        showMessage('Реєстрація успішна');
        return user;
    } catch (error) {
        console.error('Помилка реєстрації:', error);
        showMessage('Помилка реєстрації: ' + error.message);
        return null;
    }
}

// Оновлена функція для завантаження стрічки користувачів
async function loadUsers() {
    const usersGrid = document.getElementById('usersGrid');
    if (!usersGrid) return;
    
    usersGrid.innerHTML = `
        <div class="loading-state">
            <span class="icon">⌛</span>
            <p>Завантаження користувачів...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_URL}/users`);
        const users = await response.json();
        
        const filteredUsers = users.filter(user => 
            user.username !== currentUser?.username && 
            user.telegramUsername
        );

        usersGrid.innerHTML = filteredUsers.map(user => {
            // Перевіряємо аватар
            let avatarSrc = DEFAULT_AVATAR;
            if (user.avatar) {
                // Якщо аватар це base64
                if (user.avatar.startsWith('data:image')) {
                    avatarSrc = user.avatar;
                } else {
                    // Якщо аватар це URL
                    avatarSrc = user.avatar;
                }
            }

            // Визначаємо преміум класи
            const premiumClasses = [];
            if (user.premium?.active) {
                premiumClasses.push('premium-user');
                
                if (user.premium.settings?.animation) {
                    premiumClasses.push(`profile-animation-${user.premium.settings.animation}`);
                }
                
                if (user.premium.settings?.background) {
                    premiumClasses.push(`background-${user.premium.settings.background}`);
                }
            }

            // Створюємо стилі для преміум користувача
            const premiumStyles = user.premium?.active ? `
                style="
                    ${user.premium.settings?.profileColor ? `border-color: ${user.premium.settings.profileColor};` : ''}
                    ${user.premium.settings?.effectColor ? `--effect-color: ${user.premium.settings.effectColor};` : ''}
                    ${user.premium.settings?.matrixSize ? `--matrix-size: ${user.premium.settings.matrixSize}px;` : ''}
                    ${user.premium.settings?.matrixSpeed ? `--matrix-speed: ${user.premium.settings.matrixSpeed}s;` : ''}
                    ${user.premium.settings?.neonIntensity ? `--neon-intensity: ${user.premium.settings.neonIntensity};` : ''}
                    ${user.premium.settings?.neonPulseSpeed ? `--neon-pulse-speed: ${user.premium.settings.neonPulseSpeed}s;` : ''}
                    ${user.premium.settings?.snowSize ? `--snow-size: ${user.premium.settings.snowSize}px;` : ''}
                    ${user.premium.settings?.snowSpeed ? `--snow-speed: ${user.premium.settings.snowSpeed}s;` : ''}
                    ${user.premium.settings?.snowDensity ? `--snow-density: ${user.premium.settings.snowDensity};` : ''}
                "
            ` : '';

            return `
                <div class="user-card ${premiumClasses.join(' ')}" 
                    ${premiumStyles}
                    ${user.premium?.settings?.matrixChars ? `data-chars="${user.premium.settings.matrixChars}"` : ''}
                    ${user.premium?.settings?.terminalText ? `data-terminal-text="${user.premium.settings.terminalText}"` : ''}
                >
                    ${user.premium?.active ? `
                        <div class="user-status">
                            <span class="premium-icon">${user.premium.settings?.statusEmoji || '👑'}</span>
                        </div>
                    ` : ''}
                    <img src="${avatarSrc}" alt="Avatar" class="user-avatar" onerror="this.src='${DEFAULT_AVATAR}'">
                    <h3>@${user.username}</h3>
                    <p>${user.bio || 'Немає опису'}</p>
                    
                    ${user.settings?.privacy === 'private' ? `
                        <div class="user-privacy private">
                            <span class="icon">🔒</span>
                            <span>Приватний профіль</span>
                        </div>
                        <button class="button like-button ${checkIfLiked(user.username) ? 'liked' : ''}" 
                                onclick="toggleLike('${user.username}')">
                            <span class="icon">${checkIfLiked(user.username) ? '❤️' : '🤍'}</span>
                            Надіслати запит
                        </button>
                    ` : `
                        <div class="user-telegram clickable" onclick="openTelegramProfile('${user.telegramUsername}')">
                            <span class="icon">✈️</span>
                            <span>@${user.telegramUsername}</span>
                        </div>
                    `}
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Помилка звантаження користувачів:', error);
        usersGrid.innerHTML = `
            <div class="error-state">
                <span class="icon">❌</span>
                <p>Помилка завантаження користувачів</p>
                <button class="button" onclick="loadUsers()">Спробувати ще раз</button>
            </div>
        `;
    }
}

// Додайте функції для роботи з лайками
function checkIfLiked(username) {
    if (!currentUser) return false;
    return currentUser.likes.includes(username);
}

// Оновлена функція toggleLike для врахування приватності
async function toggleLike(username) {
    if (!currentUser || !currentUser.id) {
        showMessage('Помилка: спробуйте перезайти');
        return;
    }
    
    try {
        // Отримуємо дані користувача, якому ставимо лайк
        const response = await fetch(`${API_URL}/users?username=${username}`);
        const users = await response.json();
        const targetUser = users[0];

        if (!targetUser) {
            showMessage('Користувача не знайдено');
            return;
        }

        const isLiked = checkIfLiked(username);
        if (isLiked) {
            showMessage('Ви вже вподоба��и цей профіль');
            return;
        }

        // Оновлюємо масив лайків
        const updatedLikes = [...currentUser.likes, username];
        const updatedCurrentUser = {
            ...currentUser,
            likes: updatedLikes
        };

        // Створюємо сповіщення
        const notification = {
            from: currentUser.username,
            type: 'like',
            read: false,
            date: new Date().toISOString(),
            status: 'pending'
        };

        // Якщо профіль приватний, додаємо відповідний статус
        if (targetUser.settings?.privacy === 'private') {
            notification.requiresApproval = true;
        }

        const updatedTargetUser = {
            ...targetUser,
            notifications: [...targetUser.notifications, notification]
        };

        // Збергаємо зміни
        await Promise.all([
            fetch(`${API_URL}/users/${currentUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedCurrentUser)
            }),
            fetch(`${API_URL}/users/${targetUser.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedTargetUser)
            })
        ]);

        currentUser = updatedCurrentUser;
        localStorage.setItem('currentUser', JSON.stringify(updatedCurrentUser));

        showMessage(targetUser.settings?.privacy === 'private' 
            ? 'Зпит надіслано. Очікуйте підтвердження' 
            : 'Профіль вподобано');

        await loadUsers();

    } catch (error) {
        console.error('Помилка оновлення лайків:', error);
        showMessage('Помилка оновлення лайків');
    }
}

// Функція для оновлення лічильника сповіщень
function updateNotificationsCount() {
    const notificationsCount = document.getElementById('notificationsCount');
    if (notificationsCount && currentUser) {
        const unreadCount = currentUser.notifications?.filter(n => !n.read).length || 0;
        notificationsCount.textContent = unreadCount;
        notificationsCount.style.display = unreadCount > 0 ? 'block' : 'none';
    }
}

// Оновлена функція для прийняття лайку
async function acceptLike(fromUsername) {
    if (!currentUser) return;

    try {
        // Отримуємо дані користувач��, який поставив лайк
        const response = await fetch(`${API_URL}/users?username=${fromUsername}`);
        const users = await response.json();
        const likerUser = users[0];

        if (!likerUser?.telegramUsername) {
            showMessage('Помилка: користувач не вказав свій Telegram');
            return;
        }

        // Оновлюємо сповіщення як прочитане і прийняте
        const updatedNotifications = currentUser.notifications.map(notification => 
            notification.from === fromUsername 
                ? { ...notification, read: true, status: 'accepted' }
                : notification
        );

        const updatedUser = {
            ...currentUser,
            notifications: updatedNotifications
        };

        await fetch(`${API_URL}/users/${currentUser.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedUser)
        });

        currentUser = updatedUser;
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        
        // Оновлюємо інтерфейс перед перенаправленням
        showNotifications();
        updateNotificationsCount();
        
        // Показуємо повідомлення про успішне прийняття
        showMessage('Лайк прийнято! Переходимо в Telegram...');
        
        // Затримка перед перенаправленям, щоб користувач побчив повідомлення
        setTimeout(() => {
            // Перенаправляємо н Telegram профіль
            window.location.href = `https://t.me/${likerUser.telegramUsername}`;
        }, 1500);

    } catch (error) {
        console.error('Помилка підтвердження лайку:', error);
        showMessage('Помилка підтвердження лайку');
    }
}

// Оновлена функція для відображення сповіщень
function showNotifications() {
    const notificationsList = document.getElementById('notificationsList');
    if (!notificationsList || !currentUser) return;

    const notifications = currentUser.notifications || [];
    
    if (notifications.length === 0) {
        notificationsList.innerHTML = `
            <div class="empty-state">
                <span class="icon">🔔</span>
                <p>Немає нових сповіщень</p>
            </div>
        `;
        return;
    }

    notificationsList.innerHTML = notifications
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .map(notification => `
            <div class="notification-item ${notification.read ? 'read' : 'unread'}">
                <span class="icon">${notification.type === 'like' ? '❤️' : '📢'}</span>
                <div class="notification-content">
                    <p><strong>@${notification.from}</strong> вподобав ваш профіль</p>
                    <small>${new Date(notification.date).toLocaleString()}</small>
                </div>
                ${!notification.read ? `
                    <div class="notification-actions">
                        <button class="button primary" onclick="acceptLike('${notification.from}')">
                            Прийняти
                        </button>
                        <button class="button secondary" onclick="declineLike('${notification.from}')">
                            Відхилити
                        </button>
                    </div>
                ` : notification.status === 'accepted' ? `
                    <div class="notification-status accepted">
                        <span class="icon">✅</span> Прийнято
                    </div>
                ` : notification.status === 'declined' ? `
                    <div class="notification-status declined">
                        <span class="icon">❌</span> Відхилено
                    </div>
                ` : ''}
            </div>
        `).join('');
}

// Функція для відхилення лайку
async function declineLike(fromUsername) {
    if (!currentUser) return;

    try {
        // Оновлюємо сповіщення як прочитане і відхилене
        const updatedNotifications = currentUser.notifications.map(notification => 
            notification.from === fromUsername 
                ? { ...notification, read: true, status: 'declined' }
                : notification
        );

        const updatedUser = {
            ...currentUser,
            notifications: updatedNotifications
        };

        await fetch(`${API_URL}/users/${currentUser.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedUser)
        });

        currentUser = updatedUser;
        localStorage.setItem('currentUser', JSON.stringify(updatedUser));
        
        showNotifications();
        updateNotificationsCount();
        showMessage('Лайк відхилено');
    } catch (error) {
        console.error('Помилка відхилення лайку:', error);
        showMessage('Помилка відхилення лайку');
    }
}

// Додайте функцію для збереження Telegram username
async function saveTelegramUsername(username) {
    if (!currentUser || !currentUser.id) return;

    try {
        // Видаляємо @ якщо користувач його ввів
        const cleanUsername = username.replace('@', '');
        
        // Перевіряємо формат username
        if (!/^[a-zA-Z0-9_]{5,32}$/.test(cleanUsername)) {
            showMessage('Некоректний формат Telegram username');
            return;
        }

        const updatedUser = {
            ...currentUser,
            telegramUsername: cleanUsername
        };

        const response = await fetch(`${API_URL}/users/${currentUser.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedUser)
        });

        if (response.ok) {
            currentUser = updatedUser;
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            hideModal('telegramModal');
            await loadProfile();
            showMessage('Telegram успішно підключено');
        } else {
            throw new Error('Помилка збереження Telegram');
        }
    } catch (error) {
        console.error('Помилка збереження Telegram:', error);
        showMessage('Помилка збереження Telegram');
    }
}

// Функція для донату
function donate(amount) {
    if (!currentUser) return;
    
    // Використовуємо Telegram Web App для відкриття платіжної форми
    tg.MainButton.text = `Підтримати проект (${amount} UAH)`;
    tg.MainButton.show();
    tg.MainButton.onClick(() => {
        // Тут можн додати інтеграцію з платіжною системою
        tg.showPopup({
            title: 'Дякуємо за підтримку!',
            message: `Ви обрали суму ${amount} UAH. Оберіть спосіб оплати:`,
            buttons: [
                {id: 'mono', type: 'default', text: 'Монобанк'},
                {id: 'privat', type: 'default', text: 'ПриватБанк'},
                {id: 'cancel', type: 'cancel', text: 'Скасувати'}
            ]
        });
    });
}

// Функція для введення користувацької суми донату
function customDonate() {
    tg.showPopup({
        title: 'Введіть суму',
        message: 'Введіть суму донату в гривнях:',
        buttons: [
            {id: 'ok', type: 'ok', text: 'OK'},
            {id: 'cancel', type: 'cancel', text: 'Скасувати'}
        ]
    }, (buttonId) => {
        if (buttonId === 'ok') {
            const amount = prompt('Введіть суму в гривнях:');
            if (amount && !isNaN(amount)) {
                donate(Number(amount));
            }
        }
    });
}

// Функція для зв'язку з розробником
function contactDeveloper() {
    // Відкриваємо Telegram чат з рзробником
    window.location.href = 'https://t.me/developer_username';
}

// Функція для активації преміум
async function activatePremium() {
    try {
        const updatedUser = {
            ...currentUser,
            premium: {
                active: true,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 днів
                settings: {
                    profileColor: '#2481cc',
                    animation: 'none',
                    background: 'none',
                    hoverEffect: 'none',
                    statusEmoji: '👑'
                }
            }
        };

        const response = await fetch(`${API_URL}/users/${currentUser.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedUser)
        });

        if (response.ok) {
            currentUser = updatedUser;
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            showMessage('Преміум успішно активовано!');
            updatePremiumUI();
        }
    } catch (error) {
        console.error('Помилка активації преміум:', error);
        showMessage('Помилка активації преміум');
    }
}

// Функція для збереження преміум налаштувань
async function savePremiumSettings() {
    if (!isPremiumActive()) {
        showMessage('Спочатку активуйте преміум');
        return;
    }

    try {
        // Отримуємо всі налаштування
        const settings = {
            profileColor: document.getElementById('profileColor')?.value || '#2481cc',
            animation: document.getElementById('profileAnimation')?.value || 'none',
            background: document.getElementById('profileBackground')?.value || 'none',
            effectColor: document.getElementById('effectColor')?.value || '#00ff00',
            
            // Matrix налаштування
            matrixSpeed: document.getElementById('matrixSpeed')?.value || '20',
            matrixSize: document.getElementById('matrixSize')?.value || '10',
            matrixChars: document.getElementById('matrixChars')?.value || '01',
            
            // Неон налаштування
            neonIntensity: document.getElementById('neonIntensity')?.value || '5',
            neonPulseSpeed: document.getElementById('neonPulseSpeed')?.value || '2',
            
            // Термінл налаштування
            terminalText: document.getElementById('terminalText')?.value || '>',
            terminalBlinkSpeed: document.getElementById('terminalBlinkSpeed')?.value || '1',
            
            // Сніг налаштування
            snowSize: document.getElementById('snowSize')?.value || '2',
            snowSpeed: document.getElementById('snowSpeed')?.value || '10',
            snowDensity: document.getElementById('snowDensity')?.value || '5',
            
            // Емод��і
            statusEmoji: document.querySelector('.emoji-option.selected')?.dataset.emoji || '👑'
        };

        const updatedUser = {
            ...currentUser,
            premium: {
                ...currentUser.premium,
                settings: settings
            }
        };

        const response = await fetch(`${API_URL}/users/${currentUser.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedUser)
        });

        if (response.ok) {
            currentUser = updatedUser;
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            showMessage('Налаштування збережено');
            applyPremiumSettings(settings);
            hideModal('premiumModal');
            loadUsers();
        }
    } catch (error) {
        console.error('Помилка збереження налаштувань:', error);
        showMessage('Помилка збереження налаштувань');
    }
}

// Функція для застосування преміум налаштувань
function applyPremiumSettings(settings) {
    if (!settings) return;
    
    // Застосовуємо CSS змінні глобально
    const root = document.documentElement;
    root.style.setProperty('--effect-color', settings.effectColor || '#00ff00');
    root.style.setProperty('--matrix-speed', `${settings.matrixSpeed || 20}s`);
    root.style.setProperty('--matrix-size', `${settings.matrixSize || 10}px`);
    root.style.setProperty('--neon-intensity', settings.neonIntensity || 5);
    root.style.setProperty('--neon-pulse-speed', `${settings.neonPulseSpeed || 2}s`);
    root.style.setProperty('--terminal-blink-speed', `${settings.terminalBlinkSpeed || 1}s`);
    root.style.setProperty('--snow-size', `${settings.snowSize || 2}px`);
    root.style.setProperty('--snow-speed', `${settings.snowSpeed || 10}s`);
    root.style.setProperty('--snow-density', settings.snowDensity || 5);

    // Оновлюємо всі ��реміум картки
    const premiumCards = document.querySelectorAll('.premium-user');
    premiumCards.forEach(card => {
        // Очищаємо старі класи анімацій
        card.classList.remove(
            'profile-animation-fade',
            'profile-animation-slide',
            'profile-animation-bounce'
        );
        
        // Додаємо нову анімацію
        if (settings.animation) {
            card.classList.add(`profile-animation-${settings.animation}`);
        }
        
        // Встановлюємо атрибути для ефектів
        if (settings.matrixChars) {
            card.setAttribute('data-chars', settings.matrixChars);
        }
        if (settings.terminalText) {
            card.setAttribute('data-terminal-text', settings.terminalText);
        }
        
        // Оновлюємо емодзі
        const premiumIcon = card.querySelector('.premium-icon');
        if (premiumIcon && settings.statusEmoji) {
            premiumIcon.textContent = settings.statusEmoji;
        }
    });
}

// Додаємо завантаження налаштувань при відкритті модального вікна
function updatePremiumUI() {
    const premiumPurchaseContent = document.getElementById('premiumPurchaseContent');
    const premiumSettingsContent = document.getElementById('premiumSettingsContent');
    
    if (isPremiumActive()) {
        premiumPurchaseContent.style.display = 'none';
        premiumSettingsContent.style.display = 'block';
        
        // Оновлюємо інформацію про преміум
        const premiumStatusText = document.getElementById('premiumStatusText');
        premiumStatusText.innerHTML = `
            <span class="icon">👑</span> Преміум активний
            <small>до ${new Date(currentUser.premium.expiresAt).toLocaleDateString()}</small>
        `;
        
        // Завантажуємо збережені налаштування
        if (currentUser.premium.settings) {
            applyPremiumSettings(currentUser.premium.settings);
        }
    } else {
        premiumPurchaseContent.style.display = 'block';
        premiumSettingsContent.style.display = 'none';
    }
}

// Функція для покупки преміуму
async function purchasePremium() {
    try {
        // Тут можна додати лоіку оплати через Telegram Payments
        // Для тесту просто активуємо преміум
        const updatedUser = {
            ...currentUser,
            premium: {
                active: true,
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 днів
                settings: {
                    profileColor: '#2481cc',
                    animation: 'none',
                    background: 'none',
                    effectColor: '#00ff00',
                    statusEmoji: '👑'
                }
            }
        };

        const response = await fetch(`${API_URL}/users/${currentUser.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedUser)
        });

        if (response.ok) {
            currentUser = updatedUser;
            localStorage.setItem('currentUser', JSON.stringify(updatedUser));
            showMessage('Преміум успішно активовано!');
            updatePremiumUI();
        }
    } catch (error) {
        console.error('Помилка активації преміуму:', error);
        showMessage('Помилка активації преміуму');
    }
}

// Додаємо обробник для кнопки покупки
document.getElementById('purchasePremiumBtn')?.addEventListener('click', purchasePremium);

// Оновлюємо функцію перевірки преміум статусу
function isPremiumActive() {
    if (!currentUser?.premium?.active) return false;
    
    // Перевіряємо чи не закінчився термін дії преміуму
    if (currentUser.premium.expiresAt) {
        const expiresAt = new Date(currentUser.premium.expiresAt);
        const now = new Date();
        return expiresAt > now;
    }
    
    return false;
}

// Додаємо нову функцію для відкриття профілю в Telegram
function openTelegramProfile(username) {
    if (!username) return;
    
    // Відкриваємо профіль в Telegram
    window.open(`https://t.me/${username}`, '_blank');
}

// Додайте після ініціалізації додатку
function showAdminPanel() {
    if (currentUser?.username === 'pilk') {
        showPage('admin-page');
        loadAdminData();
    }
}

async function loadAdminData() {
    try {
        const response = await fetch(`${API_URL}/users`);
        const users = await response.json();
        
        // Оновлюємо статистику
        document.getElementById('totalUsers').textContent = users.length;
        document.getElementById('premiumUsers').textContent = 
            users.filter(user => user.premium?.active).length;
        
        // Відображаємо список користувачів
        const usersList = document.getElementById('adminUsersList');
        usersList.innerHTML = users.map(user => `
            <div class="user-item">
                <div class="user-info">
                    <strong>@${user.username}</strong>
                    ${user.premium?.active ? '<span class="premium-badge">👑</span>' : ''}
                </div>
                <div class="user-actions">
                    <button class="button small" onclick="sendMessageToUser('${user.username}')">
                        ✉️
                    </button>
                    <button class="button small danger" onclick="banUser('${user.username}')">
                        🚫
                    </button>
                </div>
            </div>
        `).join('');
        
    } catch (error) {
        console.error('Помилка завантаження даних адмін-панелі:', error);
        showMessage('Помилка завантаження даних');
    }
}

async function sendMessageToUser(username) {
    if (!isAdmin(currentUser)) {
        showMessage('У вас немає прав адміністратора');
        return;
    }
    const message = prompt('Введіть повідомлення для користувача @' + username);
    if (!message) return;
    
    try {
        const response = await fetch(`${API_URL}/users?username=${username}`);
        const users = await response.json();
        const user = users[0];
        
        if (!user) throw new Error('Користувача не знайдено');
        
        const notification = {
            id: Date.now(),
            from: 'pilk',
            type: 'admin_message',
            message: message,
            read: false,
            date: new Date().toISOString(),
            status: 'sent'
        };
        
        const updatedUser = {
            ...user,
            notifications: [...(user.notifications || []), notification]
        };
        
        await fetch(`${API_URL}/users/${user.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedUser)
        });
        
        showMessage('Повідомлення надіслано');
    } catch (error) {
        console.error('Помилка відправки повідомлення:', error);
        showMessage('Помилка відправки повідомлення');
    }
}

async function banUser(username) {
    if (!isAdmin(currentUser)) {
        showMessage('У вас немає прав ад��іністратора');
        return;
    }
    if (!confirm(`Ви впевнені, що хочете заблокувати користувача @${username}?`)) return;
    
    try {
        const response = await fetch(`${API_URL}/users?username=${username}`);
        const users = await response.json();
        const user = users[0];
        
        if (!user) throw new Error('Користувача не знайдено');
        
        const updatedUser = {
            ...user,
            banned: true,
            banDate: new Date().toISOString()
        };
        
        await fetch(`${API_URL}/users/${user.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedUser)
        });
        
        showMessage('Користувача заблоковано');
        loadAdminData();
    } catch (error) {
        console.error('Помилка блокування користувача:', error);
        showMessage('Помилка блокування користувача');
    }
}

// Додаємо обробники подій
document.getElementById('backToProfileBtn')?.addEventListener('click', () => {
    showPage('profile-page');
});

// Додайте цей код для тестування з'єднання
async function testConnection() {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('count');
        
        if (error) throw error;
        console.log('З'єднання успішне!');
        return true;
    } catch (error) {
        console.error('Помилка з'єднання:', error);
        return false;
    }
}

// Викличте функцію при завантаженні
document.addEventListener('DOMContentLoaded', testConnection);


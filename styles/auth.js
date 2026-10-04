(() => {
    const sessionKey = 'betKingDemoUser';
    const accountsKey = 'betKingDemoAccounts';

    function readStoredValue(key, fallback) {
        try {
            return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
        } catch {
            return fallback;
        }
    }

    function readUser() {
        return readStoredValue(sessionKey, null);
    }

    function hashPassword(password, salt) {
        const data = new TextEncoder().encode(`${salt}:${password}`);
        return crypto.subtle.digest('SHA-256', data).then((hash) =>
            Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('')
        );
    }

    function setStatus(status, message, isError = false) {
        status.textContent = message;
        status.classList.toggle('is-error', isError);
        status.hidden = false;
    }

    function redirectAfterAuth(status, params) {
        const returnTo = params.get('return');
        if (!returnTo) {
            return;
        }

        try {
            const destination = new URL(returnTo, location.href);
            if (destination.origin === location.origin && !destination.pathname.endsWith('/login.html')) {
                status.textContent += ' Повертаємося на попередню сторінку...';
                setTimeout(() => location.assign(destination.href), 700);
            }
        } catch {
            // Keep the user on the auth page when the return URL is invalid.
        }
    }

    function getLoginUrl(mode) {
        const loginUrl = new URL(
            location.pathname.toLowerCase().includes('/templates/')
                ? 'login.html'
                : '../templates/login.html',
            location.href
        );
        loginUrl.searchParams.set('return', location.href);
        loginUrl.searchParams.set('mode', mode);
        return loginUrl.href;
    }

    const signInButton = document.querySelector('.header-signin');
    const user = readUser();

    if (signInButton) {
        if (user?.username) {
            const avatar = document.createElement('span');
            avatar.className = 'header-user-avatar';
            avatar.textContent = Array.from(user.username.trim())[0]?.toUpperCase() || '?';
            avatar.title = user.username;
            avatar.setAttribute('aria-hidden', 'true');
            signInButton.parentElement.insertBefore(avatar, signInButton);
            signInButton.textContent = 'Вийти';
            signInButton.title = user.username;
            signInButton.setAttribute('aria-label', `Вийти з облікового запису ${user.username}`);
            signInButton.addEventListener('click', () => {
                localStorage.removeItem(sessionKey);
                location.reload();
            });
        } else {
            const accountIcon = document.createElement('img');
            accountIcon.className = 'header-auth-icon';
            accountIcon.src = new URL('../ads/6681204.png', location.href).href;
            accountIcon.alt = '';
            signInButton.textContent = '';
            signInButton.appendChild(accountIcon);
            signInButton.classList.add('header-signin-trigger');
            signInButton.setAttribute('aria-label', 'Відкрити меню входу та реєстрації');

            const authMenu = document.createElement('div');
            authMenu.className = 'header-auth-menu';
            signInButton.parentElement.insertBefore(authMenu, signInButton);
            authMenu.appendChild(signInButton);

            const dropdown = document.createElement('div');
            dropdown.className = 'header-auth-dropdown';
            dropdown.setAttribute('aria-label', 'Обліковий запис');

            const loginLink = document.createElement('a');
            loginLink.href = getLoginUrl('login');
            loginLink.textContent = 'Log in';

            const registerLink = document.createElement('a');
            registerLink.href = getLoginUrl('register');
            registerLink.textContent = 'Sign in';

            dropdown.append(loginLink, registerLink);
            authMenu.appendChild(dropdown);
            signInButton.setAttribute('aria-haspopup', 'true');
            signInButton.addEventListener('click', () => {
                location.href = getLoginUrl('login');
            });
        }
    }

    const form = document.querySelector('#login-form');
    if (!form) {
        return;
    }

    const status = document.querySelector('#login-status');
    const params = new URLSearchParams(location.search);
    const usernameInput = form.elements.username;
    const passwordInput = form.elements.password;
    const confirmField = document.querySelector('#confirm-password-field');
    const confirmInput = form.elements.confirmPassword;
    const title = document.querySelector('#login-title');
    const intro = document.querySelector('#login-intro');
    const submitButton = form.querySelector('.auth-submit');
    const modeButtons = document.querySelectorAll('[data-auth-mode]');
    let mode = params.get('mode') === 'register' ? 'register' : 'login';

    function setMode(nextMode) {
        mode = nextMode;
        const registering = mode === 'register';
        title.textContent = registering ? 'Створити обліковий запис' : 'Вхід';
        intro.textContent = registering
            ? 'Придумайте ім’я користувача та пароль для облікового запису.'
            : 'Увійдіть за допомогою імені користувача та пароля.';
        submitButton.textContent = registering ? 'Зареєструватися' : 'Увійти';
        confirmField.hidden = !registering;
        confirmInput.required = registering;
        confirmInput.disabled = !registering;
        passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
        status.hidden = true;
        modeButtons.forEach((button) => {
            const selected = button.dataset.authMode === mode;
            button.classList.toggle('is-active', selected);
            button.setAttribute('aria-pressed', String(selected));
        });
    }

    modeButtons.forEach((button) => {
        button.addEventListener('click', () => setMode(button.dataset.authMode));
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        if (!form.reportValidity()) {
            return;
        }

        const username = usernameInput.value.trim();
        const normalizedUsername = username.toLowerCase();
        const password = passwordInput.value;
        const accounts = readStoredValue(accountsKey, {});

        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            setStatus(status, 'Ім’я користувача: 3–20 символів, лише латинські літери, цифри та _.', true);
            return;
        }

        try {
            if (mode === 'register') {
                if (accounts[normalizedUsername]) {
                    setStatus(status, 'Це ім’я користувача вже зайняте.', true);
                    return;
                }
                if (password !== confirmInput.value) {
                    setStatus(status, 'Паролі не збігаються.', true);
                    return;
                }

                const salt = crypto.getRandomValues(new Uint8Array(16));
                const saltValue = Array.from(salt, (byte) => byte.toString(16).padStart(2, '0')).join('');
                const passwordHash = await hashPassword(password, saltValue);
                accounts[normalizedUsername] = { username, salt: saltValue, passwordHash };
                localStorage.setItem(accountsKey, JSON.stringify(accounts));
            } else {
                const account = accounts[normalizedUsername];
                if (!account || await hashPassword(password, account.salt) !== account.passwordHash) {
                    setStatus(status, 'Неправильне ім’я користувача або пароль.', true);
                    return;
                }
            }

            localStorage.setItem(sessionKey, JSON.stringify({ username }));
        } catch {
            setStatus(status, 'Не вдалося зберегти обліковий запис. Відкрийте сайт через локальний сервер і перевірте налаштування браузера.', true);
            return;
        }

        passwordInput.value = '';
        confirmInput.value = '';
        setStatus(status, mode === 'register' ? `Обліковий запис ${username} створено.` : `Ви увійшли як ${username}.`);
        redirectAfterAuth(status, params);
    });

    setMode(mode);
})();
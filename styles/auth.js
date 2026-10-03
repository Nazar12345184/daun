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
                status.textContent += ' Возвращаем на предыдущую страницу...';
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
            signInButton.textContent = 'Выйти';
            signInButton.title = user.username;
            signInButton.setAttribute('aria-label', `Выйти из аккаунта ${user.username}`);
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
            signInButton.setAttribute('aria-label', 'Открыть меню входа и регистрации');

            const authMenu = document.createElement('div');
            authMenu.className = 'header-auth-menu';
            signInButton.parentElement.insertBefore(authMenu, signInButton);
            authMenu.appendChild(signInButton);

            const dropdown = document.createElement('div');
            dropdown.className = 'header-auth-dropdown';
            dropdown.setAttribute('aria-label', 'Аккаунт');

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
        title.textContent = registering ? 'Создать аккаунт' : 'Вход';
        intro.textContent = registering
            ? 'Придумайте юзернейм и пароль для аккаунта.'
            : 'Войдите, используя юзернейм и пароль.';
        submitButton.textContent = registering ? 'Зарегистрироваться' : 'Войти';
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
            setStatus(status, 'Юзернейм: 3–20 символов, только латинские буквы, цифры и _.', true);
            return;
        }

        try {
            if (mode === 'register') {
                if (accounts[normalizedUsername]) {
                    setStatus(status, 'Этот юзернейм уже занят.', true);
                    return;
                }
                if (password !== confirmInput.value) {
                    setStatus(status, 'Пароли не совпадают.', true);
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
                    setStatus(status, 'Неверный юзернейм или пароль.', true);
                    return;
                }
            }

            localStorage.setItem(sessionKey, JSON.stringify({ username }));
        } catch {
            setStatus(status, 'Не удалось сохранить аккаунт. Откройте сайт через локальный сервер и проверьте настройки браузера.', true);
            return;
        }

        passwordInput.value = '';
        confirmInput.value = '';
        setStatus(status, mode === 'register' ? `Аккаунт ${username} создан.` : `Вы вошли как ${username}.`);
        redirectAfterAuth(status, params);
    });

    setMode(mode);
})();
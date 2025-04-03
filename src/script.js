const API_URL = 'http://localhost:5000/api';

// Общие функции
async function redirectToDashboard() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return;
    window.location.href = user.role === 'user' ? 'user.html' : 'mainTrainer.html';
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// Загрузка данных пользователя
async function loadUserData() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) return logout();

    if (window.location.pathname.includes('user.html')) {
        document.getElementById('user-name').textContent = user.name;
        document.getElementById('user-email').textContent = user.email;
        document.getElementById('user-role').textContent = 'Пользователь';

        try {
            const response = await fetch(`${API_URL}/user-survey`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });

            if (response.ok) {
                const survey = await response.json();
                const surveyData = document.getElementById('survey-data');
                const noSurvey = document.getElementById('no-survey');

                if (survey) {
                    document.getElementById('survey-age').textContent = survey.age || 'не указан';
                    document.getElementById('survey-level').textContent = 
                        survey.fitnessLevel === 'beginner' ? 'Начинающий' :
                        survey.fitnessLevel === 'intermediate' ? 'Средний' :
                        survey.fitnessLevel === 'advanced' ? 'Продвинутый' : 'не указан';
                    document.getElementById('survey-goals').textContent = 
                        survey.goals?.join(', ') || 'не указаны';
                    
                    surveyData.style.display = 'grid';
                    noSurvey.style.display = 'none';
                } else {
                    surveyData.style.display = 'none';
                    noSurvey.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки опроса:', error);
        }
    } else if (window.location.pathname.includes('mainTrainer.html')) {
        document.getElementById('coach-name').textContent = user.name;
        document.getElementById('coach-email').textContent = user.email;
    }
}

// Обработка формы опроса
async function handleSurveyForm() {
    const form = document.getElementById('survey-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const surveyData = {
            age: document.getElementById('age').value,
            fitnessLevel: document.getElementById('fitness-level').value,
            goals: Array.from(document.querySelectorAll('input[name="goals"]:checked'))
                   .map(el => el.value)
        };

        try {
            const response = await fetch(`${API_URL}/complete-survey`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(surveyData)
            });

            if (!response.ok) throw new Error('Ошибка сохранения опроса');

            const user = JSON.parse(localStorage.getItem('user'));
            user.surveyCompleted = true;
            localStorage.setItem('user', JSON.stringify(user));

            window.location.href = 'user.html';
        } catch (error) {
            alert('Ошибка: ' + error.message);
        }
    });
}

// Редактирование профиля пользователя
async function editProfile() {
    const nameEl = document.getElementById('settings-user-name');
    const emailEl = document.getElementById('settings-user-email');
    
    // Включаем редактирование полей
    nameEl.contentEditable = true;
    emailEl.contentEditable = true;
    
    // Добавляем кнопку сохранения
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn';
    saveBtn.textContent = 'Сохранить';
    
    // Обработчик для сохранения
    saveBtn.addEventListener('click', async () => {
        const newName = nameEl.textContent.trim();
        const newEmail = emailEl.textContent.trim();
        
        if (!newName || !newEmail) {
            alert('Имя и email не могут быть пустыми!');
            return;
        }

        try {
            // Отправляем запрос на сервер для обновления данных
            const response = await fetch(`${API_URL}/update-profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ name: newName, email: newEmail })
            });

            if (!response.ok) throw new Error('Ошибка обновления профиля');

            // Обновляем данные в localStorage
            const updatedUser = await response.json();
            localStorage.setItem('user', JSON.stringify(updatedUser));

            // Обновляем UI
            nameEl.contentEditable = false;
            emailEl.contentEditable = false;
            saveBtn.remove();

            alert('Профиль успешно обновлен!');
        } catch (error) {
            alert(error.message);
        }
    });

    // Добавляем кнопку сохранения на страницу
    const actionsSection = document.querySelector('.actions-section');
    actionsSection.appendChild(saveBtn);
}

// Восстановление пароля
function initPasswordReset() {
    const form = document.getElementById('reset-password-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('reset-email').value;
        const code = document.getElementById('reset-code').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword !== confirmPassword) {
            alert('Пароли не совпадают!');
            return;
        }

        try {
            // Сначала проверяем код
            const verifyResponse = await fetch(`${API_URL}/verify-reset-code`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code })
            });

            const verifyData = await verifyResponse.json();
            if (!verifyResponse.ok) throw new Error(verifyData.error || 'Неверный код');

            // Если код верный, меняем пароль
            const resetResponse = await fetch(`${API_URL}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token: verifyData.tempToken,
                    newPassword
                })
            });

            const resetData = await resetResponse.json();
            if (!resetResponse.ok) throw new Error(resetData.error || 'Ошибка сброса пароля');

            alert('Пароль успешно изменен!');
            window.location.href = 'index.html';
        } catch (error) {
            alert(error.message);
        }
    });
}

// Инициализация страниц
function initAuthPages() {
    // Переключение между формами
    document.getElementById('login-toggle')?.addEventListener('click', () => {
        document.getElementById('login-form').classList.remove('hidden');
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('forgot-password-form').classList.add('hidden');
        document.getElementById('login-toggle').classList.add('active');
        document.getElementById('register-toggle').classList.remove('active');
    });

    document.getElementById('register-toggle')?.addEventListener('click', () => {
        document.getElementById('register-form').classList.remove('hidden');
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('forgot-password-form').classList.add('hidden');
        document.getElementById('register-toggle').classList.add('active');
        document.getElementById('login-toggle').classList.remove('active');
    });

    // Форма входа
    document.getElementById('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${API_URL}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: document.getElementById('login-email').value,
                    password: document.getElementById('login-password').value
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Ошибка входа');

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            await redirectToDashboard();
        } catch (error) {
            alert(error.message);
        }
    });

    // Форма регистрации
    document.getElementById('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${API_URL}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: document.getElementById('register-name').value,
                    email: document.getElementById('register-email').value,
                    password: document.getElementById('register-password').value,
                    role: document.getElementById('register-role').value
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Ошибка регистрации');

            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            await redirectToDashboard();
        } catch (error) {
            alert(error.message);
        }
    });

    // Кнопка "Забыли пароль?"
    document.getElementById('forgot-password')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('register-form').classList.add('hidden');
        document.getElementById('forgot-password-form').classList.remove('hidden');
    });

    // Кнопка "Назад к входу"
    document.getElementById('back-to-login')?.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('forgot-password-form').classList.add('hidden');
        document.getElementById('login-form').classList.remove('hidden');
    });

    // Форма запроса кода восстановления
    document.getElementById('forgot-password-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${API_URL}/request-password-reset`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: document.getElementById('reset-email').value
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Ошибка запроса сброса пароля');
            
            alert(`Ваш код восстановления: ${data.code}\n(В реальном приложении код не показывается)`);
            window.location.href = 'reset-password.html';
        } catch (error) {
            alert(error.message);
        }
    });
}

function initDashboard() {
    // Кнопка выхода
    document.getElementById('logout-btn')?.addEventListener('click', logout);
    
    // Кнопка "Пройти опрос"
    document.getElementById('retake-survey-btn')?.addEventListener('click', () => {
        window.location.href = 'survey.html';
    });

    // Кнопка редактирования профиля (только для пользователей)
    const editBtn = document.getElementById('edit-profile-btn');
    if (editBtn) {
        const user = JSON.parse(localStorage.getItem('user'));
        if (user.role === 'user') {
            editBtn.addEventListener('click', editProfile);
        } else {
            editBtn.style.display = 'none';
        }
    }
}

// Проверка авторизации
function checkAuth() {
    const token = localStorage.getItem('token');
    const allowedPages = ['index.html', 'reset-password.html'];
    const isAllowedPage = allowedPages.some(page => window.location.pathname.endsWith(page));

    if (!token && !isAllowedPage) {
        logout();
    } else if (token && window.location.pathname.endsWith('index.html')) {
        redirectToDashboard();
    }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
    checkAuth();
    initAuthPages();
    initDashboard();
    loadUserData();
    handleSurveyForm();
    initPasswordReset();
});
require('dotenv').config();
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { body, validationResult } = require('express-validator');

const app = express();

// Настройка сервера
app.use(cors());
app.use(express.json());

if (!process.env.JWT_SECRET) {
  console.error('FATAL ERROR: JWT_SECRET не установлен');
  process.exit(1);
}

const JWT_SECRET = process.env.JWT_SECRET;
const PORT = process.env.PORT || 5000;

// Временная "база данных"
const users = [];
const userSurveys = {};
const resetCodes = {};

// Вспомогательные функции
const findUserByEmail = (email) => users.find(user => user.email === email);
const findUserById = (id) => users.find(user => user.id === id);

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
};

// Middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// API Endpoints

// Регистрация
app.post('/api/register', [
  body('name').notEmpty(),
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['user', 'coach'])
], validateRequest, async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (findUserByEmail(email)) return res.status(400).json({ error: 'Email уже используется' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: Date.now().toString(),
      name,
      email,
      password: hashedPassword,
      role,
      surveyCompleted: false
    };

    users.push(newUser);
    const token = generateToken(newUser);

    res.status(201).json({ token, user: newUser });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Вход
app.post('/api/login', [
  body('email').isEmail(),
  body('password').notEmpty()
], validateRequest, async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = findUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Неверные учетные данные' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Неверные учетные данные' });

    const token = generateToken(user);
    res.json({ token, user });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Восстановление пароля - запрос кода
app.post('/api/request-password-reset', [
  body('email').isEmail()
], validateRequest, async (req, res) => {
  try {
    const { email } = req.body;
    const user = findUserByEmail(email);
    
    // Всегда возвращаем успех для безопасности
    if (!user) return res.json({ success: true });

    // Генерация 6-значного кода
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    resetCodes[email] = {
      code: resetCode,
      expires: Date.now() + 900000, // 15 минут
      attempts: 0
    };

    // Возвращаем код для тестирования
    res.json({ 
      success: true,
      code: resetCode
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Проверка кода восстановления
app.post('/api/verify-reset-code', [
  body('email').isEmail(),
  body('code').matches(/^\d{6}$/)
], validateRequest, async (req, res) => {
  try {
    const { email, code } = req.body;
    const record = resetCodes[email];

    if (!record) return res.status(400).json({ error: 'Сначала запросите код сброса' });
    if (record.attempts >= 3) return res.status(429).json({ error: 'Слишком много попыток' });
    if (record.expires < Date.now()) {
      delete resetCodes[email];
      return res.status(400).json({ error: 'Срок действия кода истек' });
    }
    if (record.code !== code) {
      record.attempts += 1;
      return res.status(400).json({ error: 'Неверный код' });
    }

    const tempToken = jwt.sign({ email, action: 'password_reset' }, JWT_SECRET, { expiresIn: '15m' });
    delete resetCodes[email];
    res.json({ success: true, tempToken });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Сброс пароля
app.post('/api/reset-password', [
  body('tempToken').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], validateRequest, async (req, res) => {
  try {
    const { tempToken, newPassword } = req.body;
    jwt.verify(tempToken, JWT_SECRET, async (err, decoded) => {
      if (err || decoded?.action !== 'password_reset') {
        return res.status(400).json({ error: 'Недействительный токен' });
      }

      const userIndex = users.findIndex(u => u.email === decoded.email);
      if (userIndex === -1) return res.status(404).json({ error: 'Пользователь не найден' });

      users[userIndex].password = await bcrypt.hash(newPassword, 10);
      res.json({ success: true, message: 'Пароль успешно изменен' });
    });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// Опрос
app.post('/api/complete-survey', authenticateToken, [
  body('age').isInt({ min: 12, max: 100 }),
  body('fitnessLevel').isIn(['beginner', 'intermediate', 'advanced']),
  body('goals').isArray()
], validateRequest, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = findUserById(userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    const { age, fitnessLevel, goals } = req.body;
    userSurveys[userId] = { age, fitnessLevel, goals };

    const userIndex = users.findIndex(u => u.id === userId);
    users[userIndex].surveyCompleted = true;

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.get('/api/user-survey', authenticateToken, (req, res) => {
  const survey = userSurveys[req.user.id];
  if (!survey) return res.status(404).json({ error: 'Данные опроса не найдены' });
  res.json(survey);
});

app.post('/update-profile', authenticateToken, async (req, res) => {
  const { name, email } = req.body;
  const userId = req.user.id;

  try {
      const updatedUser = await User.findByIdAndUpdate(userId, { name, email }, { new: true });
      res.json(updatedUser);
  } catch (error) {
      res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
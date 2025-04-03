require('dotenv').config(); // Загружаем переменные окружения из .env

const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Настройки подключения к PostgreSQL из .env
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

// Проверка подключения к БД
pool.query('SELECT NOW()', (err) => {
  if (err) {
    console.error('Ошибка подключения к PostgreSQL:', err);
  } else {
    console.log('Успешное подключение к PostgreSQL');
  }
});

// API для создания тренировки
app.post('/api/workouts', async (req, res) => {
  try {
    const { 
      title, 
      description, 
      type, 
      level, 
      duration, 
      instructions, 
      youtubeLink,
      trainerId
    } = req.body;

    const result = await pool.query(
      `INSERT INTO workouts 
      (title, description, type, level, duration, instructions, youtube_link, trainer_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description, type, level, duration, instructions, youtubeLink, trainerId]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Ошибка при создании тренировки:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API для получения всех тренировок
app.get('/api/workouts', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM workouts ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка при получении тренировок:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// API для получения тренировок тренера
app.get('/api/workouts/trainer/:trainerId', async (req, res) => {
  try {
    const { trainerId } = req.params;
    const result = await pool.query(
      'SELECT * FROM workouts WHERE trainer_id = $1 ORDER BY created_at DESC',
      [trainerId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Ошибка при получении тренировок тренера:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});
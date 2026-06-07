
# 📘 Sport Events Management System

> Вебзастосунок для пошуку, резервування та адміністрування спортивних заходів з підтримкою ролей користувача, організатора та адміністратора.

---

## 👤 Автор

- **ПІБ**:Михалко Анна
- **Група**: ФЕІ-45
- **Керівник**: доцент Вельгош Сергій
- **Дата виконання**: [27.05.2026]

---

## 📌 Загальна інформація

- **Тип проєкту**: Вебзастосунок
- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Backend:** NestJS, TypeScript
- **База даних:** SQLite
- **ORM:** Prisma ORM
- **Авторизація:** JWT Authentication
- **Менеджер пакетів:** PNPM

---

## 🧠 Опис функціоналу

**Для користувача**:
- Реєстрація та авторизація
- Перегляд спортивних заходів
- Пошук, фільтрація та сортування подій
- Отримання рекомендацій подій
- Подання заявки на участь
- Перегляд історії участі
- Отримання сповіщень
**Для організатора:**
- Створення спортивних подій
- Редагування та видалення подій
- Перегляд заявок учасників
- Підтвердження та відхилення заявок
- Виконання check-in учасників
- Експорт списку учасників
**Для адміністратора:**
- Перегляд аналітики системи
- Контроль подій
- Перегляд журналу дій
- Моніторинг активності користувачів

---

## 🧱 Основні модулі системи

| Модуль                | Призначення |
|-----------------------|-------------|
| `AuthModule`          | Реєстрація та авторизація користувачів |
| `EventsModule`        | Керування спортивними подіями |
| `NotificationsModule` | Обробка заявок на участь |
| `AnalyticsModule`     | Формування статистики |
| `Waitlist`            | Список очікування при відсутності місць |

---

## ▶️ Як запустити проєкт "з нуля"

### 1. Встановлення інструментів

- Node.js 22+
- PNPM

### 2. Клонування репозиторію

```bash
git clone <repository-url>
cd SportEventApp
```

### 3. Встановлення залежностей

pnpm install

# Налаштування середовища

Файл:

apps/api/.env
DATABASE_URL="file:./dev.db"
JWT_SECRET="super-secret-key"
JWT_EXPIRES_IN="7d"
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Генерація Prisma Client
cd apps/api
pnpm prisma generate

# Заповнення тестовими даними
pnpm prisma db seed

# Запуск Backend
pnpm --filter api start:dev

# Запуск Frontend
pnpm --filter web dev

Після запуску система буде доступна за адресою:

Frontend: http://localhost:3000
Backend: http://localhost:3001

---

### 🔐 Тестові облікові записи

**Адміністратор**

Email: admin@test.com 
Пароль: 123456


**Організатор** 

Email: organizer@test.com
Пароль: 123456

**Користувач**
Email: u1@test.com
Пароль: 123456

---

### 🔌 Основні API маршрути

**Авторизація**

POST /auth/register
POST /auth/login

**Події**

GET    /events
GET    /events/recommended
GET    /events/:id
POST   /events
PATCH  /events/:id
DELETE /events/:id

**Заявки**

GET    /events/:id/bookings
POST   /events/:id/bookings
PATCH  /bookings/:id
POST   /events/:eventId/bookings/:bookingId/check-in

**Сповіщення**

GET  /notifications/my
POST /notifications/read-all

**Аналітика**

GET /events/analytics/overview

---

## 🖱️ Інструкція для користувача

1. Увійти до системи під одним із тестових облікових записів.

2. Перейти до сторінки подій.

3. Використати пошук або фільтри для пошуку потрібного заходу.

4. Відкрити сторінку події та подати заявку на участь.

5. Відстежувати статус заявки в особистому кабінеті та через систему сповіщень.

6. Організатор може підтвердити або відхилити заявку, а також виконати check-in учасників.
---

## 📊 Реалізовані можливості
- Пошук подій
- Фільтрація та сортування
- Рекомендації подій
- Подання заявок
- Підтвердження та відхилення заявок
- Waitlist
- Check-in учасників
- Система сповіщень
- Журнал дій
- Аналітика
- Рольовий доступ

## 🧪 Проблеми і рішення

| Проблема              | Рішення                          |
|-----------------------|----------------------------------|
| Prisma Client Error   | Виконати prisma generate         |
| Database Error        | Перевірити DATABASE_URL          |
| JWT Error             | Перевірити JWT_SECRET            |
| CORS Error            | Перевірити CORS_ORIGIN           |
| Port already in use   | Змінити порт або завершити процес|

---

## 🧾 Використані джерела / література

- NestJS Documentation.
- Next.js Documentation.
- Prisma ORM Documentation.
- React Documentation.
- TypeScript Documentation.
- JWT Documentation.
- PNPM Documentation.

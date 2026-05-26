import { AppHeader } from './components/app-header';

const features = [
  'рольовий доступ для користувача, організатора й адміністратора',
  'заявки на участь із підтвердженням, відхиленням і відміткою присутності',
  'лист очікування та автоматичне просування при звільненні місця',
  'аналітика переглядів, популярності та заповнюваності подій',
  'анкета спортивних інтересів користувача',
  'оцінювання події після фактичної участі',
  'запити користувачів на створення нових подій',
  'голосування за додаткову дату, локацію або час',
];

const quickLinks = [
  {
    title: 'Каталог подій',
    description: 'Пошук, фільтри, рекомендації та перегляд доступних спортивних подій.',
    href: '/events',
    label: 'Відкрити події',
    role: 'Усі ролі',
  },
  {
    title: 'Моя участь',
    description: 'Заявки користувача, лист очікування, сповіщення, голосування та оцінювання подій.',
    href: '/my-bookings',
    label: 'Перейти до участі',
    role: 'Користувач',
  },
  {
    title: 'Мої інтереси',
    description: 'Анкета спортивних інтересів і створення запиту на нову спортивну подію.',
    href: '/interests',
    label: 'Заповнити анкету',
    role: 'Користувач',
  },
  {
    title: 'Панель організатора',
    description: 'Керування подіями, заявками, запитами користувачів і попитом на додаткові варіанти.',
    href: '/organizer/events',
    label: 'Відкрити панель',
    role: 'Організатор / адміністратор',
  },
  {
    title: 'Створення події',
    description: 'Форма створення нової спортивної події організатором або адміністратором.',
    href: '/create-event',
    label: 'Створити подію',
    role: 'Організатор / адміністратор',
  },
  {
    title: 'Адміністративна аналітика',
    description: 'Графіки, статистика, останні дії, ролі користувачів і стан системи.',
    href: '/analytics',
    label: 'Відкрити аналітику',
    role: 'Адміністратор',
  },
  {
    title: 'Сповіщення',
    description: 'Останні системні повідомлення щодо заявок, подій і змін статусів.',
    href: '/notifications',
    label: 'Переглянути сповіщення',
    role: 'Авторизований користувач',
  },
];

export default function HomePage() {
  return (
    <div className="page-shell">
      <AppHeader title="Sport Events App" subtitle="Платформа керування спортивними подіями" />

      <main>
        <section className="hero">
          

          <h1>Пошук, бронювання і повний цикл управління спортивними подіями</h1>

          <p>
            Система підтримує рольову модель доступу, модерацію заявок, персоналізовані
            рекомендації, анкету спортивних інтересів, запити користувачів на нові події,
            голосування за додаткові варіанти, оцінювання після участі та аналітику для
            організатора й адміністратора.
          </p>

          <div className="hero-actions">
            <a className="primary-btn" href="/events">
              Перейти до подій
            </a>

            <a className="secondary-btn" href="/login">
              Увійти в систему
            </a>

            <a className="secondary-btn" href="/interests">
              Мої інтереси
            </a>

            <a className="secondary-btn" href="/my-bookings">
              Моя участь
            </a>
          </div>

          
        </section>

        <section style={{ marginTop: 26 }}>
          <h2 className="section-title">Швидкий доступ до модулів</h2>

          <div className="grid grid-3">
            {quickLinks.map((item) => (
              <div key={item.title} className="card quick-card">
                <div className="card-body">
                  <span className="badge info">{item.role}</span>

                  <h3>{item.title}</h3>

                  <p className="muted" style={{ lineHeight: 1.6 }}>
                    {item.description}
                  </p>

                  <a className="secondary-btn" href={item.href}>
                    {item.label}
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
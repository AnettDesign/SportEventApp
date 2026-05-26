'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCurrentName, getCurrentRole, roleHome, roleLabel, type UserRole } from '../lib/session';

type LinkItem = {
  href: string;
  label: string;
};

export function AppHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    setRole(getCurrentRole());
    setName(getCurrentName());
  }, []);

  const links = useMemo<LinkItem[]>(() => {
    const base: LinkItem[] = [
      { href: '/', label: 'Головна' },
      { href: '/events', label: 'Події' },
    ];

    if (role === 'USER') {
      base.push({ href: '/my-bookings', label: 'Моя участь' });
      base.push({ href: '/interests', label: 'Мої інтереси' });
      base.push({ href: '/notifications', label: 'Сповіщення' });
    }

    if (role === 'ORGANIZER') {
      base.push({ href: '/create-event', label: 'Створити подію' });
      base.push({ href: '/organizer/events', label: 'Панель організатора' });
      base.push({ href: '/organizer/events', label: 'Запити й попит' });
      base.push({ href: '/notifications', label: 'Сповіщення' });
    }

    if (role === 'ADMIN') {
      base.push({ href: '/create-event', label: 'Створити подію' });
      base.push({ href: '/organizer/events', label: 'Керування подіями' });
      base.push({ href: '/organizer/events', label: 'Запити й попит' });
      base.push({ href: '/analytics', label: 'Адмін-панель' });
      base.push({ href: '/notifications', label: 'Сповіщення' });
    }

    if (!role) {
      base.push({ href: '/login', label: 'Увійти' });
    }

    return base;
  }, [role]);

  async function onLogout() {
    try {
      await fetch('/api/session/logout', { method: 'POST' });
    } finally {
      window.location.href = '/login';
    }
  }

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <div className="brand">
          <a href={roleHome(role)} className="brand-badge">
            SE
          </a>

          <div>
            <div>{title}</div>
            {subtitle ? <div className="muted topbar-subtitle">{subtitle}</div> : null}
          </div>
        </div>

        <div className="topbar-right">
          <nav className="nav-links">
            {links.map((link) => (
              <a key={`${link.href}-${link.label}`} className="nav-link" href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          {role ? (
            <div className="user-chip-wrap">
              <span className="user-chip">
                {name || 'Користувач'} · {roleLabel(role)}
              </span>

              <button className="secondary-btn compact-btn" onClick={onLogout}>
                Вийти
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
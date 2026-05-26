import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ToastProvider } from './components/toast-provider';

const geistSans = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist-sans',
});
const geistMono = localFont({
  src: './fonts/GeistMonoVF.woff',
  variable: '--font-geist-mono',
});

export const metadata: Metadata = {
  title: 'Sport Events App',
  description: 'Інформаційна система для пошуку та резервування спортивних заходів',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="uk">
      <body className={`${geistSans.variable} ${geistMono.variable}`}><ToastProvider>{children}</ToastProvider></body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/lib/AuthContext';
import AuthBoundary from '@/components/AuthBoundary';

export const metadata: Metadata = {
  title: 'KONJO Inventory',
  description: 'Real-time stock logging for the KONJO Foods warehouse.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'KONJO Inventory',
  },
  icons: {
    icon: '/icons/icon-512.png',
    apple: '/icons/apple-touch-icon.png',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#201512',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-konjo-charcoal font-body text-konjo-cream antialiased">
        <AuthProvider><AuthBoundary>{children}</AuthBoundary></AuthProvider>
      </body>
    </html>
  );
}

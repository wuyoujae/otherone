import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { DesktopTitlebar } from '@/components/layout/desktop-titlebar';
import { MessageProvider } from '@/components/ui/message/message-provider';
import { GlobalAiFab } from '@/components/ui/global-ai-fab';
import './globals.css';

export const metadata: Metadata = {
  title: 'OtherOne',
  description: 'OtherOne - AI-powered agile development management platform',
  icons: {
    icon: '/otherone-icon.svg',
    shortcut: '/otherone-icon.svg',
    apple: '/otherone-icon.svg',
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className="min-h-screen bg-surface-subtle text-foreground antialiased">
        <NextIntlClientProvider messages={messages}>
          <MessageProvider>
            <div className="flex min-h-screen flex-col">
              <DesktopTitlebar />
              <div className="flex-1 min-h-0">{children}</div>
            </div>
            <GlobalAiFab />
          </MessageProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { MessageProvider } from '@/components/ui/message/message-provider';
import { GlobalAiFab } from '@/components/ui/global-ai-fab';
import './globals.css';

export const metadata: Metadata = {
  title: 'OtherOne',
  description: 'OtherOne - AI-powered agile development management platform',
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
      <body className="bg-surface-subtle text-foreground antialiased">
        <NextIntlClientProvider messages={messages}>
          <MessageProvider>
            {children}
            <GlobalAiFab />
          </MessageProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

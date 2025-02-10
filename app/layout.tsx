
import './globals.css';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/components/ThemeProvider';
import { CartProvider } from './contexts/CartContext';
import AuthProviders from './providers/authProviders';
import ClientLayout from './clientLayout '; // Import the ClientLayout
const inter = Inter({ subsets: ['latin'] });
import { Toaster } from '@/components/ui/toast'

export const metadata = {
  title: 'Paperclip Consign MVP',
  description: 'Digital inventory management for consignment stores',
};

export default function RootLayout({
  children,
  session,
}: {
  children: React.ReactNode;
  session: any;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProviders session={session}>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <CartProvider>
              <ClientLayout>{children}<Toaster /></ClientLayout>
            </CartProvider>
          </ThemeProvider>
        </AuthProviders>
      </body>
    </html>
  );
}
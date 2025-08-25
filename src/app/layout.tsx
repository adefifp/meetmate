// src/app/layout.tsx
import "./globals.css";
import Navbar from "@/components/Navbar";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <Navbar />
        <main className="container-page py-6">{children}</main>
      </body>
    </html>
  );
}

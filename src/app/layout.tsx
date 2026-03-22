import type { Metadata } from "next";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "taskFlow",
  description: "Personal Task Manager",

  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'taskFlow',
  },

  openGraph: {
    title: 'taskFlow',
    description: 'Your personal task manager',
    type: 'website'
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta 
        name="viewport"
        content="width=device-width, initial-scale=1, viewport-fit=cover"/>
        <link rel="apple-touch-icon" href="/icon-192x192" />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister/>
      </body>
    </html>
  )
}

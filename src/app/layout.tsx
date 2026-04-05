import type { Metadata } from 'next'
import './globals.css'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegistration'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'TaskFlow',
  description: 'Personal task manager',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TaskFlow',
  },
  openGraph: {
    title: 'TaskFlow',
    description: 'Your personal task manager',
    type: 'website',
  },
}

const THEME_SCRIPT = `(function(){
  var T={
    default: {'--bg':'#F7F6F3','--surface':'#EEECEA','--border':'#E0DDD8','--text':'#1A1917','--muted':'#8B8680','--faint':'#C8C4BE'},
    midnight:{'--bg':'#141414','--surface':'#1E1E1E','--border':'#2A2A2A','--text':'#E8E6E3','--muted':'#666360','--faint':'#3A3836'},
    forest:  {'--bg':'#F2F5F2','--surface':'#E8EDE8','--border':'#D4DCD4','--text':'#1A2B1A','--muted':'#5A7A5A','--faint':'#B8CCB8'},
    sand:    {'--bg':'#F5F0E8','--surface':'#EDE6D6','--border':'#D4C8B0','--text':'#2B2416','--muted':'#8B7A5A','--faint':'#C8B898'},
    slate:   {'--bg':'#F0F2F5','--surface':'#E4E8EE','--border':'#CDD3DC','--text':'#1A1F2B','--muted':'#5A6880','--faint':'#A8B4C8'}
  };
  var id=localStorage.getItem('taskflow-theme')||'default';
  var vars=T[id]||T['default'];
  var r=document.documentElement;
  Object.keys(vars).forEach(function(k){r.style.setProperty(k,vars[k]);});
})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script
          id="theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}

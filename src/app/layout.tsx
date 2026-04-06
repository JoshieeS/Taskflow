import type { Metadata, Viewport } from 'next'
import './globals.css'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegistration'
import Script from 'next/script'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#F7F6F3',
}

export const metadata: Metadata = {
  title: 'TaskFlow',
  description: 'Personal task manager',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'TaskFlow',
  },
}

// Inline script — runs synchronously before first paint.
// Reads cookie via document.cookie (no server needed, works offline).
// Falls back to localStorage if cookie absent.
// This is the ONLY way to apply theme before React hydrates without flash.
const THEME_SCRIPT = `(function(){
  var T={
    default :{'--bg':'#F7F6F3','--surface':'#EEECEA','--border':'#E0DDD8','--text':'#1A1917','--muted':'#8B8680','--faint':'#C8C4BE'},
    midnight:{'--bg':'#141414','--surface':'#1E1E1E','--border':'#2A2A2A','--text':'#E8E6E3','--muted':'#666360','--faint':'#3A3836'},
    forest  :{'--bg':'#F2F5F2','--surface':'#E8EDE8','--border':'#D4DCD4','--text':'#1A2B1A','--muted':'#5A7A5A','--faint':'#B8CCB8'},
    sand    :{'--bg':'#F5F0E8','--surface':'#EDE6D6','--border':'#D4C8B0','--text':'#2B2416','--muted':'#8B7A5A','--faint':'#C8B898'},
    slate   :{'--bg':'#F0F2F5','--surface':'#E4E8EE','--border':'#CDD3DC','--text':'#1A1F2B','--muted':'#5A6880','--faint':'#A8B4C8'}
  };
  function getCookie(n){
    var m=document.cookie.match('(^|;)\\s*'+n+'\\s*=\\s*([^;]+)');
    return m?decodeURIComponent(m.pop()):'';
  }
  var id=getCookie('taskflow-theme')||localStorage.getItem('taskflow-theme')||'default';
  var vars=T[id]||T['default'];
  var r=document.documentElement;
  Object.keys(vars).forEach(function(k){r.style.setProperty(k,vars[k]);});
})();`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Runs before paint — applies theme from cookie */}
        <Script
          id="theme-script"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
        />
        <link rel="apple-touch-icon" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192x192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512x512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="TaskFlow" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  )
}

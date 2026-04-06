import { NextRequest, NextResponse } from 'next/server'
 
export function middleware(req: NextRequest) {
  const res      = NextResponse.next()
  const themeId  = req.cookies.get('taskflow-theme')?.value
 
  if (themeId) {
    res.headers.set('x-theme-id', themeId)
  }
 
  return res
}
 
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|sw.js|manifest).*)'],
}
 
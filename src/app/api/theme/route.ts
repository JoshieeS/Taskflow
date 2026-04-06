import { NextRequest, NextResponse } from 'next/server'
 
export async function POST(req: NextRequest) {
  const { themeId } = await req.json()
  const valid = ['default','midnight','forest','sand','slate']
  if (!valid.includes(themeId)) {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set('taskflow-theme', themeId, {
    path    : '/',
    maxAge  : 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
    httpOnly: false, // needs to be readable by inline script
  })
  return res
}
 
export async function GET(req: NextRequest) {
  const themeId = req.cookies.get('taskflow-theme')?.value ?? 'default'
  return NextResponse.json({ themeId })
}
'use client'

import { useState } from "react"
import { createBrowserClient } from "@/lib/supabase-browser"

type AuthView = 'login' | 'signup' | 'otp'

type Hint = {
    msg: string
    action: string
    to: AuthView
}

export default function AuthScreen() {
    const supabase = createBrowserClient()

    const [view, setView] = useState<AuthView>('login')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [otp, setOtp] = useState('')
    const [error, setError] = useState('')
    const [hint, setHint] = useState<Hint | null>(null)
    const [loading, setLoading] = useState(false)

    const clearErrors = () => { setError(''); setHint(null) }

    const switchView = (to: AuthView) => { setView(to); clearErrors() }

    const handleLogin = async () => {
        if (!email || !password) return
        setLoading(true)
        clearErrors()

        const { error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            if (error.message.toLowerCase().includes('invalid login credentials')) {
                setHint({ msg: 'no account found with these details.', action: 'create one →', to: 'signup' })
            } else {
                setError(error.message)
            }
            setLoading(false)
        }
    }

    const handleSignup = async () => {
        if (!name || !email || !password) return
        setLoading(true)
        clearErrors()

        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { name },
            },
        })
        if (error) {
            if (error.message.toLowerCase().includes('user already registered')) {
                setHint({ msg: 'account already exists.', action: 'log in →', to: 'login' })
            } else {
                setError(error.message)
            }
        } else {
            setView('otp')
        }
        setLoading(false)
    }

    const handleOtp = async () => {
        if (otp.length < 6) return
        setLoading(true)
        clearErrors()

        const { error } = await supabase.auth.verifyOtp({
            email,
            token: otp,
            type: 'signup',
        })

        if (error) {
            setError(error.message)
            setOtp('')
        }
        setLoading(false)
    }

    const handleResend = async () => {
        setOtp('')
        clearErrors()
        setView('signup')
    }

    const handleGoogle = async () => {
        await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin,
            },
        })
    }

    const inputStyle: React.CSSProperties = {
        width: '100%',
        fontFamily: 'var(--mono)',
        fontSize: 'max(13px, 16px)',
        color: 'var(--text)',
        background: 'transparent',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        outline: 'none',
        padding: '6px 0 10px',
        marginBottom: 18,
    }

    return (
        <div style={{
            maxWidth: 360,
            margin: '100px auto',
            padding: '0 28px',
            fontFamily: 'var(--mono)',
        }}>
            {/* Wordmark */}
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 40, color: 'var(--text)', letterSpacing: '0.1em' }}>
                task<span style={{ color: 'var(--muted)' }}>flow</span>
            </div>

            {/* ── LOGIN VIEW ── */}
            {view === 'login' && (
                <>
                    <div style={{ fontSize: 10, color: 'var(--faint)', letterSpacing: '0.12em', marginBottom: 24 }}>
            // sign in
                    </div>

                    <input
                        style={inputStyle}
                        placeholder="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); clearErrors() }}
                    />
                    <input
                        style={inputStyle}
                        placeholder="password"
                        type="password"
                        autoComplete="current-password"
                        value={password}
                        onChange={e => { setPassword(e.target.value); clearErrors() }}
                        onKeyDown={e => e.key === 'Enter' && handleLogin()}
                    />

                    {error && <ErrorMsg msg={error} />}
                    {hint && <HintMsg hint={hint} onSwitch={switchView} />}

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 28 }}>
                        <PrimaryBtn label={loading ? '...' : 'login'} onClick={handleLogin} disabled={loading} />
                        <GhostBtn label="create account →" onClick={() => switchView('signup')} />
                    </div>

                    <Divider />
                    <SocialButton icon="G" label="continue with google" onClick={handleGoogle} />
                    {/* Future providers go here — duplicate SocialButton with new provider */}
                </>
            )}

            {/* ── SIGNUP VIEW ── */}
            {view === 'signup' && (
                <>
                    <div style={{ fontSize: 10, color: 'var(--faint)', letterSpacing: '0.12em', marginBottom: 24 }}>
            // create account
                    </div>

                    <input
                        style={inputStyle}
                        placeholder="name"
                        type="text"
                        autoComplete="name"
                        value={name}
                        onChange={e => { setName(e.target.value); clearErrors() }}
                    />
                    <input
                        style={inputStyle}
                        placeholder="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={e => { setEmail(e.target.value); clearErrors() }}
                    />
                    <input
                        style={inputStyle}
                        placeholder="password (min 6 characters)"
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={e => { setPassword(e.target.value); clearErrors() }}
                        onKeyDown={e => e.key === 'Enter' && handleSignup()}
                    />

                    {error && <ErrorMsg msg={error} />}
                    {hint && <HintMsg hint={hint} onSwitch={switchView} />}

                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 28 }}>
                        <PrimaryBtn label={loading ? '...' : 'sign up'} onClick={handleSignup} disabled={loading} />
                        <GhostBtn label="← back to login" onClick={() => switchView('login')} />
                    </div>

                    <Divider />
                    <SocialButton icon="G" label="continue with google" onClick={handleGoogle} />
                </>
            )}

            {view === 'otp' && (
                <>
                    <div style={{ fontSize: 10, color: 'var(--faint)', letterSpacing: '0.12em', marginBottom: 10 }}>
                        // verify email
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 32, lineHeight: 1.7 }}>
                        6-digit code sent to{' '}
                        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{email}</span>
                    </div>

                    <OtpInput value={otp} onChange={setOtp} onComplete={handleOtp} />

                    {error && <ErrorMsg msg={error} />}

                    <div style={{ marginTop: 28, display: 'flex', gap: 12, alignItems: 'center' }}>
                        <PrimaryBtn
                            label={loading ? '...' : 'verify →'}
                            onClick={handleOtp}
                            disabled={loading || otp.length < 6}
                        />
                        <GhostBtn label="resend code" onClick={handleResend} />
                    </div>
                </>
            )}
        </div>
    )
}

function ErrorMsg({ msg }: { msg: string }) {
    return (
        <div style={{ fontSize: 11, color: '#c0392b', marginBottom: 14, fontFamily: 'var(--mono)' }}>
      // {msg}
        </div>
    )
}

function HintMsg({ hint, onSwitch }: { hint: Hint, onSwitch: (to: AuthView) => void }) {
    return (
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14, fontFamily: 'var(--mono)' }}>
      // {hint.msg}{' '}
            <span
                style={{ color: 'var(--text)', cursor: 'pointer', borderBottom: '1px solid var(--border)' }}
                onClick={() => onSwitch(hint.to)}
            >
                {hint.action}
            </span>
        </div>
    )
}

function PrimaryBtn({ label, onClick, disabled }: { label: string, onClick: () => void, disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                background: 'var(--text)',
                color: 'var(--bg)',
                border: 'none',
                borderRadius: 3,
                padding: '10px 20px',
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                minHeight: 44,
            }}
        >
            {label}
        </button>
    )
}

function GhostBtn({ label, onClick }: { label: string, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                fontFamily: 'var(--mono)',
                fontSize: 12,
                background: 'none',
                color: 'var(--muted)',
                border: 'none',
                cursor: 'pointer',
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
            }}
        >
            {label}
        </button>
    )
}

function Divider() {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            <span style={{ fontSize: 10, color: 'var(--faint)', letterSpacing: '0.1em' }}>or</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>
    )
}

function SocialButton({ icon, label, onClick }: { icon: string, label: string, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            style={{
                width: '100%',
                fontFamily: 'var(--mono)',
                fontSize: 12,
                color: 'var(--text)',
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 3,
                padding: '10px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginBottom: 10,
                letterSpacing: '0.04em',
                minHeight: 44,
            }}
        >
            <span style={{ fontWeight: 700, fontSize: 14, width: 16, textAlign: 'center' }}>{icon}</span>
            <span>{label}</span>
        </button>
    )
}

// ── 6-box OTP input ────────────────────────────────────────────────────────────

function OtpInput({
    value,
    onChange,
    onComplete,
}: {
    value: string
    onChange: (v: string) => void
    onComplete: () => void
}) {
    return (
        <div style={{ display: 'flex', gap: 8 }}>
            {Array.from({ length: 6 }).map((_, i) => (
                <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={value[i] || ''}
                    autoFocus={i === 0}
                    onChange={e => {
                        const digit = e.target.value.replace(/\D/g, '')
                        const chars = value.split('')
                        chars[i] = digit
                        const next = chars.join('').slice(0, 6)
                        onChange(next)
                        // Auto-advance to next box
                        if (digit && i < 5) {
                            document.getElementById(`otp-${i + 1}`)?.focus()
                        }
                        // Auto-submit when complete
                        if (next.length === 6) onComplete()
                    }}
                    onKeyDown={e => {
                        // Backspace on empty box → focus previous
                        if (e.key === 'Backspace' && !value[i] && i > 0) {
                            document.getElementById(`otp-${i - 1}`)?.focus()
                        }
                    }}
                    style={{
                        width: 42,
                        height: 52,
                        textAlign: 'center',
                        fontFamily: 'var(--mono)',
                        fontSize: 20,
                        fontWeight: 600,
                        color: 'var(--text)',
                        background: 'var(--surface)',
                        border: `1px solid ${value[i] ? 'var(--text)' : 'var(--border)'}`,
                        borderRadius: 4,
                        outline: 'none',
                        caretColor: 'transparent',
                    }}
                />
            ))}
        </div>
    )
}


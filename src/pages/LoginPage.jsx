import { useState } from 'react'
import './LoginPage.css'

const DEMO_ID = 'demo'
const DEMO_PASSWORD = 'solargrid'

function LoginPage({ onLoginSuccess }) {
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (event) => {
    event.preventDefault()

    if (userId.trim() === DEMO_ID && password === DEMO_PASSWORD) {
      setError('')
      onLoginSuccess()
      return
    }

    setError('ID 또는 Password를 다시 확인해 주세요.')
  }

  return (
    <main className="login-page">
      <video
        aria-hidden="true"
        autoPlay
        className="login-video-bg"
        loop
        muted
        playsInline
        preload="auto"
      >
        <source src="/videos/Solar%20Panels.mp4" type="video/mp4" />
      </video>

      <div className="login-backdrop" />

      <section className="login-card" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="login-brand-mark" aria-hidden="true">
            <svg fill="none" height="30" viewBox="0 0 30 30" width="30">
              <circle cx="15" cy="15" fill="#fbbf24" opacity="0.18" r="14" />
              <circle cx="15" cy="15" fill="#fbbf24" r="5.5" />
              {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                <line
                  key={deg}
                  stroke="#fbbf24"
                  strokeLinecap="round"
                  strokeWidth="2"
                  transform={`rotate(${deg}, 15, 15)`}
                  x1="15"
                  x2="15"
                  y1="2"
                  y2="6"
                />
              ))}
            </svg>
          </span>
          <div className="login-brand-text">
            <h1 id="login-title">SolarGrid</h1>
            <p>AI 기반 태양광 전력 분배 시뮬레이션 플랫폼</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="login-field">
            <span>ID</span>
            <input
              autoComplete="username"
              onChange={(event) => setUserId(event.target.value)}
              placeholder="Enter your ID"
              type="text"
              value={userId}
            />
          </label>

          <label className="login-field">
            <span>Password</span>
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              type="password"
              value={password}
            />
          </label>

          {error && (
            <p className="login-error" role="alert">
              {error}
            </p>
          )}

          <button className="login-submit" type="submit">
            로그인
          </button>
        </form>

        <div className="login-signup">
          <span>계정이 없으신가요?</span>
          <button type="button">회원가입</button>
        </div>
      </section>
    </main>
  )
}

export default LoginPage

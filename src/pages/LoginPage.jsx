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
          <span className="login-brand-mark" aria-hidden="true" />
          <div>
            <h1 id="login-title">SolarGrid</h1>
            <p>AI 기반 태양광 발전 예측 플랫폼</p>
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

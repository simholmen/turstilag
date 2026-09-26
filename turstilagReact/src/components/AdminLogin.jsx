import { useState } from 'react'

export default function AdminLogin({ onSignIn }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setIsSubmitting(true)
    try {
      await onSignIn(email.trim(), password)
    } catch (err) {
      console.error('Sign in failed:', err)
      setError('Feil e-post eller passord')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="admin-login">
      <form className="admin-login-card admin-form" onSubmit={handleSubmit}>
        <h1>Logg inn</h1>
        <label className="admin-field">
          E-post
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="admin-field">
          Passord
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="admin-login-error">{error}</p>}
        <button type="submit" className="admin-save-btn" disabled={isSubmitting}>
          {isSubmitting ? 'Logger inn…' : 'Logg inn'}
        </button>
        <a href="/">Tilbake til kart</a>
      </form>
    </div>
  )
}

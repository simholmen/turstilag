import './App.css'
import AdminApp from './AdminApp'
import AdminLogin from './components/AdminLogin'
import { useAuth } from './hooks/useAuth'

// Only hides the admin UI. The actual protection is RLS in the database.
export default function AdminGate() {
  const { session, isLoading, signIn, signOut } = useAuth()

  if (isLoading) return null
  if (!session) return <AdminLogin onSignIn={signIn} />

  return <AdminApp userEmail={session.user.email} onSignOut={signOut} />
}

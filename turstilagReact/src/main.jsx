import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminApp from './AdminApp.jsx'

const pathname = window.location.pathname
const isAdminRoute = pathname === '/admin' || pathname === '/admin/'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isAdminRoute ? <AdminApp /> : <App />}
  </StrictMode>,
)

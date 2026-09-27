import { Link, Navigate, Route, Routes } from 'react-router'
import { Layout } from './components/Layout.tsx'
import { AdminDashboard } from './pages/AdminDashboard.tsx'
import { ChatPage } from './pages/ChatPage.tsx'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  )
}

function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">Page not found</h1>
      <Link to="/chat" className="mt-3 inline-block text-slate-600 underline">
        Go to the customer chat
      </Link>
    </div>
  )
}

export default App

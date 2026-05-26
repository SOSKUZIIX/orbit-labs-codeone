import App from './App'
import { Auth } from './components/Auth'
import { useAuth } from './hooks/useAuth'

export default function Root(): JSX.Element {
  const auth = useAuth()

  if (auth.status === 'loading') {
    return <div className="welcome" />
  }
  if (auth.status === 'signed-out') {
    return <Auth />
  }
  return <App />
}

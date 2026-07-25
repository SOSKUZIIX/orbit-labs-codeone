import React from 'react'
import ReactDOM from 'react-dom/client'
import Root from './Root'
import './styles.css'
import './theme-fluid.css'

// Default skin before settings load (App corrects it if the user chose
// Classic) — avoids a flash of the old UI on launch.
document.documentElement.dataset.ui = 'fluid'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)

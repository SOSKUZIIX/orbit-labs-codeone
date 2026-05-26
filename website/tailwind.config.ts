import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08090d',
          900: '#0e0f13',
          800: '#14161c',
          700: '#1c1f27'
        }
      },
      fontFamily: {
        sans: [
          'var(--font-inter, Inter)',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Helvetica',
          'Arial',
          'sans-serif'
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace'
        ]
      },
      boxShadow: {
        glow: '0 0 80px rgba(255,255,255,0.06)'
      }
    }
  },
  plugins: []
}

export default config

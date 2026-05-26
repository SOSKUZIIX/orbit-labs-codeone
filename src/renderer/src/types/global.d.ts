import type { OrbitApi } from '../../../preload'

declare global {
  interface Window {
    orbit: OrbitApi
  }
}

export {}

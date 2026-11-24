import studio from '@theatre/studio'
export { studio }

// Importado dinamicamente somente com Vite DEV e ?theatre=1.
export function initializeTheatreStudio() {
  studio.initialize({ usePersistentStorage: false })
}

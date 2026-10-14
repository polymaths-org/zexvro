import { Component, type ReactNode } from 'react'
import { RotateCcw } from 'lucide-react'

/** If anything in the UI crashes, show a calm way back instead of a blank window. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('Morph UI crashed', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="relative z-10 grid h-screen place-items-center px-6">
        <div className="glass flex max-w-[30rem] flex-col items-start gap-4 p-8">
          <h1 className="text-[1.8rem] font-semibold">Something went wrong.</h1>
          <p className="text-[1.1rem] text-fg-muted">
            Morph hit a problem and needs to restart this screen. Your conversations are saved.
          </p>
          <button type="button" className="btn btn-primary" onClick={() => location.reload()}>
            <RotateCcw aria-hidden="true" />
            Restart Morph
          </button>
        </div>
      </main>
    )
  }
}

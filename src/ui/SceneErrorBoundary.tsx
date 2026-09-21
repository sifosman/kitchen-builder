import { Component, type ReactNode } from 'react'

interface State {
  crashed: boolean
}

/** Keeps a 3D-scene failure from taking down the rest of the planner. */
export default class SceneErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { crashed: false }

  static getDerivedStateFromError(): State {
    return { crashed: true }
  }

  componentDidCatch(err: unknown) {
    console.error('[scene]', err)
  }

  render() {
    if (!this.state.crashed) return this.props.children
    return (
      <div className="flex h-full w-full items-center justify-center bg-hds-sand">
        <div className="rounded-2xl border border-hds-border bg-white p-6 text-center shadow-card">
          <p className="text-sm font-semibold text-hds-black">We couldn't draw your kitchen in 3D</p>
          <p className="mt-1 text-xs text-hds-muted">Your design and prices are safe — the preview just hit a snag.</p>
          <button
            onClick={() => this.setState({ crashed: false })}
            className="mt-4 rounded-xl bg-hds-gold px-5 py-2 text-sm font-semibold text-hds-black transition-colors hover:bg-hds-goldHover"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }
}

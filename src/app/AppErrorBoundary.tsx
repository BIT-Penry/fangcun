import { Component, type ErrorInfo, type ReactNode } from "react";

interface State { failed: boolean }

export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Content is intentionally omitted: prompts and journal text must not enter logs.
    console.error("Fangcun page rendering failed");
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="fatal-error" role="alert">
          <div className="app-monogram">方</div>
          <h1>这个页面暂时没有打开</h1>
          <p>本地数据没有被删除。重新载入应用通常可以恢复。</p>
          <button type="button" className="button-primary" onClick={() => window.location.reload()}>重新载入方寸</button>
        </main>
      );
    }
    return this.props.children;
  }
}

import { BrowserRouter } from "react-router-dom";
import { AppBootstrap } from "./AppBootstrap";
import { AppErrorBoundary } from "./AppErrorBoundary";

export function App() {
  return (
    <AppErrorBoundary>
      <BrowserRouter>
        <AppBootstrap />
      </BrowserRouter>
    </AppErrorBoundary>
  );
}

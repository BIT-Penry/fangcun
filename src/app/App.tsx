import { BrowserRouter } from "react-router-dom";
import { AppBootstrap } from "./AppBootstrap";

export function App() {
  return (
    <BrowserRouter>
      <AppBootstrap />
    </BrowserRouter>
  );
}

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { APIProvider } from "@vis.gl/react-google-maps";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <APIProvider apiKey={import.meta.env.VITE_GOOGLE_MAPS_KEY}>
      <App />
    </APIProvider>
  </StrictMode>,
);

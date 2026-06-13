import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";
import { setApiBaseUrl } from "@/lib/auth-context";

// In production (Vercel), VITE_API_URL points to the Render backend.
// In development (Replit), API calls are relative (same-origin proxy).
const apiUrl = import.meta.env.VITE_API_URL as string | undefined;
if (apiUrl) {
  // Used by generated API client hooks (useListEmployees, etc.)
  setBaseUrl(apiUrl);
  // Used by authFetch (direct fetch calls like /api/users, /api/auth/*)
  setApiBaseUrl(apiUrl);
}

createRoot(document.getElementById("root")!).render(<App />);

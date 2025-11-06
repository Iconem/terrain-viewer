import React from "react"
import ReactDOM from "react-dom/client"
import { NuqsAdapter } from "nuqs/adapters/react"
import App from "./App"
import "./index.css"
import { TooltipProvider } from "@/components/ui/tooltip"

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <React.Suspense>
      <NuqsAdapter>
        {/* <TooltipProvider> */}
        <App />
        {/* </TooltipProvider> */}
      </NuqsAdapter>
    </React.Suspense>
  </React.StrictMode>,
)

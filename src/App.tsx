import { ThemeProvider } from "@/components/theme-provider"
import ChatPage from "@/app/page"

function App() {
  return (
    <ThemeProvider defaultTheme="system" storageKey="ui-theme">
      <ChatPage />
    </ThemeProvider>
  )
}

export default App

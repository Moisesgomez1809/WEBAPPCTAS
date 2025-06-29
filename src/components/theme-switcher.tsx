"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Switch } from "@/components/ui/switch"

export function ThemeSwitcher() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    // To prevent layout shift, we can render a placeholder
    return <div className="absolute top-4 right-4 z-50 h-6 w-24" />;
  }
  
  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark")
  }
  
  return (
    <div className="absolute top-4 right-4 z-50 flex items-center space-x-2">
      <Sun className="h-5 w-5 text-primary" />
      <Switch
        id="theme-switch"
        checked={resolvedTheme === "dark"}
        onCheckedChange={toggleTheme}
        aria-label="Toggle theme"
      />
      <Moon className="h-5 w-5 text-primary" />
    </div>
  )
}

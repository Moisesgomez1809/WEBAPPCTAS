"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"

import { Switch } from "@/components/ui/switch"

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  // useEffect only runs on the client, so we can safely set the mounted state
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }
  
  return (
    <div className="absolute top-4 right-4 z-50 flex items-center space-x-2">
      <Sun className="h-5 w-5 text-primary" />
      <Switch
        id="theme-switch"
        checked={theme === "dark"}
        onCheckedChange={toggleTheme}
        aria-label="Toggle theme"
      />
      <Moon className="h-5 w-5 text-primary" />
    </div>
  )
}

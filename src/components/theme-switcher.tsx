"use client"

import * as React from "react"
import { Moon, Sun, LogOut } from "lucide-react"
import { useTheme } from "next-themes"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

export function ThemeSwitcher() {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()
  const { isAuthenticated, logout } = useAuth()
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }
  
  const handleLogout = () => {
    logout();
    router.replace('/');
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
      
      {isAuthenticated && (
        <>
          <Separator orientation="vertical" className="h-6 mx-2" />
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            aria-label="Cerrar sesión"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </>
      )}
    </div>
  )
}

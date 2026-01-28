"use client"

import React, { useEffect, useState } from "react"
import { motion } from "framer-motion"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface NavItem {
  name: string
  url: string
  icon: LucideIcon
}

interface NavBarProps {
  items: NavItem[]
  className?: string
}

export function NavBar({ items, className }: NavBarProps) {
  const [activeTab, setActiveTab] = useState(items[0].name)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    handleResize()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div
      className={cn(
        // Position at top for all screen sizes
        "fixed left-1/2 -translate-x-1/2 z-50",
        "top-3 md:top-4",
        "pt-0 md:pt-2",
        className,
      )}
    >
      <div className="flex items-center gap-1 md:gap-3 bg-neutral-900/80 border border-neutral-800/50 backdrop-blur-lg py-1 px-1 rounded-full shadow-glow-soft">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.name

          return (
            <a
              key={item.name}
              href={item.url}
              onClick={() => setActiveTab(item.name)}
              className={cn(
                "relative cursor-pointer text-sm font-semibold px-3 md:px-6 py-2 rounded-full transition-all duration-300",
                "text-neutral-400 hover:text-neon-blue",
                isActive && "bg-gradient-to-r from-neon-blue/20 to-neon-purple/20 text-neon-blue",
              )}
            >
              <span className="hidden md:inline">{item.name}</span>
              <span className="md:hidden">
                <Icon size={18} strokeWidth={2.5} />
              </span>
              {isActive && (
                <motion.div
                  layoutId="lamp"
                  className="absolute inset-0 w-full bg-gradient-to-r from-neon-blue/10 to-neon-purple/10 rounded-full -z-10"
                  initial={false}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                  }}
                >
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-gradient-to-r from-neon-blue to-neon-purple rounded-t-full shadow-glow-blue">
                    <div className="absolute w-12 h-6 bg-neon-blue/30 rounded-full blur-md -top-2 -left-2" />
                    <div className="absolute w-8 h-6 bg-neon-purple/30 rounded-full blur-md -top-1" />
                    <div className="absolute w-4 h-4 bg-neon-blue/40 rounded-full blur-sm top-0 left-2" />
                  </div>
                </motion.div>
              )}
            </a>
          )
        })}
      </div>
    </div>
  )
}

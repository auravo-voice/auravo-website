import {
  Activity,
  CalendarDays,
  ClipboardCheck,
  Home,
  Keyboard,
  LineChart,
  MessageCircle,
  Mic2,
  Settings2,
  Sparkles,
} from "lucide-react";

export const APP_NAV = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/assessment", label: "Initial assessment", icon: ClipboardCheck },
  { href: "/learning-path", label: "Learning path", icon: Sparkles },
  { href: "/wordle", label: "Wordle", icon: Keyboard },
  { href: "/simulations", label: "Simulations", icon: MessageCircle },
  { href: "/observability", label: "Observability", icon: Activity },
  { href: "/progress", label: "Progress journal", icon: LineChart },
  { href: "/meeting-prep", label: "Meeting prep", icon: CalendarDays },
  { href: "/settings", label: "Settings", icon: Settings2 },
] as const;

export const VOICE_QUICK_ACTION = { href: "/dashboard", label: "Push to talk", icon: Mic2 } as const;

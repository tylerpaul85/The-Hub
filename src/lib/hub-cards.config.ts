import {
  DoorOpen,
  Store,
  CalendarDays,
  Send,
  Images,
  Gift,
  Calculator,
  Signpost,
  ShoppingBag,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export interface HubCardDefinition {
  id: string;
  title: string;
  subtitle: string;
  category: "listings" | "clients" | "requests";
  defaultBadge: string;
  actionLabel: string;
  icon: LucideIcon;
  to?: string;
  href?: string;
}

export const DEFAULT_HUB_CARDS: HubCardDefinition[] = [
  {
    id: "market-stats",
    title: "Market Stats",
    subtitle: "Monthly MLS stats, infographic reports & ready-to-post graphics",
    category: "listings",
    defaultBadge: "Monthly MLS",
    actionLabel: "View Market Stats",
    icon: BarChart3,
    to: "/market-stats",
  },
  {
    id: "open-houses",
    title: "Open House Management",
    subtitle: "Kiosk sign-ins, printable placards & FUB sync",
    category: "listings",
    defaultBadge: "Check-in Kiosk",
    actionLabel: "Launch Kiosk",
    icon: DoorOpen,
    to: "/open-house-management",
  },
  {
    id: "vendor-guide",
    title: "Trusted Vendor Guide",
    subtitle: "Local home contractors directory & printable PDFs",
    category: "clients",
    defaultBadge: "Directory",
    actionLabel: "View Directory",
    icon: Store,
    to: "/vendor-guide",
  },
  {
    id: "special-events",
    title: "Special Events",
    subtitle: "RSVP for team events & community volunteering",
    category: "requests",
    defaultBadge: "RSVP Calendar",
    actionLabel: "View Events",
    icon: CalendarDays,
    to: "/agent-toolbox?tab=events",
  },
  {
    id: "marketing-request",
    title: "Marketing Request",
    subtitle: "Submit graphics, video edits & flyer jobs",
    category: "requests",
    defaultBadge: "Production Desk",
    actionLabel: "Submit Request",
    icon: Send,
    to: "/request",
  },
  {
    id: "marketing-materials",
    title: "Marketing Materials",
    subtitle: "Ready-to-post listing flyers & social kits",
    category: "listings",
    defaultBadge: "Download Hub",
    actionLabel: "Browse Assets",
    icon: Images,
    to: "/agent-toolbox",
  },
  {
    id: "closing-gift",
    title: "Closing Gift Package",
    subtitle: "Order client shirts & welcome delivery packages",
    category: "clients",
    defaultBadge: "Client Care",
    actionLabel: "Order Package",
    icon: Gift,
    to: "/closing-gift",
  },
  {
    id: "net-proceeds",
    title: "Net Proceeds Calculator",
    subtitle: "Generate instant 3-scenario seller net sheets",
    category: "clients",
    defaultBadge: "Financial Tool",
    actionLabel: "Calculate Net",
    icon: Calculator,
    to: "/seller-net-proceeds",
  },
  {
    id: "listing-signs",
    title: "Listing Signs",
    subtitle: "Check in or check out yard signs & riders",
    category: "listings",
    defaultBadge: "Inventory Portal",
    actionLabel: "Sign Inventory",
    icon: Signpost,
    href: "https://listings.msreginternal.com/",
  },
  {
    id: "order-swag",
    title: "Team Swag Store",
    subtitle: "Shop official MSREG apparel, hats & merchandise",
    category: "requests",
    defaultBadge: "Shopify Store",
    actionLabel: "Shop Apparel",
    icon: ShoppingBag,
    href: "https://msregswag.com/",
  },
];

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sprout, Map, Bug, History } from "lucide-react";
import { cn } from "@/lib/utils";

const GROUPS: { title: string; items: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[] }[] = [
  { title: "Général", items: [
    { href: "/", label: "Tableau de bord", icon: LayoutDashboard },
  ] },
  { title: "Base de connaissances", items: [
    { href: "/crops", label: "Cultures", icon: Sprout },
    { href: "/zones", label: "Zones", icon: Map },
    { href: "/pests", label: "Ravageurs", icon: Bug },
  ] },
  { title: "Suivi", items: [
    { href: "/history", label: "Historique", icon: History },
  ] },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-4 px-2 text-lg font-extrabold text-primary">🌱 Okko</div>
      {GROUPS.map((g) => (
        <div key={g.title} className="mb-2">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{g.title}</p>
          {g.items.map((it) => {
            const active = pathname === it.href || pathname.startsWith(it.href + "/");
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  active && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                )}
              >
                <Icon className="h-4 w-4" />
                {it.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

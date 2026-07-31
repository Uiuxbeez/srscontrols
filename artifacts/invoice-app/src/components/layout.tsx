import * as React from "react"
import { Link, useLocation } from "wouter"
import {
  LayoutDashboard,
  FileText,
  Users,
  ClipboardList,
  Box,
  ListChecks,
  Layers,
  ChevronDown,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Invoices", href: "/invoices", icon: FileText },
    { label: "Quotations", href: "/quotations", icon: ClipboardList },
    { label: "Clients", href: "/clients", icon: Users },
  ];

  const quotationMasterItems = [
    { label: "Tech Spec", href: "/tech-spec-items", icon: ListChecks },
    { label: "Panel Master", href: "/panels", icon: Box },
  ];

  const isQuotationMasterActive = quotationMasterItems.some((item) => location.startsWith(item.href));
  const [quotationMasterOpen, setQuotationMasterOpen] = React.useState(isQuotationMasterActive);

  React.useEffect(() => {
    if (isQuotationMasterActive) setQuotationMasterOpen(true);
  }, [isQuotationMasterActive]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row print:bg-white print:text-black">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r bg-card flex-shrink-0 flex flex-col print:hidden">
        <div className="h-16 flex items-center px-6 border-b">
          <div className="font-bold text-lg tracking-tight text-primary flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <div className="w-3 h-3 bg-white rounded-sm" />
            </div>
            SRS Controls
          </div>
        </div>
        <nav className="p-4 space-y-1 flex-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}

          <Collapsible open={quotationMasterOpen} onOpenChange={setQuotationMasterOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors",
                  isQuotationMasterActive
                    ? "text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Layers className="w-4 h-4" />
                <span className="flex-1 text-left">Quotation Master</span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", quotationMasterOpen && "rotate-180")} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pl-6 space-y-1 mt-1">
              {quotationMasterItems.map((item) => {
                const isActive = location.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                )
              })}
            </CollapsibleContent>
          </Collapsible>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 print:m-0 print:p-0">
        <div className="flex-1 p-6 lg:p-8 overflow-auto print:p-0 print:overflow-visible">
          <div className="max-w-7xl mx-auto space-y-6 print:max-w-none print:space-y-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}

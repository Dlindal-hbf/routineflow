import React from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: () => void;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, back, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex items-center justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          {back && (
            <Button variant="ghost" size="icon" onClick={back}>
              <ArrowLeft size={16} />
            </Button>
          )}
          <h1 className="text-2xl font-heading font-semibold">{title}</h1>
        </div>
        {subtitle && <p className="text-sm text-foreground/70">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

import React from "react";
import PageHeader from "@/components/ui/PageHeader";
import { getBgClass } from "@/lib/colors";

interface BrandedHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  back?: () => void;
  actions?: React.ReactNode;
  /** semantic color key or raw class for header background (defaults to "primary") */
  color?: string | null;
}

export default function BrandedHeader({
  title,
  subtitle,
  back,
  actions,
  color,
}: BrandedHeaderProps) {
  const bg = getBgClass(color || "primary");

  return (
    <header className={`${bg} text-white`}>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <PageHeader title={title} subtitle={subtitle} back={back} actions={actions} />
      </div>
    </header>
  );
}

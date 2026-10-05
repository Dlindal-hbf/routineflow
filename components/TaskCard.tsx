"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, PenLine, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TaskCardProps {
  title: string;
  description?: string;
  completed: boolean;
  frequency?: string;
  onToggle?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function TaskCard({
  title,
  description,
  completed,
  frequency,
  onToggle,
  onEdit,
  onDelete,
}: TaskCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="cursor-pointer"
      onClick={onToggle}
    >
      <Card
        className={cn(
          "rounded-3xl border border-border bg-background shadow-sm transition-shadow",
          completed ? "opacity-70" : "hover:shadow-lg"
        )}
      >
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3
                className={cn(
                  "text-2xl font-semibold",
                  completed ? "text-foreground/40 line-through" : "text-foreground"
                )}
              >
                {title}
              </h3>
              {frequency && (
                <span className="mt-2 inline-block rounded-full border border-accent/30 bg-accent/20 px-4 py-1 text-base text-accent-foreground">
                  {frequency}
                </span>
              )}
              {description && (
                <p className="mt-2 text-lg text-foreground/70">{description}</p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {onToggle && (
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant={completed ? "default" : "outline"}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle();
                    }}
                    className={cn(
                      "h-12 w-12 rounded-2xl",
                      completed ? "bg-primary hover:bg-primary/90" : ""
                    )}
                  >
                    <CheckCircle2 className="h-6 w-6" />
                  </Button>
                </motion.div>
              )}
              {onEdit && (
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    className="h-12 w-12 rounded-2xl"
                  >
                    <PenLine className="h-6 w-6" />
                  </Button>
                </motion.div>
              )}
              {onDelete && (
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="h-12 w-12 rounded-2xl text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-6 w-6" />
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

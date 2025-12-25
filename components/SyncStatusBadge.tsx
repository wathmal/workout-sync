import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Circle } from "lucide-react";
import { SyncStatus } from "@/lib/types";

interface SyncStatusBadgeProps {
  status: SyncStatus;
}

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  if (status === "synced") {
    return (
      <div className="flex items-center gap-1 text-primary text-sm">
        <CheckCircle2 className="w-4 h-4" />
        <span>Synced</span>
      </div>
    );
  }

  if (status === "syncing") {
    return (
      <div className="flex items-center gap-1 text-muted-foreground text-sm">
        <Clock className="w-4 h-4 animate-spin" />
        <span>Syncing</span>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <div className="flex items-center gap-1 text-muted-foreground text-sm">
        <Circle className="w-4 h-4" />
        <span>Pending</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-destructive text-sm">
      <Circle className="w-4 h-4" />
      <span>Error</span>
    </div>
  );
}


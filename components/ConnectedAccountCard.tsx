import React from "react";
import { Card } from "@/components/ui/card";
import { ConnectedAccount } from "@/lib/types";

interface ConnectedAccountCardProps {
  account: ConnectedAccount;
  onConnect?: () => void;
}

export function ConnectedAccountCard({ account, onConnect }: ConnectedAccountCardProps) {
  const isActive = account.status === "active";

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold"
          style={{ backgroundColor: account.icon_color }}
        >
          {account.name.charAt(0)}
        </div>
        <span className="font-medium text-foreground">{account.name}</span>
      </div>
      {isActive ? (
        <div className="flex items-center gap-2 text-primary text-sm">
          <span>Active</span>
          <div className="w-2 h-2 rounded-full bg-primary"></div>
        </div>
      ) : (
        <button
          onClick={onConnect}
          className="text-foreground text-sm font-medium hover:underline"
        >
          Connect
        </button>
      )}
    </div>
  );
}


"use client";

import { LogOut } from "lucide-react";
import { signOut, type Account } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The signed-in end of the top bar: an avatar that opens the account menu on
 * the shadcn/ui DropdownMenu.
 *
 * Nothing here is a page of its own — the session lives in Supabase, so showing
 * who is signed in and offering the way out is all this needs to do.
 */
export default function AccountMenu({
  account,
  onSignedOut,
}: {
  account: Account;
  onSignedOut: () => void;
}) {
  const label = account.email.slice(0, 1).toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="avatar" title={`Menu for ${account.email}`}>
            {label}
          </button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="account-label">
          <span className="account-email">{account.email}</span>
          <span className="account-kind">
            {account.cloud ? "Signed in with Supabase" : "Signed in on this browser only"}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void signOut().then(onSignedOut)}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
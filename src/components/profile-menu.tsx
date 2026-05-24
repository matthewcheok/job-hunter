"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { signOut } from "@/app/actions";

export function ProfileMenu({
  avatarUrl,
  displayName,
  email,
}: {
  avatarUrl?: string;
  displayName: string;
  email?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = getInitials(displayName || email || "User");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  return (
    <div className="profile-menu" ref={menuRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Open profile menu"
        className="profile-menu-trigger"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        {avatarUrl ? (
          <span
            aria-hidden="true"
            className="profile-avatar"
            style={{ backgroundImage: `url(${avatarUrl})` }}
          />
        ) : (
          <span className="profile-avatar-fallback">{initials}</span>
        )}
      </button>

      {isOpen ? (
        <div className="profile-menu-popover" role="menu">
          <div className="profile-menu-identity">
            <strong>{displayName}</strong>
            {email ? <span>{email}</span> : null}
          </div>
          <form action={signOut}>
            <button className="profile-menu-item" role="menuitem" type="submit">
              <LogOut aria-hidden="true" size={16} />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function getInitials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

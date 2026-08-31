"use client";

import Image from "next/image";
import {
  ArrowLeft,
  Bell,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Clock,
  FileText,
  GraduationCap,
  LayoutGrid,
  Menu,
  PanelLeftClose,
  Sparkles,
} from "lucide-react";
import { Brand } from "./Brand";

const navItems = [
  { label: "Home", icon: LayoutGrid },
  { label: "My Classroom", icon: GraduationCap },
  { label: "Assignments", icon: FileText },
  { label: "Exams", icon: FileText, active: true },
  { label: "My Library", icon: Clock },
];

export function AppChrome({
  children,
  compact = false,
}: {
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`app-shell ${compact ? "app-shell--compact" : ""}`}>
      <aside className="sidebar" aria-label="Primary navigation">
        <div>
          <div className="sidebar-brand-row">
            <Brand compact={compact} />
            {!compact && (
              <button type="button" className="sidebar-toggle-btn" aria-label="Toggle sidebar">
                <PanelLeftClose size={18} />
              </button>
            )}
          </div>
          <button className="toolkit-button" type="button">
            <Sparkles size={16} />
            {!compact && <span>AI Teacher&apos;s Toolkit</span>}
          </button>
          <nav className="sidebar-nav">
            {navItems.map(({ label, icon: Icon, active }) => (
              <button
                type="button"
                key={label}
                className={`nav-item ${active ? "nav-item--active" : ""}`}
                aria-current={active ? "page" : undefined}
                title={compact ? label : undefined}
              >
                <Icon size={18} />
                {!compact && <span>{label}</span>}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="school-card" title="Delhi Public School, Bokaro Steel City">
            <Image
              className="school-crest"
              src="/dps-crest.png"
              alt="Delhi Public School crest"
              width={42}
              height={46}
            />
            {!compact && (
              <span>
                <strong>Delhi Public School</strong>
                <small>Bokaro Steel City</small>
              </span>
            )}
          </div>
        </div>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button" type="button" aria-label="Go back">
              <ArrowLeft size={18} />
            </button>
            <ClipboardList size={15} className="muted-icon" />
            <span className="topbar-label desktop-only">Exams</span>
            <div className="topbar-mobile-brand mobile-only">
              <Brand />
            </div>
          </div>
          <div className="topbar-actions">
            <button className="icon-button desktop-only" type="button" aria-label="Help">
              <CircleHelp size={18} />
            </button>
            <button className="icon-button notification-button" type="button" aria-label="Notifications">
              <Bell size={18} />
              <span className="notification-dot" />
            </button>
            <Sparkles className="desktop-only" size={17} />
            <span className="user-avatar" aria-label="Madhur Rastogi">
              <Image
                src="/user-avatar.png"
                alt=""
                width={25}
                height={25}
              />
            </span>
            <span className="user-name desktop-only">Madhur Rastogi</span>
            <ChevronDown className="desktop-only" size={15} />
            <button className="icon-button mobile-only" type="button" aria-label="Open menu">
              <Menu size={20} />
            </button>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

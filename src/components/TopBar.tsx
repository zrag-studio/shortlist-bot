import { FileText, ListChecks, Sparkles } from 'lucide-react';
import { WorkspaceTab } from '../types/resume';

interface TopBarProps {
  appName: string;
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
}

const NAV_TABS: Array<{ id: WorkspaceTab; label: string; icon: typeof ListChecks }> = [
  { id: 'build', label: 'Build', icon: ListChecks },
  { id: 'ai-chat', label: 'AI Chat', icon: Sparkles },
  { id: 'preview', label: 'Preview', icon: FileText },
];

export function TopBar({ appName, activeTab, onSelectTab }: TopBarProps) {
  return (
    <>
      {/* Clean Distraction-Free Header (Zero Download Button, Zero Admin Link) */}
      <header className="sticky top-0 z-30 h-13 md:h-14 bg-[#0A0D12]/95 backdrop-blur-md border-b border-[#232C3B]">
        <div className="h-full max-w-[1520px] mx-auto px-4 md:px-6 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => onSelectTab('build')}
            className="text-base md:text-lg font-bold tracking-tight text-[#F1F5F9] whitespace-nowrap shrink-0 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] rounded"
          >
            {appName || 'Shortlist Studio'}
          </button>

          <nav
            aria-label="Primary Navigation"
            className="hidden md:flex items-center gap-8 text-sm font-medium"
          >
            {NAV_TABS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`relative py-1 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#38BDF8] rounded ${
                    isActive ? 'text-[#F1F5F9]' : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                  }`}
                >
                  {item.id === 'ai-chat' && (
                    <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" aria-hidden="true" />
                  )}
                  <span>{item.label}</span>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-0 right-0 -bottom-[15px] h-[2px] bg-[#38BDF8]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right spacer keeps desktop brand/nav balanced cleanly */}
          <div className="hidden md:block w-16 shrink-0" aria-hidden="true" />
        </div>
      </header>

      {/* Fixed 3-Tab Mobile / Telegram Mini App Bottom Navigation */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-15 bg-[#0A0D12]/95 backdrop-blur-md border-t border-[#232C3B]"
      >
        <div className="grid grid-cols-3 h-full">
          {NAV_TABS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
                  isActive ? 'text-[#38BDF8]' : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                }`}
              >
                <Icon className="w-5 h-5" aria-hidden="true" />
                <span className="text-[11px] font-medium tracking-tight whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

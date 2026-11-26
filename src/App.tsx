import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminPanel } from './components/AdminPanel';
import { AiChatBuilder } from './components/AiChatBuilder';
import { BuildWizard } from './components/BuildWizard';
import { PaperPreview } from './components/PaperPreview';
import { TopBar } from './components/TopBar';
import { EMPTY_RESUME_CONTENT, getPresetById, getStarterKeywords } from './data/presets';
import { hasActivePdfAd, maybeShowAd } from './lib/ads';
import {
  fetchPublicConfig,
  fetchResumes,
  recordAndArchivePdfExport,
  saveResumeApi,
} from './lib/api';
import { calculateAtsCoverage } from './lib/atsMatcher';
import { downloadPdfBytes, generateAtsPdfBytes } from './lib/pdfGenerator';
import { initTelegramWebApp, triggerHaptic } from './lib/telegram';
import {
  LayoutMode,
  PublicAppConfig,
  ResumeContent,
  ResumeRecord,
  TrackPresetId,
  WorkspaceTab,
} from './types/resume';

function isAdminLocation(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.location.pathname === '/admin' ||
    window.location.pathname.startsWith('/admin/') ||
    window.location.hash === '#/admin'
  );
}

function createInitialResume(userId: string): ResumeRecord {
  return {
    id: `res_${crypto.randomUUID().slice(0, 12)}`,
    userId,
    title: 'My ATS Resume',
    trackId: 'mba-finance',
    customRoleName: '',
    layoutMode: 'fresher',
    fontFamily: 'times',
    fontSizePt: 10,
    currentStep: 1,
    content: structuredClone(EMPTY_RESUME_CONTENT),
    updatedAt: new Date().toISOString(),
  };
}

export default function App() {
  const [showAdmin, setShowAdmin] = useState<boolean>(() => isAdminLocation());
  const telegramCtx = useMemo(() => initTelegramWebApp(), []);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('build');
  const [publicConfig, setPublicConfig] = useState<PublicAppConfig | null>(null);
  const [resume, setResume] = useState<ResumeRecord>(() =>
    createInitialResume(telegramCtx.workspaceUserId)
  );
  const [isExporting, setIsExporting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const saveTimerRef = useRef<number | null>(null);
  const hasHydratedRef = useRef(false);

  const showToastMessage = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Listen for direct navigation to /admin or back to /
  useEffect(() => {
    const syncRoute = () => setShowAdmin(isAdminLocation());
    window.addEventListener('popstate', syncRoute);
    window.addEventListener('hashchange', syncRoute);
    return () => {
      window.removeEventListener('popstate', syncRoute);
      window.removeEventListener('hashchange', syncRoute);
    };
  }, []);

  const refreshPublicConfig = useCallback(() => {
    fetchPublicConfig(telegramCtx)
      .then((cfg) => setPublicConfig(cfg))
      .catch(() => {
        // Safe default if offline
      });
  }, [telegramCtx]);

  // Initial load: public app/ad config + user's persisted resume
  useEffect(() => {
    refreshPublicConfig();

    let active = true;
    fetchResumes(telegramCtx)
      .then((res) => {
        if (!active) return;
        if (res.resumes && res.resumes.length > 0) {
          setResume(res.resumes[0]);
        }
        hasHydratedRef.current = true;
      })
      .catch(() => {
        hasHydratedRef.current = true;
      });
    return () => {
      active = false;
    };
  }, [telegramCtx, refreshPublicConfig]);

  // Debounced auto-save to SQLite / Cloudflare D1
  useEffect(() => {
    if (!hasHydratedRef.current || showAdmin) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveResumeApi(telegramCtx, resume).catch(() => {
        // Silent retry on next edit
      });
    }, 900);
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [resume, telegramCtx, showAdmin]);

  const starterKeywords = useMemo(() => getStarterKeywords(resume.trackId), [resume.trackId]);
  const coverage = useMemo(
    () => calculateAtsCoverage(resume.content, starterKeywords),
    [resume.content, starterKeywords]
  );

  const adRequiredForPdf = useMemo(
    () => hasActivePdfAd(publicConfig?.ads),
    [publicConfig?.ads]
  );

  const handleUpdateResume = useCallback((updater: (prev: ResumeRecord) => ResumeRecord) => {
    setResume((prev) => ({
      ...updater(prev),
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const handleSelectTrack = useCallback((trackId: TrackPresetId) => {
    const preset = getPresetById(trackId);
    setResume((prev) => ({
      ...prev,
      trackId,
      title: `${preset.shortName} Resume`,
      content: {
        ...prev.content,
        header: {
          ...prev.content.header,
          targetTitle:
            trackId === 'custom'
              ? prev.customRoleName.toUpperCase()
              : prev.content.header.targetTitle || preset.defaultTargetTitle,
        },
      },
      updatedAt: new Date().toISOString(),
    }));
    triggerHaptic('light');
  }, []);

  const handleApplyAiResume = useCallback(
    (
      content: ResumeContent,
      meta: { roleLabel: string; trackId: TrackPresetId; layoutMode: LayoutMode }
    ) => {
      setResume((prev) => ({
        ...prev,
        trackId: meta.trackId,
        layoutMode: meta.layoutMode,
        customRoleName: meta.trackId === 'custom' ? meta.roleLabel : prev.customRoleName,
        title: `${meta.roleLabel} Resume`,
        content,
        updatedAt: new Date().toISOString(),
      }));
      showToastMessage('Your ATS resume is ready! Open Preview to download PDF.');
    },
    [showToastMessage]
  );

  const handleExportPdf = useCallback(async () => {
    setIsExporting(true);
    try {
      await maybeShowAd('onPdfExport', publicConfig?.ads, telegramCtx.workspaceUserId);
      const bytes = await generateAtsPdfBytes({
        content: resume.content,
        layoutMode: resume.layoutMode,
        fontFamily: resume.fontFamily,
        fontSizePt: resume.fontSizePt,
      });
      const baseName = `${resume.content.header.fullName || 'ATS'}_${resume.title}`;
      downloadPdfBytes(bytes, baseName);

      // Silently record analytics & back up PDF to private Telegram archive channel server-side
      void recordAndArchivePdfExport(
        telegramCtx,
        bytes,
        baseName,
        resume.content.header.targetTitle || resume.title
      );

      triggerHaptic('success');
      showToastMessage('ATS PDF downloaded.');
    } catch (err) {
      showToastMessage(err instanceof Error ? err.message : 'PDF export failed.');
    } finally {
      setIsExporting(false);
    }
  }, [publicConfig?.ads, resume, telegramCtx, showToastMessage]);

  // Hidden /admin route (zero link in user-facing UI)
  if (showAdmin) {
    return (
      <AdminPanel
        onExitAdmin={() => {
          window.history.pushState({}, '', '/');
          setShowAdmin(false);
        }}
        onPublicConfigUpdated={refreshPublicConfig}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0D12] text-[#F1F5F9] flex flex-col">
      <TopBar
        appName={publicConfig?.appName || 'Shortlist Studio'}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          triggerHaptic('light');
        }}
      />

      <main className="flex-1 w-full max-w-[1520px] mx-auto px-4 md:px-6 pt-5 pb-20 md:pb-6">
        {activeTab === 'preview' ? (
          <div className="max-w-4xl mx-auto h-[calc(100vh-136px)] md:h-[calc(100vh-104px)] flex flex-col">
            <PaperPreview
              content={resume.content}
              layoutMode={resume.layoutMode}
              fontFamily={resume.fontFamily}
              fontSizePt={resume.fontSizePt}
              coverage={coverage}
              onChangeLayoutMode={(mode) =>
                handleUpdateResume((prev) => ({ ...prev, layoutMode: mode }))
              }
              onChangeFontFamily={(font) =>
                handleUpdateResume((prev) => ({ ...prev, fontFamily: font }))
              }
              onChangeFontSize={(pt) =>
                handleUpdateResume((prev) => ({ ...prev, fontSizePt: pt }))
              }
              onExportPdf={handleExportPdf}
              isExporting={isExporting}
              adRequiredForPdf={adRequiredForPdf}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left / Mobile Active Workspace: Build or Star AI Chat */}
            <section
              className={
                activeTab === 'ai-chat'
                  ? 'lg:col-span-6 xl:col-span-6'
                  : 'lg:col-span-5 xl:col-span-5'
              }
            >
              <div className="h-[calc(100vh-140px)] md:h-[calc(100vh-104px)] flex flex-col">
                {activeTab === 'ai-chat' ? (
                  <AiChatBuilder
                    resume={resume}
                    telegramCtx={telegramCtx}
                    onApplyAiResume={handleApplyAiResume}
                    onOpenPreview={() => {
                      setActiveTab('preview');
                      triggerHaptic('light');
                    }}
                  />
                ) : (
                  <BuildWizard
                    resume={resume}
                    starterKeywords={starterKeywords}
                    coverage={coverage}
                    telegramCtx={telegramCtx}
                    onUpdateResume={handleUpdateResume}
                    onSelectTrack={handleSelectTrack}
                    onOpenAiChat={() => {
                      setActiveTab('ai-chat');
                      triggerHaptic('light');
                    }}
                    onOpenPreview={() => {
                      setActiveTab('preview');
                      triggerHaptic('light');
                    }}
                    onExportPdf={handleExportPdf}
                    isExporting={isExporting}
                    adRequiredForPdf={adRequiredForPdf}
                  />
                )}
              </div>
            </section>

            {/* Right Sticky White ATS Paper Preview on Desktop */}
            <section
              className={`hidden lg:block ${
                activeTab === 'ai-chat'
                  ? 'lg:col-span-6 xl:col-span-6'
                  : 'lg:col-span-7 xl:col-span-7'
              }`}
            >
              <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-104px)] flex flex-col">
                <PaperPreview
                  content={resume.content}
                  layoutMode={resume.layoutMode}
                  fontFamily={resume.fontFamily}
                  fontSizePt={resume.fontSizePt}
                  coverage={coverage}
                  onChangeLayoutMode={(mode) =>
                    handleUpdateResume((prev) => ({ ...prev, layoutMode: mode }))
                  }
                  onChangeFontFamily={(font) =>
                    handleUpdateResume((prev) => ({ ...prev, fontFamily: font }))
                  }
                  onChangeFontSize={(pt) =>
                    handleUpdateResume((prev) => ({ ...prev, fontSizePt: pt }))
                  }
                  onExportPdf={handleExportPdf}
                  isExporting={isExporting}
                  adRequiredForPdf={adRequiredForPdf}
                />
              </div>
            </section>
          </div>
        )}
      </main>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 px-4 py-2.5 bg-[#181F2B] border border-[#38BDF8]/50 text-xs font-medium text-[#F1F5F9] rounded-xl shadow-xl shadow-black/50"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

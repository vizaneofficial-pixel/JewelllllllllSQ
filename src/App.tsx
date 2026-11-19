import React from 'react';
import { Loader2 } from 'lucide-react';
import { DesktopExperience } from './components/DesktopExperience';
import { LoginScreen } from './components/LoginScreen';
import { MobileExperience } from './components/mobile/MobileExperience';
import { ProjectSetupWizard } from './components/ProjectSetupWizard';
import { useExperienceMode } from './hooks/useExperienceMode';
import { useStallWorkspace } from './hooks/useStallWorkspace';

export default function App() {
  const experienceMode = useExperienceMode();
  const workspace = useStallWorkspace();

  const {
    auth,
    guestMode,
    setGuestMode,
    showNewProjectWizard,
    setShowNewProjectWizard,
    effectiveAccountContext,
    handleCompleteProjectSetup,
  } = workspace;

  const {
    authReady,
    workspacesReady,
    isFirebaseConfigured,
    configError,
    user,
    profile,
    syncStatus,
    authError,
    signingIn,
    projects,
    needsProjectSetup,
    signInWithGoogle,
    logout,
    retryCloudSync,
    clearAuthError,
  } = auth;

  // Loading state while auth / workspaces hydrate
  if (
    !authReady ||
    !workspacesReady ||
    (user && !profile && syncStatus === 'loading')
  ) {
    return (
      <div className="min-h-[100dvh] bg-[#0B0A10] text-[#F5F3FA] flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="w-6 h-6 text-[#A78BFA] animate-spin" />
          <div className="font-display text-sm font-bold text-[#F5F3FA]">
            StallIQ
          </div>
          <p className="text-xs text-[#A29BB8]">
            {user ? 'Loading your projects...' : 'Starting...'}
          </p>
        </div>
      </div>
    );
  }

  // Sign-in Gate
  if ((!user && !guestMode) || (user && !profile && !guestMode)) {
    return (
      <LoginScreen
        user={user}
        isFirebaseConfigured={isFirebaseConfigured}
        configError={configError}
        authError={authError}
        signingIn={signingIn}
        syncingWorkspace={syncStatus === 'loading'}
        onSignInWithGoogle={signInWithGoogle}
        onContinueAsGuest={() => setGuestMode(true)}
        onRetrySync={retryCloudSync}
        onSignOut={logout}
        onClearError={clearAuthError}
      />
    );
  }

  // First-Login 3-Step Project Setup Wizard (or "+ New Project")
  if (needsProjectSetup || showNewProjectWizard) {
    return (
      <ProjectSetupWizard
        onComplete={handleCompleteProjectSetup}
        onCancel={
          projects.length > 0 ? () => setShowNewProjectWizard(false) : undefined
        }
        canCancel={projects.length > 0}
        userGreetingName={
          effectiveAccountContext?.preferredName ||
          user?.displayName?.split(' ')[0]
        }
      />
    );
  }

  // Dual-interface presentation routing sharing the single workspace state instance
  if (experienceMode === 'mobile') {
    return <MobileExperience workspace={workspace} />;
  }

  return <DesktopExperience workspace={workspace} />;
}

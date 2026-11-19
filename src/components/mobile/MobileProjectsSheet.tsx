import React, { useMemo, useState } from 'react';
import {
  Check,
  FolderPlus,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { StallWorkspaceController } from '../../hooks/useStallWorkspace';
import type { ProjectStatus } from '../../types/stall';
import {
  PROJECT_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
} from '../../utils/orderAndProjectEngine';
import { MobileBottomSheet } from './MobileBottomSheet';

interface MobileProjectsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  workspace: StallWorkspaceController;
}

const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

export function MobileProjectsSheet({
  isOpen,
  onClose,
  workspace,
}: MobileProjectsSheetProps) {
  const { auth, setShowNewProjectWizard } = workspace;
  const { projects, activeProjectId, switchProject, updateProjectMeta, deleteProject } =
    auth;

  const [filter, setFilter] = useState<ProjectStatus | 'all'>('all');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? projects
        : projects.filter((p) => p.status === filter),
    [projects, filter]
  );

  const handleSaveRename = async (id: string) => {
    const clean = renameDraft.trim();
    if (!clean) {
      setRenamingId(null);
      return;
    }
    await updateProjectMeta(id, { name: clean });
    setRenamingId(null);
  };

  return (
    <MobileBottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Your Projects"
      subtitle={`${projects.length} saved ${projects.length === 1 ? 'project' : 'projects'}`}
      footer={
        <button
          type="button"
          onClick={() => {
            onClose();
            setShowNewProjectWizard(true);
          }}
          className="w-full min-h-[48px] rounded-2xl bg-[#8B5CF6] text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
        >
          <FolderPlus className="w-4 h-4" />
          <span>Create New Project</span>
        </button>
      }
    >
      {/* Status filter */}
      <div className="grid grid-cols-4 gap-1.5 p-1 rounded-2xl bg-[#0E0C15] border border-[#252136]">
        {(['all', 'ongoing', 'completed', 'archived'] as const).map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setFilter(status)}
            className={`min-h-[38px] rounded-xl text-xs font-semibold capitalize transition-colors ${
              filter === status
                ? 'bg-[#8B5CF6] text-white'
                : 'text-[#9D95B8]'
            }`}
          >
            {status === 'all' ? 'All' : PROJECT_STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl bg-[#0E0C15] border border-[#252136] p-6 text-center text-xs text-[#9D95B8]">
          No projects in this status yet.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((proj) => {
            const isActive = proj.id === activeProjectId;
            const isRenaming = renamingId === proj.id;
            const isDeleting = confirmDeleteId === proj.id;

            return (
              <div
                key={proj.id}
                className={`rounded-2xl p-3.5 border transition-colors ${
                  isActive
                    ? 'bg-[#1C1730] border-[#8B5CF6]/65'
                    : 'bg-[#171423] border-[#252136]'
                }`}
              >
                {isRenaming ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      aria-label="Project name"
                      className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#0E0C15] border border-[#8B5CF6] text-sm text-[#F5F3FA]"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => void handleSaveRename(proj.id)}
                      className="min-h-[42px] px-3 rounded-xl bg-[#8B5CF6] text-white text-xs font-semibold"
                    >
                      Save
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      switchProject(proj.id);
                      onClose();
                    }}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-display text-sm font-bold text-[#F5F3FA] truncate">
                        {proj.name}
                      </span>
                      {isActive && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#C4B5FD] shrink-0">
                          <Check className="w-3.5 h-3.5" />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#9D95B8] mt-1 truncate">
                      {PROJECT_TYPE_LABELS[proj.type]} · {PROJECT_STATUS_LABELS[proj.status]}
                      {proj.totalStockCost > 0
                        ? ` · ${fmt(proj.totalStockCost)}`
                        : ''}
                    </p>
                  </button>
                )}

                <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-[#252136]/80">
                  <select
                    aria-label={`Status for ${proj.name}`}
                    value={proj.status}
                    onChange={(e) =>
                      void updateProjectMeta(proj.id, {
                        status: e.target.value as ProjectStatus,
                      })
                    }
                    className="min-h-[36px] px-2.5 rounded-xl bg-[#0E0C15] border border-[#252136] text-xs text-[#DDD7EE]"
                  >
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Rename ${proj.name}`}
                      onClick={() => {
                        setRenamingId(proj.id);
                        setRenameDraft(proj.name);
                        setConfirmDeleteId(null);
                      }}
                      className="w-9 h-9 rounded-xl bg-[#0E0C15] border border-[#252136] text-[#A29BB8] flex items-center justify-center"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {projects.length > 1 && (
                      isDeleting ? (
                        <button
                          type="button"
                          onClick={() => {
                            void deleteProject(proj.id);
                            setConfirmDeleteId(null);
                          }}
                          className="min-h-[36px] px-3 rounded-xl bg-[#FB7185] text-white text-xs font-semibold"
                        >
                          Confirm Delete
                        </button>
                      ) : (
                        <button
                          type="button"
                          aria-label={`Delete ${proj.name}`}
                          onClick={() => setConfirmDeleteId(proj.id)}
                          className="w-9 h-9 rounded-xl bg-[#0E0C15] border border-[#252136] text-[#FB7185] flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </MobileBottomSheet>
  );
}

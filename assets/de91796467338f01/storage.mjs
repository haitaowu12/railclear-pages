// Browser persistence is a recovery convenience, not the portable project record.
// Refuse to replace data changed by another tab or data we could not read.
export const WORKSPACE_KEY = 'railclear.workspace.v2';
export function saveWorkspaceSnapshot(storage, workspace, expected, { blocked = false, draftsExpected } = {}) {
  if (blocked) return { expected, message: 'Saved browser data could not be read. Export workspace JSON to preserve this session; the existing saved data has not been replaced.' };
  try {
    if (storage.getItem(WORKSPACE_KEY) !== expected) return { expected, message: 'Another tab changed the saved workspace. This session has not overwritten it. Export workspace JSON, then reload to review the saved version.' };
    if (draftsExpected !== undefined && storage.getItem(DRAFTS_KEY) !== draftsExpected) return { expected, message: 'Another tab changed the saved drafts. Their applied workspace has not been overwritten. Save recovery JSON before reloading or reviewing browser recovery.' };
    const value = JSON.stringify(workspace);
    storage.setItem(WORKSPACE_KEY, value);
    return { expected: value, message: '' };
  } catch {
    return { expected, message: 'Browser storage is unavailable or full. Changes remain in this session only. Export workspace JSON before closing.' };
  }
}

export const DRAFTS_KEY = 'railclear.drafts.v2';
export const LEGACY_KEY = 'railclear.workspace.v1';
export function readBrowserSnapshot(storage) {
  return Object.fromEntries([WORKSPACE_KEY, DRAFTS_KEY, LEGACY_KEY].map(key => [key, storage.getItem(key)]));
}
export function saveDraftSnapshot(storage, draft, expected) {
  try {
    if (storage.getItem(DRAFTS_KEY) !== expected) return { expected, message: 'Saved drafts changed in another tab. They have not been replaced. Save recovery JSON to preserve this session.' };
    const value = JSON.stringify(draft);
    storage.setItem(DRAFTS_KEY, value);
    return { expected: value, message: '' };
  } catch {
    return { expected, message: 'Draft recovery could not be saved. Save recovery JSON before closing this tab.' };
  }
}
// User-invoked recovery retains the exact previous strings before replacement.
// A quota/access error or changed snapshot refuses replacement; no deletion.
export function recoverBrowserSaving(storage, expected, workspace, drafts, backupKey) {
  const actual = readBrowserSnapshot(storage);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error('Browser data changed while recovery was open. Close and reopen recovery to review it.');
  if (!backupKey.startsWith('railclear.recovery.') || storage.getItem(backupKey) !== null) throw Error('Choose a new recovery snapshot identity.');
  storage.setItem(backupKey, JSON.stringify({ kind: 'railclear-browser-backup', savedAt: new Date().toISOString(), snapshot: actual }));
  // The backup remains available even if a later write fails.
  try {
    storage.setItem(WORKSPACE_KEY, JSON.stringify(workspace));
    storage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  } catch {
    throw Error(`Replacement could not finish. Earlier data is retained in ${backupKey}.`);
  }
  return backupKey;
}

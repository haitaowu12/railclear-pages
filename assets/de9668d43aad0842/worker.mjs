import { runWorkspace } from "./workspace.mjs";
import { stampWorkspaceResult } from "./workspace-exports.mjs";
self.onmessage = async ({ data }) => {
  try {
    const result = runWorkspace(data, (p) =>
      self.postMessage({ type: "progress", ...p }),
    );
    await stampWorkspaceResult(result);
    self.postMessage({ type: "result", result });
  } catch (e) {
    self.postMessage({ type: "error", message: e.message });
  }
};

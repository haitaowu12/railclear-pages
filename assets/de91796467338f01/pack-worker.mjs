import { studyPack } from "./study-pack.mjs";
self.onmessage = ({ data }) => {
  try {
    const bytes = studyPack(data);
    self.postMessage({ bytes: bytes.buffer }, [bytes.buffer]);
  } catch (ex) {
    self.postMessage({ error: ex.message });
  }
};

import { MOCK_JOB, type JobRun } from "./mock-job";
import { getStoredJob } from "./job-store";

export function lookupJob(id: string): JobRun | null {
  const stored = getStoredJob(id);
  if (stored) return stored;
  if (id === "demo-aave-v3") return { ...MOCK_JOB, id };
  return null;
}

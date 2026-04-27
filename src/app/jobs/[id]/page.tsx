import { notFound } from "next/navigation";
import { lookupJob } from "@/lib/jobs";
import { BuildConsole } from "./build-console";

export default async function JobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = lookupJob(id);
  if (!job) notFound();
  return <BuildConsole initialJob={job} />;
}

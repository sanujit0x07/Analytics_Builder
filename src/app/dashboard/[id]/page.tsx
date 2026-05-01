import { notFound } from "next/navigation";
import { lookupJob } from "@/lib/jobs";
import { DashboardView } from "./dashboard-view";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const job = lookupJob(id);
  if (!job) notFound();
  return <DashboardView job={job} />;
}

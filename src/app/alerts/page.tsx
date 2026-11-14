import type { Metadata } from "next";
import CommandCenterLoader from "@/components/command/CommandCenterLoader";

export const metadata: Metadata = { title: "Public alerts — Tipping Point" };

// Public Alerts: the same screen as `/`, with the public view in the right
// panel. The alert list is built on the server by the shared loader.
export default function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  return <CommandCenterLoader searchParams={searchParams} />;
}

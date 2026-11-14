// Temporary route of the Command Center build: not linked, removed in the
// switch commit.
import type { Metadata } from "next";
import CommandCenterLoader from "@/components/command/CommandCenterLoader";

export const metadata: Metadata = { title: "Public alerts — Tipping Point" };

export default function PublicAlertsPreview() {
  return <CommandCenterLoader basePath="/preview" />;
}

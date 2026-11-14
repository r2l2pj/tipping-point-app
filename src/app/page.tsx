import CommandCenterLoader from "@/components/command/CommandCenterLoader";

// The Command Center. `/` and `/alerts` render the same screen; the address
// decides which view the right panel shows (Situation overview here).
// `?case=<id|alias>` deep-links a replay case (judge and demo links); the
// screen opens on Now when the id is unknown or absent.
export default function Home({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  return <CommandCenterLoader searchParams={searchParams} />;
}

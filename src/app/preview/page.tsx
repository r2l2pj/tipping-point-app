// Temporary route of the Command Center build: not linked, removed in the
// switch commit.
import CommandCenterLoader from "@/components/command/CommandCenterLoader";

export default function CommandCenterPreview({
  searchParams,
}: {
  searchParams: Promise<{ case?: string }>;
}) {
  return <CommandCenterLoader basePath="/preview" searchParams={searchParams} />;
}

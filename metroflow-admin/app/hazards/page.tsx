"use client";

import { AppShell } from "@/components/app-shell";
import { FloodClosureEditor } from "@/components/flood-closure-editor";
import { useToast } from "@/components/toast-provider";

export default function HazardsPage() {
  const { show } = useToast();

  return (
    <AppShell activeItem="hazards" title="Live Map & Hazard Authoring">
      <FloodClosureEditor onAction={show} />
    </AppShell>
  );
}

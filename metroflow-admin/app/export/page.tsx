import { AppShell } from "@/components/app-shell";
import { ExportPanel } from "@/components/export-panel";

export default function ExportPage() {
  return (
    <AppShell activeItem="export" title="Reports & Export">
      <ExportPanel />
    </AppShell>
  );
}

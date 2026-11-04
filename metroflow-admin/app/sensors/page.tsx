import { AppShell } from "@/components/app-shell";
import { SensorManagement } from "@/components/sensor-management";

export default function SensorsPage() {
  return (
    <AppShell activeItem="sensors" title="Sensor Registry">
      <SensorManagement />
    </AppShell>
  );
}

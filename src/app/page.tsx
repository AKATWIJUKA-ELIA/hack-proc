import { AppShell } from "@/components/quotebook/app-shell";
import { RequestForm } from "@/components/quotebook/request-form";

export default function HomePage() {
  return (
    <AppShell>
      <RequestForm />
    </AppShell>
  );
}

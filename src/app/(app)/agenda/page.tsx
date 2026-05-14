import { SetPageTitle } from "@/components/app/set-page-title";
import { LexAgendaShell } from "@/components/calendar/lex-agenda-shell";

export default function AgendaPage() {
  return (
    <>
      <SetPageTitle title="Agenda" />
      <LexAgendaShell />
    </>
  );
}

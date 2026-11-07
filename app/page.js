import AgendaForm from "../components/AgendaForm";

export default function Page() {
  return (
    <>
      <header className="top">
        <div className="in">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="logo" src="/logo.png" alt="Tiffany Diamond Hotels Limited - The Top and Best in Tanzania" />
          <div className="title">
            <p className="eyebrow">Meeting agenda</p>
            <h1>Weekly Operations Meeting</h1>
            <p className="sub">1 hour · Every Tuesday and Friday · Chairperson: General Manager · Secretary: HR Manager</p>
            <p className="meta-note">
              HR fills in the form on the left and the agenda builds itself. Download the PDF report, or enter the
              participants&apos; group email at the end and press Send.
            </p>
          </div>
        </div>
        <div className="stripe" aria-hidden="true" />
      </header>
      <AgendaForm defaultEmail={process.env.NEXT_PUBLIC_DEFAULT_PARTICIPANTS_EMAIL || ""} />
    </>
  );
}

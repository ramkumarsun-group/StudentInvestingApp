export default function DpaPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-white">
      <h1 className="text-3xl font-bold mb-6">Data Processing Agreement</h1>

      <section className="mb-8">
        <p className="text-on-surface-variant mb-2">
          <strong className="text-on-surface">Effective Date:</strong> March 1, 2026
        </p>
        <p className="text-on-surface-variant">
          This Data Processing Agreement (&ldquo;DPA&rdquo;) is entered into between StudentInvest
          (&ldquo;Processor&rdquo;) and the educational institution or school district
          (&ldquo;Controller&rdquo;) that enrolls students in the StudentInvest platform.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">1. Parties</h2>
        <p className="text-on-surface-variant">
          <strong className="text-on-surface">Processor:</strong> StudentInvest, operator of the
          studentinvest.app platform.
        </p>
        <p className="text-on-surface-variant mt-2">
          <strong className="text-on-surface">Controller:</strong> The school, school district, or
          educational institution enrolling students.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">2. School Data Categories Covered</h2>
        <p className="text-on-surface-variant mb-2">
          The following categories of student education records are processed under this agreement:
        </p>
        <ul className="list-disc list-inside text-on-surface-variant space-y-1">
          <li>Student name and email address</li>
          <li>Date of birth (for age verification and COPPA compliance)</li>
          <li>Academic progress data (lesson completions, quiz scores, XP)</li>
          <li>Virtual portfolio activity (paper trading history, holdings)</li>
          <li>Class enrollment and teacher assignments</li>
        </ul>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">3. Data Retention</h2>
        <p className="text-on-surface-variant">
          Student data is retained for the duration of the active enrollment. Upon account deletion
          or school contract termination, all personally identifiable student data is permanently
          deleted within <strong className="text-on-surface">30 days</strong>. Anonymised aggregate
          statistics may be retained for platform improvement.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">4. FERPA Compliance</h2>
        <p className="text-on-surface-variant">
          StudentInvest processes student education records solely as a &ldquo;school official&rdquo;
          acting under the legitimate educational interest of the enrolling institution, as permitted
          by the Family Educational Rights and Privacy Act (FERPA), 20 U.S.C. § 1232g.
          StudentInvest does not sell, rent, or share student data with third-party advertisers or
          analytics providers. All analytics events are processed first-party with no PII.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">5. Sub-Processors</h2>
        <p className="text-on-surface-variant">
          StudentInvest uses the following sub-processors, each bound by equivalent data protection
          obligations:
        </p>
        <ul className="list-disc list-inside text-on-surface-variant space-y-1 mt-2">
          <li>Cloud infrastructure provider (hosting and database)</li>
          <li>Email delivery provider (transactional emails only)</li>
        </ul>
        <p className="text-on-surface-variant mt-2">
          No third-party advertising, analytics, or tracking sub-processors are used.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">6. Security Measures</h2>
        <p className="text-on-surface-variant">
          StudentInvest implements industry-standard security measures including encrypted data
          transmission (TLS), encrypted passwords (bcrypt), short-lived access tokens, and
          role-based access controls.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">7. Contact</h2>
        <p className="text-on-surface-variant">
          For data privacy inquiries, data deletion requests, or to request a signed copy of this
          DPA, contact:
        </p>
        <p className="mt-2">
          <a
            href="mailto:privacy@studentinvest.app"
            className="text-green-400 underline hover:text-green-300"
          >
            privacy@studentinvest.app
          </a>
        </p>
      </section>
    </main>
  );
}

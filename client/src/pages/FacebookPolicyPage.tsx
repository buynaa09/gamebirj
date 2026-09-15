import { Link } from 'react-router-dom';
import { Seo } from '../components/seo/Seo';
import styles from './FacebookPolicyPage.module.css';

const sections = [
  { id: 'information-we-collect', label: '1. Information We Collect' },
  { id: 'facebook-meta-information', label: '2. Information from Facebook / Meta' },
  { id: 'automatically-collected', label: '3. Automatically Collected Information' },
  { id: 'how-we-use', label: '4. How We Use Information' },
  { id: 'storage-security', label: '5. Storage and Protection' },
  { id: 'sharing', label: '6. Sharing with Third Parties' },
  { id: 'facebook-meta-platform-data', label: '7. Facebook / Meta Platform Data' },
  { id: 'rights-choices', label: '8. Your Rights and Choices' },
  { id: 'cookies', label: '9. Cookies and Similar Technologies' },
  { id: 'retention', label: '10. Data Retention' },
  { id: 'data-deletion', label: '11. Data Deletion' },
  { id: 'children', label: "12. Children's Privacy" },
  { id: 'changes', label: '13. Changes to This Policy' },
  { id: 'contact', label: '14. Contact Us' },
];

export function FacebookPolicyPage() {
  return (
    <main className={styles.page}>
      <Seo
        title="Privacy Policy | GameBirj"
        description="GameBirj privacy policy: how we collect, use, store and share information, including Facebook / Meta integration data and deletion requests."
        path="/facebook-policy"
      />
      <div className={styles.container}>
        <nav className={styles.breadcrumb} aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>Privacy Policy</span>
        </nav>

        <header className={styles.hero}>
          <p className={styles.kicker}>GameBirj &middot; Legal</p>
          <h1>Privacy Policy</h1>
          <p className={styles.lead}>
            This Privacy Policy describes how GameBirj (&ldquo;GameBirj&rdquo;, &ldquo;we&rdquo;,
            &ldquo;us&rdquo;, or &ldquo;our&rdquo;) collects, uses, stores, and shares
            information when you visit{' '}
            <a href="https://gamebirj.com/">https://gamebirj.com/</a>, use our services,
            or interact with our Facebook / Meta integration (such as Facebook Login,
            Meta APIs, or Facebook sharing features), where available.
          </p>
          <dl className={styles.meta}>
            <div>
              <dt>Effective Date</dt>
              <dd>
                <span className={styles.placeholder}>[INSERT DATE]</span>
              </dd>
            </div>
            <div>
              <dt>Last Updated</dt>
              <dd>
                <span className={styles.placeholder}>[INSERT DATE]</span>
              </dd>
            </div>
            <div>
              <dt>Applies to</dt>
              <dd>
                <a href="https://gamebirj.com/">gamebirj.com</a> and associated Meta
                platform interactions
              </dd>
            </div>
          </dl>
          <aside className={styles.ownerNote} aria-label="Notice to website owner">
            <strong>Website owner action required:</strong> items marked{' '}
            <span className={styles.placeholder}>like this</span> are placeholders and
            must be confirmed or replaced before relying on this page. This page uses
            general, cautious language and does not by itself establish compliance with
            any law, regulation, or Meta policy.
          </aside>
        </header>

        <div className={styles.layout}>
          <aside className={styles.toc} aria-label="On this page">
            <p className={styles.tocTitle}>On this page</p>
            <ol>
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`}>{s.label}</a>
                </li>
              ))}
            </ol>
            <a href="#data-deletion" className={styles.tocCta}>
              Request data deletion
            </a>
          </aside>

          <article className={styles.article}>
            <section id="information-we-collect">
              <h2>1. Information We Collect</h2>
              <p>
                The specific information GameBirj collects depends on how you use the
                site and which features you choose to use. Categories may include:
              </p>
              <ul>
                <li>
                  <strong>Account and contact information</strong> you provide directly,
                  such as a username, email address, or information you submit through
                  forms, listings, or messages. <span className={styles.placeholder}>[CONFIRM: list the account fields GameBirj actually collects]</span>
                </li>
                <li>
                  <strong>Marketplace content</strong> you create or share, such as
                  listings, rental posts, messages with other users, and support
                  requests.
                </li>
                <li>
                  <strong>Facebook / Meta information</strong>, described in Sections 2
                  and 7, if you use Facebook Login or other Meta features.
                </li>
                <li>
                  <strong>Automatically collected information</strong>, described in
                  Section 3.
                </li>
              </ul>
              <p>
                We do not intentionally collect information beyond what is described in
                this policy. If any listed category does not apply to your use of
                GameBirj, that information is not collected from you in that context.{' '}
                <span className={styles.placeholder}>
                  [OWNER: remove or revise any category that GameBirj does not collect]
                </span>
              </p>
            </section>

            <section id="facebook-meta-information">
              <h2>2. Information Collected through Facebook / Meta Login or APIs</h2>
              <p>
                If you choose to connect with Facebook / Meta &mdash; for example
                through Facebook Login, a Meta API integration, or a sharing feature
                &mdash; we may receive information from Meta as permitted by your
                settings, the permissions you approve, and Meta&rsquo;s platform
                configuration. Depending on the integration and the permissions granted,
                this may include:
              </p>
              <ul>
                <li>Name and profile information you make available through Meta</li>
                <li>Email address associated with your Meta account</li>
                <li>Facebook user ID or other Meta-provided identifiers</li>
                <li>
                  Other profile information or content you elect to share through the
                  Meta login or permission screens
                </li>
              </ul>
              <p>
                <span className={styles.placeholder}>
                  [CONFIRM: list the exact Facebook permissions / data fields GameBirj
                  requests, e.g. public_profile, email &mdash; list only what is
                  actually requested]
                </span>
              </p>
              <p>
                You control whether to use Meta features. If you do not connect a Meta
                account or approve the requested permissions, we do not receive Meta
                platform information about you through those features.
              </p>
            </section>

            <section id="automatically-collected">
              <h2>3. Automatically Collected Information</h2>
              <p>
                When you visit or use GameBirj, certain technical and usage information
                may be collected automatically, including:
              </p>
              <ul>
                <li>IP address and approximate location derived from it</li>
                <li>
                  Browser type and version, device type, operating system, and device
                  identifiers
                </li>
                <li>
                  Pages viewed, links clicked, referring / exit pages, search queries,
                  and other usage data
                </li>
                <li>
                  Cookies and similar technologies, as described in Section 9{' '}
                  <span className={styles.placeholder}>
                    [CONFIRM: analytics / cookie tools actually in use, if any]
                  </span>
                </li>
              </ul>
            </section>

            <section id="how-we-use">
              <h2>4. How We Use Collected Information</h2>
              <p>GameBirj uses collected information for purposes such as:</p>
              <ul>
                <li>Operating, maintaining, and improving the website and marketplace features</li>
                <li>Creating and managing accounts, listings, rentals, and messages</li>
                <li>
                  Enabling Facebook / Meta functionality you choose to use, such as
                  sign-in, account linking, or sharing
                </li>
                <li>Providing customer support and responding to inquiries</li>
                <li>
                  Protecting the security and integrity of the platform, including
                  fraud prevention and abuse detection
                </li>
                <li>
                  Meeting legal, safety, and record-keeping needs{' '}
                  <span className={styles.placeholder}>
                    [OWNER: confirm these purposes match actual operations]
                  </span>
                </li>
              </ul>
              <p>
                We do not use Facebook / Meta user data for purposes incompatible with
                the functionality you requested or with applicable Meta Platform
                policies.
              </p>
            </section>

            <section id="storage-security">
              <h2>5. How Information Is Stored and Protected</h2>
              <p>
                We use reasonable administrative, technical, and organizational measures
                intended to protect personal information against unauthorized access,
                loss, misuse, or alteration. These measures may include access controls,
                encrypted connections (HTTPS), and limited internal access to personal
                data. <span className={styles.placeholder}>[CONFIRM: hosting provider, storage location(s), and security practices]</span>
              </p>
              <p>
                No method of transmission over the internet or electronic storage is
                completely secure. While we work to protect your information, we cannot
                guarantee absolute security.
              </p>
            </section>

            <section id="sharing">
              <h2>6. When Information May Be Shared with Third Parties</h2>
              <p>We may share information in the following limited circumstances:</p>
              <ul>
                <li>
                  <strong>Service providers</strong> that help operate the site (for
                  example hosting, analytics, messaging, or support tools), under
                  appropriate confidentiality and data-handling arrangements.{' '}
                  <span className={styles.placeholder}>
                    [CONFIRM: list categories of providers actually used]
                  </span>
                </li>
                <li>
                  <strong>Meta Platforms</strong> as necessary to operate the
                  Facebook / Meta integration you use, subject to Section 7.
                </li>
                <li>
                  <strong>Legal and safety reasons</strong>, such as to comply with
                  applicable law, respond to lawful requests, enforce our terms, or
                  protect the rights, safety, or property of GameBirj, our users, or
                  others.
                </li>
                <li>
                  <strong>Business changes</strong>, such as a merger, acquisition, or
                  asset transfer, where information may be transferred subject to
                  applicable law. <span className={styles.placeholder}>[OWNER: confirm or remove]</span>
                </li>
              </ul>
              <p>
                We do not sell personal information, including Facebook / Meta user
                data. See Section 7 for the specific statement on Meta platform data.
              </p>
            </section>

            <section id="facebook-meta-platform-data" className={styles.highlight}>
              <h2>7. Facebook / Meta Platform Data</h2>
              <p>
                This section applies when you interact with GameBirj through Facebook /
                Meta platform features:
              </p>
              <ul>
                <li>
                  <strong>Data minimization.</strong> GameBirj only requests information
                  necessary for the functionality of its Facebook / Meta integration.{' '}
                  <span className={styles.placeholder}>
                    [CONFIRM: the permission set is limited to what the integration
                    functionally requires]
                  </span>
                </li>
                <li>
                  <strong>Platform policies.</strong> Facebook / Meta information is
                  handled in accordance with applicable Meta Platform policies,
                  including Meta&rsquo;s requirements on data use, storage, security,
                  sharing, and deletion, to the extent they apply to GameBirj&rsquo;s
                  integration. This statement describes our approach; it is not a
                  certification of compliance.
                </li>
                <li>
                  <strong>No sale of Meta user data.</strong> GameBirj does not sell
                  Facebook / Meta user data.
                </li>
                <li>
                  <strong>Deletion.</strong> You can request deletion of data
                  associated with your GameBirj account, including data received
                  through Meta, as described in Section 11 (Data Deletion).
                </li>
              </ul>
              <p>
                For questions about how Meta handles your information on Meta&rsquo;s
                own platforms, please review Meta&rsquo;s privacy policy and your Meta
                privacy settings. <span className={styles.placeholder}>[OPTIONAL: add link to Meta privacy policy if desired]</span>
              </p>
            </section>

            <section id="rights-choices">
              <h2>8. Your Rights and Choices</h2>
              <p>Depending on your location and applicable law, you may be able to:</p>
              <ul>
                <li>Request access to personal information we hold about you</li>
                <li>Request correction of inaccurate information</li>
                <li>Request deletion of your personal information (see Section 11)</li>
                <li>
                  Disconnect a linked Facebook / Meta account or revoke permissions
                  through your Meta settings, which may limit related functionality
                </li>
                <li>Adjust cookie preferences through your browser settings</li>
              </ul>
              <p>
                To exercise a request, contact us using the details in Section 14. We
                may need to verify your identity before acting on a request. Available
                rights vary by jurisdiction; this policy does not claim any specific
                legal entitlement beyond what applicable law provides.{' '}
                <span className={styles.placeholder}>
                  [OWNER: confirm the request process and response handling]
                </span>
              </p>
            </section>

            <section id="cookies">
              <h2>9. Cookies and Similar Technologies</h2>
              <p>
                GameBirj may use cookies, local storage, and similar technologies to
                keep you signed in, remember preferences (such as theme), maintain
                security, and understand how the site is used.
              </p>
              <ul>
                <li>
                  <strong>Strictly necessary / functional:</strong> required for core
                  features such as authentication and saved preferences.
                </li>
                <li>
                  <strong>Analytics / performance:</strong> used only if such tools are
                  enabled, to understand aggregate usage.{' '}
                  <span className={styles.placeholder}>
                    [CONFIRM: whether analytics cookies are used]
                  </span>
                </li>
                <li>
                  <strong>Third-party / Meta-related:</strong> Meta features may set
                  their own cookies or process information under Meta&rsquo;s policies
                  when you interact with them.
                </li>
              </ul>
              <p>
                Most browsers allow you to block or delete cookies. Blocking some
                cookies may affect site functionality.
              </p>
            </section>

            <section id="retention">
              <h2>10. Data Retention</h2>
              <p>
                We retain personal information only for as long as reasonably necessary
                for the purposes described in this policy, including operating the
                service, complying with legal or reporting needs, resolving disputes,
                and enforcing agreements.{' '}
                <span className={styles.placeholder}>
                  [CONFIRM: retention periods or criteria actually applied]
                </span>
              </p>
              <p>
                When information is no longer needed, we take reasonable steps to
                delete it or render it non-identifiable, subject to technical and legal
                constraints such as backups and legal holds.
              </p>
            </section>

            <section id="data-deletion" className={styles.deletion}>
              <h2>11. Data Deletion</h2>
              <p>
                <strong>
                  You can request deletion of your personal data associated with your
                  GameBirj account at any time.
                </strong>
              </p>
              <p>To request deletion:</p>
              <ol>
                <li>
                  Email{' '}
                  <a href="mailto:[INSERT PRIVACY EMAIL]">
                    <span className={styles.placeholder}>[INSERT PRIVACY EMAIL]</span>
                  </a>{' '}
                  from the email address associated with your account with the subject
                  line &ldquo;Data Deletion Request&rdquo;.
                </li>
                <li>
                  Include your GameBirj username (if any) and confirm whether the
                  request covers your full account, Meta-linked data, or specific
                  information.
                </li>
                <li>
                  If you signed in with Facebook / Meta, you may also remove
                  GameBirj&rsquo;s access through your Meta account settings to revoke
                  Login permissions.
                </li>
              </ol>
              <p>
                We will review the request, verify account ownership where needed, and
                delete or de-identify covered personal data within a reasonable period,
                subject to technical constraints (such as backups) and any retention
                required by law, safety, fraud prevention, or dispute resolution.{' '}
                <span className={styles.placeholder}>
                  [CONFIRM: deletion contact, process, and expected response time]
                </span>
              </p>
            </section>

            <section id="children">
              <h2>12. Children&rsquo;s Privacy</h2>
              <p>
                GameBirj is not directed to children, and we do not knowingly collect
                personal information from children. If you believe a child has provided
                personal information to us, please contact us using the details in
                Section 14 so we can take appropriate steps.{' '}
                <span className={styles.placeholder}>
                  [CONFIRM: minimum age / eligibility under GameBirj terms]
                </span>
              </p>
            </section>

            <section id="changes">
              <h2>13. Changes to This Privacy Policy</h2>
              <p>
                We may update this Privacy Policy from time to time. When we do, we
                will revise the &ldquo;Last Updated&rdquo; date above and post the
                updated policy at{' '}
                <a href="https://gamebirj.com/facebook-policy">
                  https://gamebirj.com/facebook-policy
                </a>
                . We encourage you to review this page periodically. Continued use of
                GameBirj after changes take effect indicates your acknowledgment of the
                updated policy, to the extent permitted by law.
              </p>
            </section>

            <section id="contact">
              <h2>14. Contact Us</h2>
              <p>
                For privacy questions, requests (including access, correction, or
                deletion), or concerns about this policy or our Facebook / Meta
                integration, contact:
              </p>
              <div className={styles.contactCard}>
                <p>
                  <strong>Company / Website:</strong> GameBirj
                </p>
                <p>
                  <strong>Website:</strong>{' '}
                  <a href="https://gamebirj.com/">https://gamebirj.com/</a>
                </p>
                <p>
                  <strong>Privacy contact email:</strong>{' '}
                  <a href="mailto:[INSERT PRIVACY EMAIL]">
                    <span className={styles.placeholder}>[INSERT PRIVACY EMAIL]</span>
                  </a>
                </p>
                <p>
                  <strong>Legal entity / address:</strong>{' '}
                  <span className={styles.placeholder}>
                    [INSERT LEGAL NAME AND ADDRESS, IF APPLICABLE]
                  </span>
                </p>
              </div>
              <p className={styles.smallPrint}>
                Note: this page provides general information about GameBirj&rsquo;s
                data practices and is not legal advice. The website owner should have
                this policy reviewed for their specific operations, applicable laws,
                and Meta platform requirements.
              </p>
            </section>
          </article>
        </div>
      </div>
    </main>
  );
}

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui';

export const CONTACT_EMAIL = 'hannajohn37@gmail.com';

/** Shared shell for the legal/trust pages - system tokens, readable measure. */
export const LegalLayout = ({ title, updated, children }) => {
  const navigate = useNavigate();
  return (
    <div className="min-h-full bg-canvas px-6 py-12">
      <div className="mx-auto max-w-[65ch]">
        <Button
          variant="ghost"
          size="sm"
          mono
          className="mb-8 -ml-3"
          onClick={() => navigate('/')}
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden="true" />
          Back to MindFlow
        </Button>
        <h1 className="text-display-sm text-primary">{title}</h1>
        <p className="mb-8 mt-2 text-label-sm text-secondary">
          Last updated: {updated}
        </p>
        <div className="text-body leading-relaxed text-secondary [&_p]:mb-4 [&_strong]:font-medium [&_strong]:text-primary">
          {children}
        </div>
      </div>
    </div>
  );
};

const H2 = ({ children }) => (
  <h2 className="mb-3 mt-8 text-title text-primary">{children}</h2>
);

/** In-copy mailto link, accent-toned with a visible focus ring. */
const MailLink = () => (
  <a
    href={`mailto:${CONTACT_EMAIL}`}
    className="text-accent underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
  >
    {CONTACT_EMAIL}
  </a>
);

export const PrivacyPage = () => (
  <LegalLayout title="Privacy Policy" updated="August 6, 2026">
    <p>
      MindFlow is a study app. This policy explains, in plain language, what data we
      handle and why. The short version: we store the data you create so the app can
      work, we don't sell it, and you can delete it.
    </p>

    <H2>What we collect</H2>
    <p>
      <strong>Account data:</strong> your email address, managed by our authentication
      provider (Supabase). <strong>Study data:</strong> your topics, focus sessions,
      recall attempts, flashcard decks and review history — this is the product working
      as intended. <strong>Billing data:</strong> handled entirely by Stripe; we never
      see or store your card number, only your subscription status.
    </p>

    <H2>AI processing</H2>
    <p>
      When you use an AI feature (recall grading, flashcard generation, Feynman
      feedback), the text you submit is sent to Google's Gemini API to produce the
      result. We don't use your study material to train models, and we only send what
      the feature needs.
    </p>

    <H2>What we don't do</H2>
    <p>
      We don't sell your data, we don't show ads, and we don't share your study
      material with anyone except the processors named above (Supabase, Stripe,
      Google Gemini) that make the product function.
    </p>

    <H2>Data retention and deletion</H2>
    <p>
      Your data is kept while your account exists. You can clear local data in
      Settings → Data &amp; Privacy, and you can request full account deletion by
      emailing <MailLink />.
      Deletion removes your profile and all study data.
    </p>

    <H2>Contact</H2>
    <p>
      Questions about this policy: <MailLink />.
    </p>
  </LegalLayout>
);

export const AboutPage = () => (
  <LegalLayout title="About MindFlow" updated="August 6, 2026">
    <div className="mb-7 flex items-center gap-5">
      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-pill bg-accent-wash text-title text-accent">
        JH
      </div>
      <div>
        <div className="text-body font-medium text-primary">John Hanna</div>
        <div className="text-body-sm text-secondary">Builder of MindFlow</div>
      </div>
    </div>

    <p>
      MindFlow exists because most studying is re-reading, and re-reading barely
      works. The research is unambiguous: testing yourself and spacing your reviews
      beats highlighting and rewatching lectures, every time. The problem is that
      doing it properly takes four separate tools and a spreadsheet's worth of
      discipline.
    </p>

    <H2>What it does</H2>
    <p>
      MindFlow runs the whole loop in one place: focus on a topic, blurt what you
      remember, let the AI find exactly what you missed, turn only the misses into
      flashcards, and see them again right before you'd forget. Every feature exists
      to serve that loop — if it doesn't help you remember on exam day, it isn't
      here.
    </p>

    <H2>Get in touch</H2>
    <p>
      Bugs, ideas, or just want to say the recall grader was too harsh:{' '}
      <MailLink />.
      I read everything.
    </p>
  </LegalLayout>
);

export const TermsPage = () => (
  <LegalLayout title="Terms of Service" updated="August 6, 2026">
    <p>
      These terms cover your use of MindFlow. By creating an account you agree to
      them.
    </p>

    <H2>The service</H2>
    <p>
      MindFlow provides study tools: focus timers, AI-assisted recall testing,
      flashcards with spaced repetition, and related features. The service is
      provided "as is" — we work hard to keep it reliable, but we don't guarantee
      uninterrupted availability, and AI-generated content can be wrong; verify
      anything that matters before an exam.
    </p>

    <H2>Your account</H2>
    <p>
      You're responsible for your account and for keeping your credentials safe. You
      must be at least 13 years old (or the minimum age in your country) to use
      MindFlow.
    </p>

    <H2>Subscriptions and billing</H2>
    <p>
      Paid plans are billed through Stripe. You can cancel any time from Settings;
      cancellation stops future charges and your plan stays active until the end of
      the paid period. Refund requests: email us and we'll be reasonable.
    </p>

    <H2>Your content</H2>
    <p>
      Notes, decks and study material you create remain yours. You give us only the
      permission needed to store and process them so the product works (including the
      AI processing described in the Privacy Policy).
    </p>

    <H2>Acceptable use</H2>
    <p>
      Don't abuse the service: no attempts to break authentication or rate limits, no
      reselling API access, no uploading content you don't have the right to use.
    </p>

    <H2>Liability</H2>
    <p>
      To the maximum extent allowed by law, MindFlow's liability is limited to the
      amount you paid us in the last 12 months. We're a study tool; exam results
      remain, stubbornly, yours.
    </p>

    <H2>Changes</H2>
    <p>
      If these terms change materially we'll note it here with a new date. Continued
      use after a change means you accept the updated terms.
    </p>

    <H2>Contact</H2>
    <p>
      <MailLink />
    </p>
  </LegalLayout>
);

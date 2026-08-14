import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FileQuestion } from 'lucide-react';
import { Button, EmptyState } from '../components/ui';

/**
 * Shown for any URL the router does not recognise.
 *
 * The app previously redirected every unknown path to the dashboard. That
 * made a typo, a dead link and a genuinely broken route indistinguishable -
 * you could not tell whether you had mistyped or the app had failed.
 *
 * Styled as an app-surface error state, not a marketing page: the house
 * EmptyState shape - one sentence naming what's wrong, then the ONE action
 * that resolves it. No oversized numeral off the type scale; the failing
 * path is echoed back because it's the one piece of information that lets
 * the reader spot the typo. Focus on the action is the global ring.
 */
const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex min-h-full w-full items-center justify-center bg-canvas p-6">
      <EmptyState
        className="w-full max-w-[420px]"
        icon={<FileQuestion size={18} strokeWidth={1.5} aria-hidden="true" />}
        title="This page doesn't exist"
        description={
          <>
            No route matches{' '}
            <span className="break-all text-primary">{location.pathname}</span>.
          </>
        }
        action={
          <Button variant="secondary" mono onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        }
      />
    </div>
  );
};

export default NotFound;

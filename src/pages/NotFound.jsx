import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui';

/**
 * Shown for any URL the router does not recognise.
 *
 * The app previously redirected every unknown path to the dashboard. That
 * made a typo, a dead link and a genuinely broken route indistinguishable -
 * you could not tell whether you had mistyped or the app had failed.
 */
const NotFound = () => {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-canvas p-12 text-center">
      <h1 className="select-none font-mono text-[10rem] font-medium leading-none text-tertiary opacity-20">
        404
      </h1>

      <h2 className="text-title text-primary">This page doesn't exist</h2>

      <p className="max-w-[480px] break-all text-body-sm text-secondary">
        {location.pathname}
      </p>

      <Button mono size="lg" className="mt-4" onClick={() => navigate('/dashboard')}>
        Back to Dashboard
      </Button>
    </div>
  );
};

export default NotFound;

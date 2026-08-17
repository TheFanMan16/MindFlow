import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Modal, Button, Badge } from './ui';

const PRO_FEATURES = [
  'Unlimited recall grading',
  'Unlimited deck generation',
  'Unlimited Feynman feedback',
  'Exam countdown',
  'Unlimited streak freezes',
];

/**
 * Graceful paywall: shown when a free user hits their AI limit, instead of a
 * raw error toast. Sells the upgrade, offers a way out, touches no billing
 * logic itself - the Settings page owns the actual Stripe flow.
 *
 * Initial focus goes to "Maybe later" (data-initial-focus): the modal
 * interrupted the user, so the least committal control - not the sell -
 * must be the first thing Enter acts on. Checkmarks are lucide icons, not
 * glyph text: type never stands in for iconography here.
 */
const UpgradeModal = ({ isOpen, onClose, message }) => {
  const navigate = useNavigate();

  return (
    // aria-label names the dialog for screen readers; the visible heading
    // inside stays the visual title.
    <Modal open={isOpen} onClose={onClose} aria-label="Upgrade to MindFlow Pro">
      <div className="flex flex-col gap-4 py-2">
        <div>
          <Badge variant="accent">Pro</Badge>
        </div>
        <div>
          <h2 className="text-title text-primary">You're on a roll</h2>
          <p className="mt-2 text-body text-secondary">
            {message || "You've used your 5 free AI actions for today."}
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {PRO_FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2.5 text-body-sm text-secondary">
              <Check className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2} aria-hidden="true" />
              {feature}
            </li>
          ))}
        </ul>
        <div className="mt-1 flex flex-col gap-2">
          <Button
            variant="primary"
            mono
            className="w-full"
            onClick={() => {
              onClose();
              navigate('/settings');
            }}
          >
            See Pro plans
          </Button>
          <Button variant="ghost" className="w-full" onClick={onClose} data-initial-focus="">
            Maybe later — limits reset tomorrow
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default UpgradeModal;

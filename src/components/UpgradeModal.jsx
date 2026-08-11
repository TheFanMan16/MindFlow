import React from 'react';
import { useNavigate } from 'react-router-dom';
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
 */
const UpgradeModal = ({ isOpen, onClose, message }) => {
  const navigate = useNavigate();

  return (
    <Modal open={isOpen} onClose={onClose}>
      <div className="flex flex-col gap-4 py-2">
        <div>
          <Badge variant="accent">Pro</Badge>
        </div>
        <div>
          <h2 className="text-h2 text-primary">You're on a roll</h2>
          <p className="mt-2 text-body text-secondary">
            {message || "You've used your 5 free AI actions for today."}
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {PRO_FEATURES.map((feature) => (
            <li key={feature} className="flex items-center gap-2.5 text-small text-secondary">
              <span aria-hidden="true" className="font-mono text-accent">
                ✓
              </span>
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
          <Button variant="ghost" className="w-full" onClick={onClose}>
            Maybe later — limits reset tomorrow
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default UpgradeModal;

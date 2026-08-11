import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Hourglass, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { findOrCreateTopic, setTopicExamDate } from '../utils/studyLoop';
import { Breadcrumb, Card, Field, Input, Textarea, Button, Badge } from '../components/ui';
import { motion, useReducedMotion, Stagger } from '../motion';
import { entrance, reduced } from '../motion/transitions';

const MIN_NOTES = 200;

/**
 * Build the cram plan locally - no AI call needed to schedule; the AI spends
 * its budget where it matters (grading recall, generating cards for gaps).
 */
export function buildCramPlan(hoursLeft) {
  const plan = [
    { when: 'Right now', what: 'Recall test on your notes — find the weak spots before you re-read anything.' },
    { when: 'Next 10 min', what: 'Turn the missed concepts into flashcards (one click on the results screen).' },
  ];

  if (hoursLeft >= 24) {
    plan.push(
      { when: 'Today', what: 'One 25-minute focus session on ONLY the missed concepts.' },
      { when: 'Tonight', what: 'Run the miss deck until every card is easy. Then stop — sleep beats re-reading.' },
      { when: 'Morning of', what: 'Miss deck once more, then one 5-minute recall test as a final check.' }
    );
  } else if (hoursLeft >= 6) {
    plan.push(
      { when: `In ${Math.round(hoursLeft / 3)}h`, what: 'Run the miss deck. Again — retrieval, not re-reading.' },
      { when: `In ${Math.round((hoursLeft * 2) / 3)}h`, what: 'Second recall test. New misses become new cards.' },
      { when: 'Last hour', what: 'Miss deck one final time. Then close the laptop — you have done the highest-yield work.' }
    );
  } else {
    plan.push(
      { when: 'Every hour left', what: 'One pass of the miss deck. Skip everything you already recall — gaps only.' },
      { when: 'Final 30 min', what: 'Say the missed concepts out loud from memory. If you can explain it, you can answer it.' }
    );
  }
  return plan;
}

const PanicMode = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notes, setNotes] = useState('');
  const [examName, setExamName] = useState('');
  const [examAt, setExamAt] = useState('');
  const [plan, setPlan] = useState(null);
  const [isStarting, setIsStarting] = useState(false);
  const [topic, setTopic] = useState(null);
  const reduce = useReducedMotion();

  const hoursLeft = useMemo(() => {
    if (!examAt) return null;
    return Math.max(0, (new Date(examAt) - new Date()) / (1000 * 60 * 60));
  }, [examAt]);

  const notesShortBy = Math.max(0, MIN_NOTES - notes.trim().length);

  const handleBuildPlan = async () => {
    if (notesShortBy > 0) {
      toast.error(`Add at least ${notesShortBy} more characters so the AI has something to test you on.`);
      return;
    }
    if (!examAt || hoursLeft === null) {
      toast.error('When is the exam? The plan is built backward from it.');
      return;
    }
    if (hoursLeft <= 0) {
      toast.error('That exam time is in the past.');
      return;
    }

    setIsStarting(true);
    try {
      let resolvedTopic = null;
      if (user?.id) {
        const name = examName.trim() || `Exam ${new Date(examAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        resolvedTopic = await findOrCreateTopic(user.id, name);
        if (resolvedTopic) {
          // Date part only - topics track the day; the hour lives in the plan.
          await setTopicExamDate(user.id, resolvedTopic.id, examAt.slice(0, 10));
        }
      }
      setTopic(resolvedTopic);
      setPlan(buildCramPlan(hoursLeft));
    } finally {
      setIsStarting(false);
    }
  };

  const startRecall = () => {
    navigate('/recall', {
      state: {
        topicId: topic?.id || null,
        topicName: topic?.name || examName.trim() || 'Exam cram',
        sourceText: notes,
        from: 'panic',
      },
    });
  };

  const runwayLabel =
    hoursLeft !== null && hoursLeft < 48
      ? `${Math.round(hoursLeft)} hour${Math.round(hoursLeft) === 1 ? '' : 's'}`
      : hoursLeft !== null
        ? `${Math.round(hoursLeft / 24)} days`
        : null;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <Breadcrumb trail={['MindFlow', 'Panic']} />

      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={reduce ? reduced : entrance}
        className="mt-8"
      >
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-4 w-px bg-danger" aria-hidden="true" />
            <span className="font-mono text-micro uppercase text-danger">Triage mode</span>
          </div>
          <h1 className="text-h1 text-primary">Exam soon? Paste your notes.</h1>
          <p className="mt-3 max-w-[60ch] text-body text-secondary">
            MindFlow triages the hours you have left: an instant recall test finds the
            gaps, cards get built for only the gaps, and you get a schedule for the
            time remaining. No re-reading marathons.
          </p>
        </div>

        {!plan ? (
          <Card className="border-danger-line p-6 md:p-7">
            <div className="flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="What exam?">
                  <Input
                    type="text"
                    value={examName}
                    onChange={(e) => setExamName(e.target.value)}
                    placeholder="e.g. Bio 101 midterm"
                  />
                </Field>
                <Field label="When is it?">
                  <Input
                    type="datetime-local"
                    value={examAt}
                    onChange={(e) => setExamAt(e.target.value)}
                    className="font-mono"
                    style={{ colorScheme: 'dark' }}
                  />
                </Field>
              </div>

              <Field label="Your notes">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Paste everything you need to know…"
                  className="min-h-[260px] leading-relaxed"
                />
              </Field>
              <p className={`-mt-3 text-small ${notesShortBy > 0 ? 'text-danger' : 'text-success'}`}>
                {notesShortBy > 0 ? (
                  <>
                    Add at least <span className="font-mono">{notesShortBy}</span> more characters so the AI has something to work with
                  </>
                ) : (
                  <>
                    <span className="font-mono">{notes.trim().length.toLocaleString()}</span> characters — ready
                  </>
                )}
              </p>

              {hoursLeft !== null && hoursLeft > 0 && (
                <div className="flex items-center gap-2 text-small text-warning">
                  <Hourglass className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    <span className="font-mono">{runwayLabel}</span> until the exam
                  </span>
                </div>
              )}

              <Button
                size="lg"
                mono
                magnetic
                className="w-full"
                onClick={handleBuildPlan}
                disabled={isStarting}
              >
                {isStarting ? 'Building your triage plan…' : 'Build my triage plan'}
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="border-danger-line p-6 md:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-h2 text-primary">
                Your plan for the next{' '}
                <span className="font-mono">
                  {hoursLeft < 48 ? `${Math.round(hoursLeft)} hours` : `${Math.round(hoursLeft / 24)} days`}
                </span>
              </h2>
              <Badge variant="danger">Triage</Badge>
            </div>
            <Stagger role="list" className="mb-6 flex flex-col gap-3">
              {plan.map((step, i) => (
                <Stagger.Item role="listitem" key={i}>
                  <div className="flex gap-4 rounded-input border border-soft bg-base px-4 py-3.5">
                    <div className="min-w-[110px] font-mono text-micro uppercase text-accent">
                      {step.when}
                    </div>
                    <div className="text-small leading-relaxed text-secondary">{step.what}</div>
                  </div>
                </Stagger.Item>
              ))}
            </Stagger>
            <Button size="lg" mono magnetic className="w-full" onClick={startRecall}>
              Step 1: Start the recall test
              <ArrowRight className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
            </Button>
          </Card>
        )}
      </motion.div>
    </div>
  );
};

export default PanicMode;

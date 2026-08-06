import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { findOrCreateTopic, setTopicExamDate } from '../utils/studyLoop';

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

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '12px',
    color: '#ffffff',
    fontSize: '15px',
    fontFamily: 'inherit',
    outline: 'none',
    colorScheme: 'dark',
  };

  return (
    <div style={{ padding: '48px 24px', maxWidth: '760px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '40px',
          fontWeight: 700,
          color: '#ef4444',
          marginBottom: '10px',
          textShadow: '0 0 24px rgba(239, 68, 68, 0.4)',
        }}>
          Exam soon? Paste your notes.
        </h1>
        <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6 }}>
          MindFlow triages the hours you have left: an instant recall test finds the
          gaps, cards get built for only the gaps, and you get a schedule for the
          time remaining. No re-reading marathons.
        </p>
      </div>

      {!plan ? (
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '20px',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 220px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                What exam?
              </label>
              <input
                type="text"
                value={examName}
                onChange={(e) => setExamName(e.target.value)}
                placeholder="e.g. Bio 101 midterm"
                style={inputStyle}
              />
            </div>
            <div style={{ flex: '1 1 220px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
                When is it?
              </label>
              <input
                type="datetime-local"
                value={examAt}
                onChange={(e) => setExamAt(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '13px', color: 'rgba(255,255,255,0.6)', marginBottom: '6px' }}>
              Your notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Paste everything you need to know…"
              style={{ ...inputStyle, minHeight: '260px', resize: 'vertical', lineHeight: 1.6 }}
            />
            <div style={{
              fontSize: '12px',
              marginTop: '6px',
              color: notesShortBy > 0 ? '#f87171' : '#34d399',
            }}>
              {notesShortBy > 0
                ? `Add at least ${notesShortBy} more characters so the AI has something to work with`
                : `${notes.trim().length.toLocaleString()} characters — ready`}
            </div>
          </div>

          {hoursLeft !== null && hoursLeft > 0 && (
            <div style={{ fontSize: '14px', color: '#fbbf24', fontWeight: 600 }}>
              ⏳ {hoursLeft < 48
                ? `${Math.round(hoursLeft)} hour${Math.round(hoursLeft) === 1 ? '' : 's'} until the exam`
                : `${Math.round(hoursLeft / 24)} days until the exam`}
            </div>
          )}

          <button
            onClick={handleBuildPlan}
            disabled={isStarting}
            style={{
              padding: '16px 24px',
              background: isStarting ? 'rgba(239, 68, 68, 0.4)' : 'linear-gradient(90deg, #ef4444, #f97316)',
              border: 'none',
              borderRadius: '14px',
              color: '#ffffff',
              fontSize: '17px',
              fontWeight: 700,
              cursor: isStarting ? 'wait' : 'pointer',
              boxShadow: '0 4px 24px rgba(239, 68, 68, 0.35)',
            }}
          >
            {isStarting ? 'Building your triage plan…' : 'Build my triage plan'}
          </button>
        </div>
      ) : (
        <div style={{
          backgroundColor: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          borderRadius: '20px',
          padding: '28px',
        }}>
          <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#ffffff', marginBottom: '20px' }}>
            Your plan for the next {hoursLeft < 48 ? `${Math.round(hoursLeft)} hours` : `${Math.round(hoursLeft / 24)} days`}
          </h2>
          <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {plan.map((step, i) => (
              <li key={i} style={{
                display: 'flex',
                gap: '16px',
                padding: '14px 18px',
                backgroundColor: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '12px',
              }}>
                <div style={{ minWidth: '110px', fontSize: '13px', fontWeight: 700, color: '#f97316' }}>
                  {step.when}
                </div>
                <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
                  {step.what}
                </div>
              </li>
            ))}
          </ol>
          <button
            onClick={startRecall}
            style={{
              width: '100%',
              padding: '16px 24px',
              background: 'linear-gradient(90deg, #ef4444, #f97316)',
              border: 'none',
              borderRadius: '14px',
              color: '#ffffff',
              fontSize: '17px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 24px rgba(239, 68, 68, 0.35)',
            }}
          >
            Step 1: Start the recall test →
          </button>
        </div>
      )}
    </div>
  );
};

export default PanicMode;

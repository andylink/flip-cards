'use client';

import { useMemo, useState } from 'react';
import { AnswerWidget, ScoreHUD, SessionSummary, TestCardPreview } from '@/components/Play';
import { useSessionStore } from '@/lib/store/sessionStore';
import { evaluateAnswer } from '@/lib/utils/answerEvaluation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/Common/Button';
import { AnswerType, CanvasState } from '@/lib/types/domain';

type CardWithAnswer = {
  id: string;
  title: string;
  canvas_json: CanvasState;
  answers: { type: AnswerType; schema_json: unknown }[];
};

type Props = {
  setId: string;
  setTitle: string;
  initialCards: CardWithAnswer[];
  userId: string | null;
};

const scoreMap: Record<'again' | 'hard' | 'good' | 'easy', number> = {
  again: 0,
  hard: 1,
  good: 2,
  easy: 3
};

export function PlayClient({ setId, setTitle, initialCards, userId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [cards] = useState(() => [...initialCards].sort(() => Math.random() - 0.5));
  const [index, setIndex] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string>('');
  const [pending, setPending] = useState<{ cardId: string; response: unknown; correct: boolean } | null>(null);

  const score = useSessionStore((state) => state.score);
  const streak = useSessionStore((state) => state.streak);
  const correctCount = useSessionStore((state) => state.correctCount);
  const totalAnswered = useSessionStore((state) => state.totalAnswered);
  const registerAttempt = useSessionStore((state) => state.registerAttempt);
  const beginSession = useSessionStore((state) => state.beginSession);
  const revealEnabled = useSessionStore((state) => state.revealEnabled);

  const current = cards[index];

  const ensureSession = async () => {
    if (sessionId) return sessionId;
    const { data, error } = await supabase
      .from('play_sessions')
      .insert({ user_id: userId, set_id: setId, mode: 'practice', settings_json: { randomized: true } })
      .select('id')
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Could not create session');
    }

    setSessionId(data.id);
    beginSession(data.id);
    return data.id;
  };

  const completeAttempt = async (confidence: keyof typeof scoreMap) => {
    if (!pending) return;

    const activeSessionId = await ensureSession();
    const scoreDelta = scoreMap[confidence] + (pending.correct ? 1 : 0);

    await supabase.from('attempts').insert({
      session_id: activeSessionId,
      card_id: pending.cardId,
      response_json: pending.response,
      correct: pending.correct,
      score_delta: scoreDelta,
      elapsed_ms: 0
    });

    registerAttempt(pending.correct, scoreDelta);
    setFeedback(pending.correct ? 'Correct!' : 'Incorrect');
    setPending(null);

    if (index < cards.length - 1) {
      setIndex((value) => value + 1);
    }
  };

  if (cards.length === 0) {
    return <p>No cards found for this set.</p>;
  }

  if (index >= cards.length) {
    return (
      <SessionSummary
        score={score}
        totalAnswered={totalAnswered}
        correctCount={correctCount}
        onRestart={() => window.location.reload()}
      />
    );
  }

  const answer = current.answers[0];
  if (!answer) {
    return <p>Card has no answer schema configured.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Test View · {setTitle}</h1>
      <ScoreHUD score={score} streak={streak} answered={totalAnswered} total={cards.length} />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,1fr)]">
        <section className="rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="mb-3 text-lg font-semibold">Card</h2>
          <TestCardPreview canvas={current.canvas_json} />
        </section>

        <section className="space-y-4 rounded-md border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-lg font-semibold">Answer</h2>
          <AnswerWidget
            answerType={answer.type}
            schemaJson={answer.schema_json}
            onSubmit={(response) => {
              const correct = evaluateAnswer(answer.type, answer.schema_json, response);
              setPending({ cardId: current.id, response, correct });
              setFeedback(correct ? 'Correct!' : 'Incorrect');
            }}
          />
          {revealEnabled ? <p className="text-sm text-slate-600 dark:text-slate-300">{feedback}</p> : null}
          <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <Button onClick={() => completeAttempt('again')} variant="secondary" disabled={!pending}>
              Again
            </Button>
            <Button onClick={() => completeAttempt('hard')} variant="secondary" disabled={!pending}>
              Hard
            </Button>
            <Button onClick={() => completeAttempt('good')} disabled={!pending}>
              Good
            </Button>
            <Button onClick={() => completeAttempt('easy')} disabled={!pending}>
              Easy
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}

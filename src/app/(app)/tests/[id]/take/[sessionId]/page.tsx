import { createClient } from '@/utils/supabase/server'
import { notFound, redirect } from 'next/navigation'
import TestTaker from '@/components/TestTaker'

export default async function TakeTestPage({
  params
}: {
  params: Promise<{ id: string, sessionId: string }>
}) {
  const resolvedParams = await params
  const { id: testId, sessionId } = resolvedParams
  const supabase = await createClient()

  // 1. Fetch Session
  const { data: session, error: sessionErr } = await supabase
    .from('test_sessions')
    .select('id, test_id, started_at, finished_at')
    .eq('id', sessionId)
    .single()

  if (sessionErr || !session) notFound()
  if (session.test_id !== testId) notFound()
  if (session.finished_at) {
    redirect(`/results/${sessionId}`)
  }

  // 2. Fetch Test details (for time limit)
  const { data: test, error: testErr } = await supabase
    .from('tests')
    .select('time_limit_minutes')
    .eq('id', testId)
    .single()

  if (testErr || !test) notFound()

  // 3. Fetch questions pre-selected for this session
  const { data: sessionAnswers, error: saErr } = await supabase
    .from('session_answers')
    .select(`
      question_id,
      selected_option_ids,
      questions (
        id, question_text, type,
        options ( label, option_text )
      )
    `)
    .eq('session_id', sessionId)

  if (saErr || !sessionAnswers || sessionAnswers.length === 0) {
    return <div>Error loading questions for this session.</div>
  }

  type QuestionDef = {
    id: string
    question_text: string
    type: 'radio' | 'checkbox'
    options: { label: string; option_text: string }[]
  }

  // Re-map questions, stripping is_correct for client security
  const questionsList = sessionAnswers.map(sa => {
    const qdef = sa.questions as unknown as QuestionDef
    return {
      id: qdef.id,
      text: qdef.question_text,
      type: qdef.type,
      options: qdef.options.map(opt => ({ label: opt.label, text: opt.option_text }))
    }
  })

  // Pre-load any saved answers
  const initialAnswers: Record<string, string[]> = {}
  sessionAnswers.forEach(sa => {
    if (sa.selected_option_ids && sa.selected_option_ids.length > 0) {
      initialAnswers[sa.question_id] = sa.selected_option_ids
    }
  })

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <TestTaker
        testId={testId}
        sessionId={sessionId}
        timeLimit={test.time_limit_minutes}
        startedAt={session.started_at}
        questions={questionsList}
        initialAnswers={initialAnswers}
      />
    </div>
  )
}

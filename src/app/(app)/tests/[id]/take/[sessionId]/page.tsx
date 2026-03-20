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
    .select('id, test_id, started_at, completed_at')
    .eq('id', sessionId)
    .single()

  if (sessionErr || !session) notFound()
  if (session.test_id !== testId) notFound()
  if (session.completed_at) {
    redirect(`/results/${sessionId}`)
  }

  // 2. Fetch Test details (for time limit)
  const { data: test, error: testErr } = await supabase
    .from('tests')
    .select('time_limit')
    .eq('id', testId)
    .single()

  if (testErr || !test) notFound()

  // 3. Fetch questions pre-selected for this session
  const { data: sessionAnswers, error: saErr } = await supabase
    .from('session_answers')
    .select(`
      question_id,
      selected_options,
      questions (
        id, text, type,
        options ( label, text )
      )
    `)
    .eq('session_id', sessionId)

  if (saErr || !sessionAnswers || sessionAnswers.length === 0) {
    return <div>Error loading questions for this session.</div>
  }

  // Re-map questions
  const questionsList = sessionAnswers.map(sa => {
    const qdef = sa.questions as any
    // remove is_correct flags inside the client rendering payload for security
    const sanitizedOptions = qdef.options.map((opt: any) => ({
      label: opt.label,
      text: opt.text
    }))
    return {
      id: qdef.id,
      text: qdef.text,
      type: qdef.type,
      options: sanitizedOptions
    }
  })

  // Pre-load answers
  const initialAnswers: Record<string, string[]> = {}
  sessionAnswers.forEach(sa => {
    if (sa.selected_options && sa.selected_options.length > 0) {
      initialAnswers[sa.question_id] = sa.selected_options
    }
  })

  return (
    <div className="bg-gray-50 min-h-screen py-8">
      <TestTaker 
        testId={testId}
        sessionId={sessionId}
        timeLimit={test.time_limit}
        startedAt={session.started_at}
        questions={questionsList}
        initialAnswers={initialAnswers}
      />
    </div>
  )
}

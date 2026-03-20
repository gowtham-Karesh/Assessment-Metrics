'use server'

import { createClient } from '@/utils/supabase/server'
import { redirect } from 'next/navigation'

export async function startTestSession(testId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Create a new session
  const { data: session, error: sessionErr } = await supabase
    .from('test_sessions')
    .insert({ test_id: testId, user_id: user.id })
    .select('id')
    .single()

  if (sessionErr || !session) throw new Error('Failed to start session')

  // Pick 8 random questions for this test
  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select('id')
    .eq('test_id', testId)

  if (qErr || !questions) throw new Error('Error fetching questions')

  // Fisher-Yates shuffle for unbiased random selection
  const shuffled = [...questions]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  const selectedQuestions = shuffled.slice(0, 8)

  if (selectedQuestions.length > 0) {
    const answersToInsert = selectedQuestions.map(q => ({
      session_id: session.id,
      question_id: q.id,
      selected_option_ids: []
    }))
    const { error: insertErr } = await supabase.from('session_answers').insert(answersToInsert)
    if (insertErr) throw new Error('Failed to create session answers')
  }

  redirect(`/tests/${testId}/take/${session.id}`)
}

export async function submitTestSession(
  sessionId: string,
  testId: string,
  answers: Record<string, string[]> // question_id -> array of selected option labels (A, B, C)
) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  // Fetch the session and verify it belongs to the current user and isn't already completed
  const { data: sessionData, error: sessionFetchErr } = await supabase
    .from('test_sessions')
    .select('finished_at, user_id')
    .eq('id', sessionId)
    .single()

  if (sessionFetchErr || !sessionData) throw new Error('Session not found')
  if (sessionData.user_id !== user.id) throw new Error('Unauthorized')
  if (sessionData.finished_at) return { error: 'Test already submitted' }

  // Fetch questions for this session to score them
  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select(`
      id,
      options ( label, is_correct )
    `)
    .eq('test_id', testId)

  if (qErr || !questions) throw new Error('Error fetching questions for scoring')

  let score = 0
  const totalQuestions = Object.keys(answers).length

  for (const [qId, selectedLabels] of Object.entries(answers)) {
    const questionDef = questions.find(q => q.id === qId)
    if (!questionDef) continue

    const correctLabels = (questionDef.options as { label: string; is_correct: boolean }[])
      .filter(opt => opt.is_correct)
      .map(opt => opt.label)

    const isTotallyCorrect =
      selectedLabels.length === correctLabels.length &&
      selectedLabels.every(l => correctLabels.includes(l)) &&
      correctLabels.every(l => selectedLabels.includes(l))

    if (isTotallyCorrect) score += 1
  }

  // Save selected answers BEFORE marking finished_at
  // (RLS policy on session_answers requires finished_at IS NULL)
  for (const [qId, selectedLabels] of Object.entries(answers)) {
    await supabase
      .from('session_answers')
      .update({ selected_option_ids: selectedLabels })
      .match({ session_id: sessionId, question_id: qId })
  }

  // Now mark session as complete
  const { error: updateErr } = await supabase
    .from('test_sessions')
    .update({
      score,
      status: 'submitted',
      finished_at: new Date().toISOString()
    })
    .eq('id', sessionId)

  if (updateErr) throw new Error('Failed to save score')

  // Compute pass/fail (70% threshold)
  const passed = totalQuestions > 0 && score / totalQuestions >= 0.7

  return { success: true, sessionId, passed }
}

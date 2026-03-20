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

  // Shuffle and pick 8
  const shuffled = questions.sort(() => 0.5 - Math.random())
  const selectedQuestions = shuffled.slice(0, 8)

  if (selectedQuestions.length > 0) {
    const answersToInsert = selectedQuestions.map(q => ({
      session_id: session.id,
      question_id: q.id,
      selected_options: []
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

  // Fetch the session to ensure it belongs to the user and isn't already completed
  const { data: sessionData, error: sessionFetchErr } = await supabase
    .from('test_sessions')
    .select('completed_at')
    .eq('id', sessionId)
    .single()

  if (sessionFetchErr || !sessionData) throw new Error('Session not found')
  if (sessionData.completed_at) return { error: 'Test already submitted' }

  // Fetch questions for this test to score them
  const { data: questions, error: qErr } = await supabase
    .from('questions')
    .select(`
      id,
      options ( label, is_correct )
    `)
    .eq('test_id', testId)

  if (qErr || !questions) throw new Error('Error fetching questions for scoring')

  let score = 0
  const totalQuestionsAnswered = Object.keys(answers).length // assuming exactly 8 questions

  // Determine score: out of 8 strictly matched answers
  // Each answer in `answers` is checked against `questions`
  for (const [qId, selectedLabels] of Object.entries(answers)) {
    const questionDef = questions.find(q => q.id === qId)
    if (!questionDef) continue

    const correctLabels = questionDef.options
      .filter((opt: any) => opt.is_correct)
      .map((opt: any) => opt.label)

    // Check if lengths match and every selected label is correct (and vice versa)
    const isTotallyCorrect =
      selectedLabels.length === correctLabels.length &&
      selectedLabels.every(l => correctLabels.includes(l)) &&
      correctLabels.every(l => selectedLabels.includes(l))

    if (isTotallyCorrect) {
      score += 1
    }
  }

  // Passing is 70% of 8 = 5.6 -> 6 questions
  const passThreshold = 8 * 0.7 // 5.6
  const passed = score >= passThreshold

  // Update session
  const { error: updateErr } = await supabase
    .from('test_sessions')
    .update({ 
      score, 
      passed, 
      completed_at: new Date().toISOString() 
    })
    .eq('id', sessionId)

  if (updateErr) throw new Error('Failed to save score')

  // Save session answers by updating existing rows
  for (const [qId, selectedLabels] of Object.entries(answers)) {
    await supabase
      .from('session_answers')
      .update({ selected_options: selectedLabels })
      .match({ session_id: sessionId, question_id: qId })
  }

  return { success: true, sessionId }
}

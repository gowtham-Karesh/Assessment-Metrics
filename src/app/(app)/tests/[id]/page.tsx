import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { startTestSession } from '../actions'

export default async function TestDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const resolvedParams = await params
  const { id } = resolvedParams
  const supabase = await createClient()

  // Fetch test details, including the creator's email
  const { data: test, error } = await supabase
    .from('tests')
    .select(`
      id, title, time_limit, created_at,
      profiles ( email ),
      questions ( count )
    `)
    .eq('id', id)
    .single()

  if (error || !test) {
    notFound()
  }

  const profiles = test.profiles as unknown as { email: string }
  const questionsList = test.questions as unknown as any[]
  // Typecasting the count response
  const questionCount = questionsList?.[0]?.count || questionsList?.length || 0

  return (
    <div className="mx-auto max-w-2xl overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-5">
        <h1 className="text-2xl font-bold text-gray-900">{test.title}</h1>
        <p className="mt-1 text-sm text-gray-500">
          Created by {profiles?.email || 'Unknown'}
        </p>
      </div>
      
      <div className="px-6 py-6">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">Time Limit</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">{test.time_limit} Minutes</dd>
          </div>
          <div className="sm:col-span-1">
            <dt className="text-sm font-medium text-gray-500">Total Questions Pool</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">
              {Array.isArray(test.questions) ? test.questions.length : questionCount} Questions
            </dd>
          </div>
          <div className="sm:col-span-2 mt-4 rounded-md bg-indigo-50 p-4">
            <h3 className="text-sm font-medium text-indigo-800">Test Rules</h3>
            <ul className="mt-2 list-inside list-disc text-sm text-indigo-700">
              <li>You will receive 8 random questions from this test.</li>
              <li>You must score at least 70% to pass.</li>
              <li>The timer starts as soon as you click &quot;Start Test&quot;.</li>
              <li>The test will auto-submit when the timer runs out.</li>
            </ul>
          </div>
        </dl>

        <div className="mt-8 flex items-center gap-4">
          <form action={async () => {
            'use server'
            await startTestSession(id)
          }} className="w-full">
            <button
              type="submit"
              className="flex w-full items-center justify-center rounded-md border border-transparent bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Start Test Now
            </button>
          </form>
          <Link
            href="/dashboard"
            className="flex w-full items-center justify-center rounded-md border border-gray-300 bg-white px-6 py-3 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

import { createClient } from '@/utils/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/')
  }

  // Fetch all tests along with author profile
  const { data: myTests } = await supabase
    .from('tests')
    .select('id, title, time_limit, created_at')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })

  const { data: otherTests } = await supabase
    .from('tests')
    .select(`
      id, 
      title, 
      time_limit, 
      created_at,
      profiles ( email )
    `)
    .neq('created_by', user.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between border-b pb-4">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <Link
          href="/tests/create"
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Create New Test
        </Link>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-800">My Created Tests</h2>
        {myTests && myTests.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {myTests.map((test) => (
              <div key={test.id} className="rounded-lg border bg-white p-6 shadow-sm">
                <h3 className="text-lg font-medium text-gray-900">{test.title}</h3>
                <p className="mt-2 text-sm text-gray-500">{test.time_limit} min limit</p>
                <div className="mt-4">
                  <Link
                    href={`/tests/${test.id}`}
                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                  >
                    View details &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">You haven&apos;t created any tests yet.</p>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold text-gray-800">Available Tests from Others</h2>
        {otherTests && otherTests.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherTests.map((test) => (
              <div key={test.id} className="rounded-lg border bg-white p-6 shadow-sm">
                <h3 className="text-lg font-medium text-gray-900">{test.title}</h3>
                <p className="mt-1 text-sm text-gray-500">
                  By: {(test.profiles as unknown as { email: string })?.email || 'Unknown'}
                </p>
                <p className="mt-2 text-sm text-gray-500">{test.time_limit} min limit</p>
                <div className="mt-4">
                  <Link
                    href={`/tests/${test.id}`}
                    className="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
                  >
                    View details &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No tests available from other users.</p>
        )}
      </div>
    </div>
  )
}

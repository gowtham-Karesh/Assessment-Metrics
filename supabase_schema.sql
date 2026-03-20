-- Execute this script in your Supabase SQL Editor

-- 1. Create Profiles Table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'user'::text,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile."
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Create Tests Table
CREATE TABLE public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  time_limit INTEGER NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tests are viewable by everyone."
  ON public.tests FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create tests."
  ON public.tests FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own tests."
  ON public.tests FOR UPDATE TO authenticated USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own tests."
  ON public.tests FOR DELETE TO authenticated USING (auth.uid() = created_by);

-- 3. Create Questions Table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
  text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('radio', 'checkbox')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Questions are viewable by everyone."
  ON public.questions FOR SELECT USING (true);

CREATE POLICY "Test creators can insert questions."
  ON public.questions FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.tests WHERE tests.id = test_id AND tests.created_by = auth.uid())
  );

CREATE POLICY "Test creators can update questions."
  ON public.questions FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tests WHERE tests.id = test_id AND tests.created_by = auth.uid())
  );

CREATE POLICY "Test creators can delete questions."
  ON public.questions FOR DELETE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.tests WHERE tests.id = test_id AND tests.created_by = auth.uid())
  );

-- 4. Create Options Table
CREATE TABLE public.options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  label TEXT NOT NULL,
  text TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE public.options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Options are viewable by everyone."
  ON public.options FOR SELECT USING (true);

CREATE POLICY "Test creators can insert options."
  ON public.options FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.questions q
      JOIN public.tests t ON q.test_id = t.id
      WHERE q.id = question_id AND t.created_by = auth.uid()
    )
  );

-- 5. Create Test Sessions Table
CREATE TABLE public.test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  score INTEGER,
  passed BOOLEAN,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own test sessions."
  ON public.test_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own test sessions."
  ON public.test_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own test sessions."
  ON public.test_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 6. Create Session Answers Table
CREATE TABLE public.session_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES public.test_sessions(id) ON DELETE CASCADE NOT NULL,
  question_id UUID REFERENCES public.questions(id) ON DELETE CASCADE NOT NULL,
  selected_options TEXT[] NOT NULL
);

ALTER TABLE public.session_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own session answers."
  ON public.session_answers FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.test_sessions s WHERE s.id = session_id AND s.user_id = auth.uid())
  );

CREATE POLICY "Users can insert answers for their active session."
  ON public.session_answers FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.test_sessions s WHERE s.id = session_id AND s.user_id = auth.uid() AND s.completed_at IS NULL)
  );

-- 7. Trigger to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'user');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

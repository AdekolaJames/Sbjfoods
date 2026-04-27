-- Allow anonymous (public) shop visitors to read the list of active branches.
DROP POLICY IF EXISTS "Public can view active branches" ON public.branches;
CREATE POLICY "Public can view active branches"
  ON public.branches FOR SELECT
  TO anon
  USING (is_active = true);
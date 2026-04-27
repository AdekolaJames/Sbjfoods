
-- 1) Staff branch assignments table
CREATE TABLE public.staff_branch_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, branch_id)
);

ALTER TABLE public.staff_branch_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all assignments"
  ON public.staff_branch_assignments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view own assignments"
  ON public.staff_branch_assignments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Branch managers view branch assignments"
  ON public.staff_branch_assignments FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'branch_manager'::app_role) AND branch_id = public.get_user_branch(auth.uid()));

-- 2) Customers table
CREATE TABLE public.customers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone text NOT NULL,
  address text,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_customers_phone_branch ON public.customers(phone, branch_id);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view branch customers"
  ON public.customers FOR SELECT
  TO authenticated
  USING (branch_id = public.get_user_branch(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff create customers"
  ON public.customers FOR INSERT
  TO authenticated
  WITH CHECK (branch_id = public.get_user_branch(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage all customers"
  ON public.customers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Menu images storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images', 'menu-images', true);

CREATE POLICY "Anyone can view menu images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

CREATE POLICY "Authenticated users can upload menu images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'menu-images');

CREATE POLICY "Authenticated users can update menu images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'menu-images');

CREATE POLICY "Authenticated users can delete menu images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'menu-images');

-- 4) Function to get all branches for a user (multi-branch)
CREATE OR REPLACE FUNCTION public.get_user_branches(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.staff_branch_assignments
  WHERE user_id = _user_id
$$;

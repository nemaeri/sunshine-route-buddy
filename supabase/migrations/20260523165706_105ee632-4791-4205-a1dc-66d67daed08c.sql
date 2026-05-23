
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_parent_of(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.teaches_student(uuid, uuid) TO anon, authenticated;

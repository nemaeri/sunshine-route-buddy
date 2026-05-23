
ALTER VIEW public.leave_balances SET (security_invoker = true);
REVOKE EXECUTE ON FUNCTION public.enforce_leave_balance() FROM anon, authenticated, public;

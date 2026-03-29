
grant execute on function public.set_my_pin(text, text) to authenticated;
grant execute on function public.verify_my_pin(text) to authenticated;
grant execute on function public.my_pin_is_configured() to authenticated;

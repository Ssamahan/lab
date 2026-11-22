-- Preparation only: this catalog is a narrow staff-only projection, not the
-- complete register and not a replacement for the existing anonymous policies.
-- Unknown fields and nested records are omitted rather than guessed safe.
create or replace function public.lab_project_staff_rows(p_rows jsonb,p_fields text[],p_include_attendees boolean)
returns jsonb language sql immutable set search_path = '' as $$
  select coalesce(jsonb_agg(
    coalesce((select jsonb_object_agg(f.key,f.value) from jsonb_each(r.value) f
      where f.key=any(p_fields) and jsonb_typeof(f.value) in ('string','number','boolean')),'{}'::jsonb)
    || case when p_include_attendees and jsonb_typeof(r.value->'attendees')='array' then
      jsonb_build_object('attendees',coalesce((select jsonb_agg(a.value)
        from jsonb_array_elements(r.value->'attendees') a where jsonb_typeof(a.value)='string'),'[]'::jsonb))
      else '{}'::jsonb end
  ),'[]'::jsonb)
  from jsonb_array_elements(case when jsonb_typeof(p_rows)='array' then p_rows else '[]'::jsonb end) r
  where jsonb_typeof(r.value)='object';
$$;
revoke all on function public.lab_project_staff_rows(jsonb,text[],boolean) from public, anon, authenticated;

-- Individual account membership is checked by the database for every read.
-- This deliberately excludes revenue, security, settings, samples and arbitrary
-- notes, even if those sections or unexpected fields appear in the source.
create or replace function public.lab_staff_read_catalog()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_data jsonb;
  v_revision bigint;
  v_updated_at timestamptz;
begin
  if public.lab_my_access_role() is null then
    raise exception 'not authorized' using errcode='42501';
  end if;
  select r.data,r.revision,r.updated_at into v_data,v_revision,v_updated_at
    from public.lab_registers r where r.id='ruli-dh';
  if not found then raise exception 'register not found' using errcode='P0002'; end if;
  return jsonb_build_object('revision',v_revision,'updated_at',v_updated_at,'data',jsonb_build_object(
    'staff',public.lab_project_staff_rows(v_data->'staff',array['id','name','role','status','post','phone','email'],false),
    'trainings',public.lab_project_staff_rows(v_data->'trainings',array['id','title','start','end','organizer','fundingPartner','location','facilityName','facilityType','status','certificate','certificateGiven'],true),
    'equipment',public.lab_project_staff_rows(v_data->'equipment',array['id','name','model','location','status','uptime','nextPM','lastPM','serial','manufacturer','pmIntervalDays','role'],false)
  ));
end $$;
revoke all on function public.lab_staff_read_catalog() from public, anon;
grant execute on function public.lab_staff_read_catalog() to authenticated;

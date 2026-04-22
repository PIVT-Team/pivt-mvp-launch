create extension if not exists pgmq;

create table if not exists public.job_status (
  id uuid primary key default gen_random_uuid(),
  queue_name text not null,
  deal_id uuid references public.deals(id),
  job_type text not null,
  status text not null default 'queued',
  attempts int not null default 0,
  max_attempts int not null default 3,
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  queued_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  next_retry_at timestamptz,
  constraint job_status_status_check check (status in ('queued', 'processing', 'completed', 'failed'))
);

create index if not exists idx_job_status_queue_status on public.job_status(queue_name, status);
create index if not exists idx_job_status_deal_id on public.job_status(deal_id);
create index if not exists idx_job_status_next_retry_at on public.job_status(next_retry_at);
create index if not exists idx_job_status_queued_at on public.job_status(queued_at desc);

alter table public.job_status enable row level security;

create policy "Users can view jobs for accessible deals"
on public.job_status
for select
to authenticated
using (
  deal_id is not null and public.is_deal_accessible(auth.uid(), deal_id)
);

create or replace function public.ensure_pgmq_queue_exists(p_queue_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pgmq.create(p_queue_name);
exception
  when duplicate_table or duplicate_object then
    null;
end;
$$;

create or replace function public.enqueue_job_status(
  p_queue_name text,
  p_deal_id uuid,
  p_job_type text,
  p_payload jsonb default '{}'::jsonb,
  p_max_attempts int default 3
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id uuid;
  v_payload jsonb;
begin
  if p_queue_name is null or btrim(p_queue_name) = '' then
    raise exception 'queue_name is required';
  end if;

  if p_job_type is null or btrim(p_job_type) = '' then
    raise exception 'job_type is required';
  end if;

  perform public.ensure_pgmq_queue_exists(p_queue_name);

  insert into public.job_status (
    queue_name,
    deal_id,
    job_type,
    status,
    attempts,
    max_attempts,
    payload,
    next_retry_at
  ) values (
    p_queue_name,
    p_deal_id,
    p_job_type,
    'queued',
    0,
    greatest(coalesce(p_max_attempts, 3), 1),
    coalesce(p_payload, '{}'::jsonb),
    now()
  )
  returning id into v_job_id;

  v_payload := coalesce(p_payload, '{}'::jsonb) || jsonb_build_object(
    'job_status_id', v_job_id,
    'queue_name', p_queue_name,
    'job_type', p_job_type,
    'deal_id', p_deal_id
  );

  update public.job_status
  set payload = v_payload
  where id = v_job_id;

  perform pgmq.send(p_queue_name, v_payload);

  return v_job_id;
end;
$$;

create or replace function public.claim_next_job(
  p_queue_name text,
  p_visibility_timeout int default 30,
  p_qty int default 1
)
returns table (
  msg_id bigint,
  read_ct integer,
  message jsonb,
  job_status_id uuid,
  job_type text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_pgmq_queue_exists(p_queue_name);

  return query
  select
    r.msg_id,
    r.read_ct,
    r.message,
    (r.message ->> 'job_status_id')::uuid as job_status_id,
    (r.message ->> 'job_type') as job_type
  from pgmq.read(p_queue_name, p_visibility_timeout, p_qty) as r;
end;
$$;

create or replace function public.ack_job_message(
  p_queue_name text,
  p_msg_id bigint
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return pgmq.delete(p_queue_name, p_msg_id);
end;
$$;

create or replace function public.start_job_processing(
  p_job_status_id uuid
)
returns public.job_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.job_status;
begin
  update public.job_status
  set
    status = 'processing',
    attempts = attempts + 1,
    started_at = now(),
    error = null
  where id = p_job_status_id
    and status in ('queued', 'processing')
    and (next_retry_at is null or next_retry_at <= now())
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.complete_job_processing(
  p_job_status_id uuid,
  p_result jsonb default '{}'::jsonb
)
returns public.job_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.job_status;
begin
  update public.job_status
  set
    status = 'completed',
    result = coalesce(p_result, '{}'::jsonb),
    error = null,
    completed_at = now(),
    next_retry_at = null
  where id = p_job_status_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.fail_job_processing(
  p_job_status_id uuid,
  p_error text,
  p_retry_delay_minutes int default null
)
returns public.job_status
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.job_status;
begin
  update public.job_status
  set
    status = case
      when attempts < max_attempts then 'queued'
      else 'failed'
    end,
    error = p_error,
    completed_at = case
      when attempts < max_attempts then null
      else now()
    end,
    next_retry_at = case
      when attempts < max_attempts then now() + make_interval(mins => greatest(coalesce(p_retry_delay_minutes, 1), 1))
      else null
    end
  where id = p_job_status_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.get_job_status(p_job_status_id uuid)
returns public.job_status
language sql
security definer
set search_path = public
as $$
  select *
  from public.job_status
  where id = p_job_status_id
$$;

do $$
begin
  perform public.ensure_pgmq_queue_exists('deal_graph_builds');
  perform public.ensure_pgmq_queue_exists('document_ai_extraction');
  perform public.ensure_pgmq_queue_exists('discrepancy_sweeps');
  perform public.ensure_pgmq_queue_exists('email_notifications');
  perform public.ensure_pgmq_queue_exists('audit_chain_updates');
end;
$$;
ALTER TABLE public.staging_jobs ADD COLUMN IF NOT EXISTS instantdeco_request_id text;
ALTER TABLE public.staging_jobs ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX IF NOT EXISTS staging_jobs_instantdeco_request_id_idx ON public.staging_jobs(instantdeco_request_id);
DROP TRIGGER IF EXISTS staging_jobs_set_updated_at ON public.staging_jobs;
CREATE TRIGGER staging_jobs_set_updated_at BEFORE UPDATE ON public.staging_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
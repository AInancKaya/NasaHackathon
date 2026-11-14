<!-- AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant. Reviewed and directed by the project author. -->
# Deploying TerraVestige

TerraVestige runs as one Docker container: the FastAPI backend serves the built React app from
`frontend/dist` on port 7860. The same image runs locally and on Google Cloud Run.

## 1. Local check (Docker)

```bash
docker build -t terravestige .
docker run --rm -p 7860:7860 terravestige
```

In a second terminal:

```bash
curl -s http://localhost:7860/api/variables | head -c 300
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7860/
```

Open http://localhost:7860/ in a browser. The first trend-map request takes about 30 s and peaks
at about 300 MB of RAM (it fetches live NASA POWER data).

## 2. Deploy to Google Cloud Run (user step)

Done by the project author in Google Cloud Shell or a local `gcloud` install. Claude does not
enter credentials or payment details.

1. Create a project, link a billing account, and enable the APIs:

   ```bash
   gcloud config set project <PROJECT_ID>
   gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com
   ```

2. Deploy from the folder that holds the Dockerfile. The container listens on 7860, so set `--port`:

   ```bash
   gcloud run deploy trend-detective --source . --region europe-west1 --port 7860 --memory 1Gi --allow-unauthenticated --min-instances 1 --cpu-boost
   ```

   `--min-instances 1` keeps one instance running, so no visitor waits for a cold start (about 12 s);
   it is billed while idle. Leave it out to scale to zero and rely on the keep-alive below.

3. The command prints a `Service URL`. Check it: `<service-url>/api/variables` must return HTTP 200.

The container runs as uid 1000, and `/app/cache` is owned by that user. Cloud Run's disk is not
persistent, so the image build fills the cache from the live sources (trend maps and case tours; it adds
several minutes to the build). A new instance starts with that cache; anything else is fetched live.

### Custom domain (optional)

Map a subdomain to the service, then add the DNS record the command prints at the DNS host:

```bash
gcloud domains verify <root-domain>
gcloud beta run domain-mappings create --service trend-detective --domain <subdomain.root-domain> --region europe-west1
gcloud beta run domain-mappings describe --domain <subdomain.root-domain> --region europe-west1
```

The certificate is issued automatically after the DNS record resolves. Check with
`--format='value(status.conditions)'`; it is ready when `CertificateProvisioned` is `True`.

## 3. Keep-alive

`.github/workflows/keep-alive.yml` pings `/api/variables` every 10 minutes, so an instance that may scale to zero stays up.

1. In GitHub: **Settings → Secrets and variables → Actions → Variables → New repository variable**.
2. Name: `APP_URL`. Value: the public app URL, e.g. `https://app.terravestige.earth` (no trailing path).
3. Run it once from **Actions → keep-alive → Run workflow** to confirm it returns `HTTP 200`.

## 4. FortiGuard reclassification (user step, after the app URL is live)

Some school and corporate networks block TerraVestige because FortiGuard has it in the wrong
category. Ask FortiGuard to re-rate the site. Claude does not submit this form.

1. Check the current rating at https://www.fortiguard.com/webfilter (enter the app URL).
2. Open the rating-submission form (FAQ and form: https://www.fortiguard.com/faq/wfratingsubmit).
   Verify the form URL in the browser before you use it.
3. Enter the app URL, suggest a category that fits an educational or science site
   (for example *Education* or *Science and Technology*), and add a short description.
   Use your own name and email only in the form, not in this repository.
4. Submit, then note the date. Reviews can take several days. Re-check the rating at the lookup page.

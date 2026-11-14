<!-- AI disclosure: this file was written with assistance from Claude (Anthropic), an AI coding assistant. Reviewed and directed by the project author. -->
# Deploying AeroVestige

AeroVestige runs as one Docker container: the FastAPI backend serves the built React app from
`frontend/dist` on port 7860. The same image runs locally and on a Hugging Face Space.

## 1. Local check (Docker)

```bash
docker build -t aerovestige .
docker run --rm -p 7860:7860 aerovestige
```

In a second terminal:

```bash
curl -s http://localhost:7860/api/variables | head -c 300
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:7860/
```

Open http://localhost:7860/ in a browser. The first trend-map request takes about 30 s and peaks
at about 300 MB of RAM (it fetches live NASA POWER data).

## 2. Create the Hugging Face Space (user step)

Done by the project author. No token is entered by Claude.

1. Log in at https://huggingface.co and create a new Space: **Docker** SDK, **Public**, no login.
2. In the Space repository, make sure the top of `README.md` contains this YAML front matter:

   ```yaml
   ---
   title: AeroVestige
   emoji: 🌍
   colorFrom: blue
   colorTo: green
   sdk: docker
   app_port: 7860
   pinned: false
   ---
   ```

3. Create an access token at https://huggingface.co/settings/tokens (role: *write*). Keep it private.
4. Push this repository to the Space. Replace `<owner>/<space>` and enter the token when git asks
   for a password (or let your git credential helper store it):

   ```bash
   git remote add space https://huggingface.co/spaces/<owner>/<space>
   git push space main
   ```

5. Wait for the build in the Space's **Logs** tab. When the status is *Running*, open
   `https://<owner>-<space>.hf.space/` and check `https://<owner>-<space>.hf.space/api/variables`.

The container runs as uid 1000, and `/app/cache` is owned by that user, so the disk cache works.

## 3. Keep-alive

`.github/workflows/keep-alive.yml` pings `/api/variables` every 4 hours, so the Space does not sleep.

1. In GitHub: **Settings → Secrets and variables → Actions → Variables → New repository variable**.
2. Name: `SPACE_URL`. Value: `https://<owner>-<space>.hf.space` (no trailing path).
3. Run it once from **Actions → keep-alive → Run workflow** to confirm it returns `HTTP 200`.

## 4. FortiGuard reclassification (user step, after the Space URL is live)

Some school and corporate networks block AeroVestige because FortiGuard has it in the wrong
category. Ask FortiGuard to re-rate the site. Claude does not submit this form.

1. Check the current rating at https://www.fortiguard.com/webfilter (enter the Space URL).
2. Open the rating-submission form (FAQ and form: https://www.fortiguard.com/faq/wfratingsubmit).
   Verify the form URL in the browser before you use it.
3. Enter the Space URL, suggest a category that fits an educational or science site
   (for example *Education* or *Science and Technology*), and add a short description.
   Use your own name and email only in the form, not in this repository.
4. Submit, then note the date. Reviews can take several days. Re-check the rating at the lookup page.

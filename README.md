# Developers App — Google Colab Edition

[![Open In Colab](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/drive/1VP_dsxBZvoSvCPRypuwxcEx6MB8X62Jt#scrollTo=6aa2a16b)

Runs the original Next.js 14 project on Google Colab with an automated build, 19/19 route health checks, and a public Cloudflare quick-tunnel URL.

- **GitHub Repository:** [10Swarup01/developer-s-app](https://github.com/10Swarup01/developer-s-app)
- **Google Colab Notebook:** [Developers_App_Colab.ipynb](https://colab.research.google.com/drive/1VP_dsxBZvoSvCPRypuwxcEx6MB8X62Jt#scrollTo=6aa2a16b)

---

## One-Click Run in Google Colab

1. Click the **Open in Colab** badge above or open the [Colab Notebook URL](https://colab.research.google.com/drive/1VP_dsxBZvoSvCPRypuwxcEx6MB8X62Jt#scrollTo=6aa2a16b).
2. Select **Runtime → Run all** (`Ctrl+F9`).
3. The public Cloudflare tunnel URL is printed in cell **9 · Public access** (~3–5 minutes on a fresh Colab runtime).

---

## Repository Layout

| Path | Purpose |
| :--- | :--- |
| `app/` | Original application source directory, byte-identical to `SHA256SUMS.txt` (655 verified files) |
| `Developers_App_Colab.ipynb` | Executable Colab notebook: Node.js setup, integrity verification, clean build, automated health checks, Cloudflare quick tunnel |
| `SHA256SUMS.txt` | Cryptographic integrity manifest verifying all 655 files in `app/` |
| `AGENTS.md` | Permanent instructions, project architecture, checksum maintenance, and Git push rules for AI agents |
| `MIGRATION_REPORT.md` | Detailed migration audit and route verification report |
| `publish.sh` | Git release helper script |

---

## Technical Notes

- **Supabase Integration:** Full database and authentication support with preconfigured `.env.example` and GitHub Environment CI workflow.
- **Full Integrity:** `Developers_App_Colab.ipynb` automatically executes `sha256sum -c ../SHA256SUMS.txt --quiet` inside `app/` prior to building.
- **Tunnel URL:** Public access is securely proxied through an ephemeral Cloudflare quick tunnel during runtime.

---

## Supabase Configuration & GitHub Environment

The application connects to Supabase for authentication, developer profiles, project showcase, and PostgreSQL database migrations (`app/supabase/migrations/`).

### Environment Variables
| Variable | Description | Value |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Project URL | `https://xubpvstkmckkegrkdamf.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Publishable / Anon Key | `sb_publishable_6seUOer2KLe9RXSYx8iMJQ_uJO7Cp8-` |

### Setting Up in GitHub Environment
1. Go to **Settings → Environments** on your GitHub repository.
2. Click **New environment** and create `production`.
3. Under **Environment variables**, click **Add variable**:
   - `NEXT_PUBLIC_SUPABASE_URL`: `https://xubpvstkmckkegrkdamf.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: `sb_publishable_6seUOer2KLe9RXSYx8iMJQ_uJO7Cp8-`
4. The automated GitHub Actions workflow (`.github/workflows/ci.yml`) automatically builds and validates the Next.js application using these environment variables.

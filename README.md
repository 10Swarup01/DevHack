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

- **Zero API Key Leakage:** No environment variables or external secrets are required or exposed.
- **Full Integrity:** `Developers_App_Colab.ipynb` automatically executes `sha256sum -c ../SHA256SUMS.txt --quiet` inside `app/` prior to building.
- **Tunnel URL:** Public access is securely proxied through an ephemeral Cloudflare quick tunnel during runtime.

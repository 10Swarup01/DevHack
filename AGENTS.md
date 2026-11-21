# AGENTS.md — Permanent Instructions for AI Agents & Developers

This document defines the permanent project architecture, development workflow, integrity verification guidelines, and Git synchronization rules for **Developers App**.

All AI agents and developers interacting with this repository MUST strictly follow these rules.

---

## 1. Fixed Repository Configuration

- **GitHub Repository:** `10Swarup01/DevHack`
- **GitHub URL:** [https://github.com/10Swarup01/DevHack](https://github.com/10Swarup01/DevHack)
- **Git Remote:** `origin` pointing to `https://github.com/10Swarup01/DevHack.git` (synchronized with `10Swarup01/developer-s-app.git`)
- **Primary Branch:** `main`
- **Google Colab Notebook URL:** [https://colab.research.google.com/drive/1VP_dsxBZvoSvCPRypuwxcEx6MB8X62Jt#scrollTo=6aa2a16b](https://colab.research.google.com/drive/1VP_dsxBZvoSvCPRypuwxcEx6MB8X62Jt#scrollTo=6aa2a16b)
- **Application Directory:** `app/` (Next.js 14 full-stack app)
- **Colab Notebook:** `Developers_App_Colab.ipynb`
- **Integrity Manifest:** `SHA256SUMS.txt`
- **Project Documentation:** `README.md`

---

## 2. Project Architecture Overview

```text
.
├── app/                        # Complete, standalone Next.js 14 application
│   ├── package.json            # Exact dependencies and scripts
│   ├── package-lock.json       # Deterministic dependency lockfile
│   ├── next.config.js          # Next.js configuration
│   ├── src/                    # Source code: app router, components, lib
│   │   ├── app/                # Route handlers and pages
│   │   ├── components/         # UI components (developer, organization, shared)
│   │   └── lib/                # Audio, Supabase, utilities
│   └── public/                 # Static assets, icons, media
├── Developers_App_Colab.ipynb  # Executable Colab runner (Node 20, CI, build, start, quick tunnel)
├── SHA256SUMS.txt              # Cryptographic SHA-256 hash manifest of all files in app/
├── AGENTS.md                   # Permanent AI agent rules & workflow (this file)
├── README.md                   # Repository overview and Colab launch badge
├── MIGRATION_REPORT.md         # Colab migration audit and route verification
└── publish.sh                  # Optional helper script for repository release
```

---

## 3. Core Development Rules

1. **Always Inspect First:** Thoroughly inspect existing code, directory structures, and configurations before writing or editing files.
2. **Never Rewrite from Scratch:** Always modify existing files in-place. Never replace working components with mock implementations, dummy data, or simplified versions.
3. **Preserve Architecture & Roles:** Preserve Supabase auth, database schemas, APIs, and the dual-role system (Developer Workspace vs. Organization Business Hub).
4. **Google Colab Compatibility:**
   - Every file modification inside `app/` must be 100% compatible with headless Linux environments (Ubuntu 22.04 LTS / Google Colab).
   - In Colab, the application source resides at `/content/developers-app/app`.
   - Never introduce dependencies requiring GUI desktop environments or platform-specific non-portable binaries.

---

## 4. Checksum Maintenance & Integrity Manifest

The file `SHA256SUMS.txt` at repository root tracks all application files in `app/` relative to `app/`.

### Verification Command
Run verification before and after modifying any file in `app/`:
```bash
# In Linux / macOS / Colab / Git Bash:
cd app && sha256sum -c ../SHA256SUMS.txt --quiet

# In Python (cross-platform):
python -c "
import hashlib, os
with open('SHA256SUMS.txt') as f:
    lines = [l.strip() for l in f if l.strip()]
bad = 0
for l in lines:
    h, p = l.split(None, 1)
    if p.startswith('./'): p = p[2:]
    fp = os.path.join('app', p)
    if not os.path.exists(fp) or hashlib.sha256(open(fp, 'rb').read()).hexdigest() != h:
        bad += 1
print(f'Mismatches: {bad} / {len(lines)}')
"
```

### Regeneration Command
If changes to `app/` are intentional and verified:
```bash
# In Linux / macOS / Colab / Git Bash:
cd app && find . -type f ! -path '*/.*' ! -path './node_modules/*' ! -path './.next/*' | sort | xargs sha256sum > ../SHA256SUMS.txt

# In Python (cross-platform):
python -c "
import hashlib, os
manifest = []
for root, dirs, files in os.walk('app'):
    dirs[:] = [d for d in dirs if not d.startswith('.') and d not in ('node_modules', '.next')]
    for file in sorted(files):
        if file.startswith('.'): continue
        fp = os.path.join(root, file)
        rel = os.path.relpath(fp, 'app').replace('\\\\', '/')
        h = hashlib.sha256(open(fp, 'rb').read()).hexdigest()
        manifest.append(f'{h}  ./{rel}\n')
manifest.sort(key=lambda x: x.split()[1])
with open('SHA256SUMS.txt', 'w', newline='\n') as f:
    f.writelines(manifest)
print(f'Updated SHA256SUMS.txt with {len(manifest)} entries.')
"
```

---

## 5. Automatic Git Commit and Push Workflow

1. **Pre-commit Verification:**
   - Verify `SHA256SUMS.txt` against `app/`.
   - Verify `Developers_App_Colab.ipynb` is valid JSON and has `REPO = "10Swarup01/DevHack"`, `BRANCH = "main"`, and `USE_ZIP = False`.
   - Verify `README.md` and `AGENTS.md` contain accurate links.
2. **Stage Changes:**
   ```bash
   git add Developers_App_Colab.ipynb README.md AGENTS.md SHA256SUMS.txt app/
   ```
3. **Commit:**
   Use clear, descriptive semantic commit messages (e.g., `feat: ...`, `fix: ...`, `chore(colab): ...`).
4. **Push Directly to GitHub:**
   ```bash
   git push origin main
   ```
   *If rejected due to remote updates:*
   ```bash
   git pull --rebase origin main
   # Re-verify checksums and test
   git push origin main
   ```

---

## 6. Security and Reliability Rules

- **Zero Secret Commits:** Never commit `.env`, `.env.local`, API keys, private passwords, or private access tokens.
- **Single Remote:** Never create a second unrelated Git repository. Keep the workspace root mapped cleanly to `10Swarup01/developer-s-app`.
- **Preserve User Data:** Never overwrite existing user changes without inspection or discard uncommitted files.

---

## 7. Required Links

When summarizing or reporting changes to the user, always provide direct links:
- **GitHub Repository (DevHack):** [https://github.com/10Swarup01/DevHack](https://github.com/10Swarup01/DevHack)
- **GitHub Repository (developer-s-app):** [https://github.com/10Swarup01/developer-s-app](https://github.com/10Swarup01/developer-s-app)
- **Google Colab Notebook:** [https://colab.research.google.com/drive/1VP_dsxBZvoSvCPRypuwxcEx6MB8X62Jt#scrollTo=6aa2a16b](https://colab.research.google.com/drive/1VP_dsxBZvoSvCPRypuwxcEx6MB8X62Jt#scrollTo=6aa2a16b)

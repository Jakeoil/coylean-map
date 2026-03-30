# Plan: Nest `coylean` Repo Inside `coylean-map`

## Goal

Have the `coylean` repo live at `coylean-map/coylean/` as an independent
Git repository, editable from this directory, with its own GitHub remote.

## Steps

1. **Create the repo on GitHub** (if not already done)
   - `gh repo create coylean --public` (or `--private`)

2. **Clone into the coylean-map directory**
   ```bash
   cd coylean-map
   git clone git@github.com:<user>/coylean.git
   ```

3. **Add to coylean-map's `.gitignore`**
   ```
   coylean/
   ```
   Commit the `.gitignore` change to coylean-map.

4. **Reference coylean files from coylean-map**
   - Use relative paths: `coylean/somefile.js`
   - HTML script tags, imports, etc. can reference `coylean/` directly
   - These references will work locally but coylean-map deploys
     (e.g. GitHub Pages) won't include coylean unless you build/copy

5. **Day-to-day workflow**
   - Edits to `coylean/` are tracked by the inner repo's git
   - Edits outside `coylean/` are tracked by coylean-map's git
   - Commit and push each repo independently
   - Claude Code can edit files in both repos from this working directory

## Considerations

- **GitHub Pages**: If coylean-map is deployed via Pages, the `coylean/`
  directory won't be included (it's gitignored). If coylean-map pages need
  coylean assets at deploy time, you'll need a build step or a symlink
  strategy.

- **CLAUDE.md**: If coylean needs its own Claude Code instructions, put a
  `CLAUDE.md` inside `coylean/`. Claude Code reads CLAUDE.md files from
  the working directory and all parent/child directories.

## Alternative: Git Submodule

A submodule makes coylean-map explicitly track which commit of coylean it
depends on. The coylean directory IS the repo (not gitignored), but
coylean-map only records a pointer to a specific commit hash.

### Setup (instead of steps 2-3 above)

```bash
cd coylean-map
git submodule add git@github.com:<user>/coylean.git
git commit -m "Add coylean as submodule"
```

This creates a `.gitmodules` file and a `coylean/` entry that points to a
specific commit in the coylean repo.

### The ceremony: editing coylean

Edits work normally — you change files in `coylean/` and commit there:

```bash
cd coylean
git add -A && git commit -m "some change"
git push
```

But now coylean-map sees that the submodule pointer is dirty. You must
**also** commit in the outer repo to update the pointer:

```bash
cd ..
git add coylean
git commit -m "Update coylean submodule"
```

So every coylean change that coylean-map should track requires **two
commits** — one inside, one outside.

### The ceremony: cloning fresh

A plain `git clone` of coylean-map gives you an **empty** coylean
directory. You need:

```bash
git clone --recursive git@github.com:<user>/coylean-map.git
```

Or if you forgot `--recursive`:

```bash
git submodule init
git submodule update
```

### The ceremony: pulling updates

When someone else updates the coylean submodule pointer, a normal
`git pull` in coylean-map updates the pointer but **not** the actual
files. You need:

```bash
git pull
git submodule update
```

Or the combined form:

```bash
git pull --recurse-submodules
```

### The ceremony: coylean moves ahead independently

If you push changes to coylean from elsewhere (another machine, a
collaborator), coylean-map doesn't know. To pull the latest:

```bash
cd coylean
git pull
cd ..
git add coylean
git commit -m "Update coylean to latest"
```

### When submodules are worth it

- coylean-map **deploys** need a specific coylean version (e.g. GitHub
  Pages, CI builds)
- You need **reproducible builds** — anyone cloning coylean-map gets the
  exact coylean version it was tested with
- Multiple repos depend on coylean and need to pin versions independently

### When gitignore is simpler

- The repos are loosely coupled — coylean-map references coylean but
  doesn't need to pin a version
- Only you work on both repos from this machine
- You don't deploy coylean-map with coylean included
- You prefer fewer git commands in your daily workflow

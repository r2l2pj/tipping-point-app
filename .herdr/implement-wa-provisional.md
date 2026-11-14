# WA provisional production note

Commit: `15f6c415361a0b6965a88455f63b28c9e96fe601` on `unit/wa-provisional`.

Changed only `submission/demo-script.md`: added the exact requested provisional WA production-note bullet. All existing text, including beats, voiceover, on-screen copy and X placeholders, is unchanged.

Commands and results:
- `pwd && git status --short && git branch --show-current && todo log && ls -d .herdr submission`: correct worktree/branch, initially clean, logging on, directories exist.
- `todo add "Add provisional WA flood figure production note without changing public placeholders"`: added item 69.
- `git log -3 --oneline`: inspected commit style.
- Verification on the tree committed above:
  ```sh
  python -c 'import pathlib, subprocess; p="submission/demo-script.md"; s=pathlib.Path(p).read_text(); old=subprocess.check_output(["git","show","HEAD:"+p],text=True); lines=s.splitlines(keepends=True); notes=[l for l in lines if l.startswith("- Provisional WA figure (not for recording yet):")]; assert len(notes)==1; assert "27.99" in notes[0]; assert "27.99" not in s.replace(notes[0],"",1); assert s.replace(notes[0],"",1)==old; print("PASS: exactly one production-note addition; zero figure occurrences outside it; all original script text unchanged")'
  ```
  Output: `PASS: exactly one production-note addition; zero figure occurrences outside it; all original script text unchanged`.
- `git diff --check && git diff --stat && git diff -- submission/demo-script.md`: passed; exactly one insertion in the scoped script.
- `git add submission/demo-script.md && git commit -m "docs: keep provisional WA figure out of recording copy" -m "Generated with [Devin](https://devin.ai)" -m "Co-Authored-By: Devin <158243242+devin-ai-integration[bot]@users.noreply.github.com>"`: succeeded, one file changed, one insertion.
- `git status --short && git rev-parse HEAD && todo`: clean after commit; SHA above; identified item 69 for completion.

No application tests run: documentation-only addition, verified directly against the parent script. This uncommitted report is an explicitly requested handoff artifact, not part of the product commit.

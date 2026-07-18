import os
import subprocess

repo = "/tmp/superfluid-overlay.git"
index = "/tmp/sup-remission-no-workflow.index"
env = os.environ.copy()
env["GIT_INDEX_FILE"] = index
subprocess.run(["git", f"--git-dir={repo}", "read-tree", "main"], env=env, check=True)
subprocess.run(
    ["git", f"--git-dir={repo}", "update-index", "--force-remove", ".github/workflows/build-sup-nonce-bundle.yml"],
    env=env,
    check=True,
)
tree = subprocess.check_output(["git", f"--git-dir={repo}", "write-tree"], env=env, text=True).strip()
parent = subprocess.check_output(["git", f"--git-dir={repo}", "rev-parse", "main^"], text=True).strip()
fmt = "%an%x00%ae%x00%aI%x00%cn%x00%ce%x00%cI%x00%B"
parts = subprocess.check_output(["git", f"--git-dir={repo}", "show", "-s", f"--format={fmt}", "main"], text=True).split("\x00", 6)
commit_env = os.environ.copy()
commit_env.update({
    "GIT_AUTHOR_NAME": parts[0],
    "GIT_AUTHOR_EMAIL": parts[1],
    "GIT_AUTHOR_DATE": parts[2],
    "GIT_COMMITTER_NAME": parts[3],
    "GIT_COMMITTER_EMAIL": parts[4],
    "GIT_COMMITTER_DATE": parts[5],
})
commit = subprocess.check_output(
    ["git", f"--git-dir={repo}", "commit-tree", tree, "-p", parent],
    input=parts[6],
    text=True,
    env=commit_env,
).strip()
subprocess.run(["git", f"--git-dir={repo}", "update-ref", "refs/heads/main", commit], check=True)
print(commit)

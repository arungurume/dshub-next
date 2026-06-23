import os

files_to_update = [
    "/Users/arun/DShub/frontend/ds-next/src/app/admin/billing/page.tsx",
    "/Users/arun/DShub/frontend/ds-next/src/app/admin/users/page.tsx",
    "/Users/arun/DShub/frontend/ds-next/src/app/admin/my-account/page.tsx",
    "/Users/arun/DShub/frontend/ds-next/src/app/admin/locations/page.tsx",
    "/Users/arun/DShub/frontend/ds-next/src/app/admin/schedules/page.tsx",
    "/Users/arun/DShub/frontend/ds-next/src/app/admin/dashboard/page.tsx",
    "/Users/arun/DShub/frontend/ds-next/src/app/admin/locations/[id]/page.tsx",
    "/Users/arun/DShub/frontend/ds-next/src/app/admin/content/page.tsx",
    "/Users/arun/DShub/frontend/ds-next/src/app/admin/playlists/page.tsx"
]

for filepath in files_to_update:
    with open(filepath, "r") as f:
        content = f.read()
    
    # Replace linear gradients
    content = content.replace("linear-gradient(135deg, #6366f1, #8b5cf6)", "var(--btn-cta-bg)")
    content = content.replace("linear-gradient(135deg,#6366f1,#8b5cf6)", "var(--btn-cta-bg)")
    
    # Replace hardcoded hex colors for SVGs and other things
    content = content.replace("#6366f1", "var(--accent)")
    content = content.replace("#8b5cf6", "var(--accent)")
    
    with open(filepath, "w") as f:
        f.write(content)

print("Replacement complete.")

#!/usr/bin/env python3
"""
Generates a narrated walkthrough video of OutreachAI from test screenshots.
Pipeline: narration text → macOS say (TTS) → aiff audio → ffmpeg → per-slide video → concat → final MP4
"""

import subprocess, os, json

SCREENSHOTS_DIR = "docs/test-screenshots"
AUDIO_DIR       = "docs/video-audio"
SLIDES_DIR      = "docs/video-slides"
OUTPUT_VIDEO    = "docs/outreachai-walkthrough.mp4"
VOICE           = "Samantha"
RATE            = 175  # words per minute (default 200; 175 = slightly slower, clearer)

os.makedirs(AUDIO_DIR,  exist_ok=True)
os.makedirs(SLIDES_DIR, exist_ok=True)

# Each entry: (screenshot filename, narration text)
SLIDES = [
    ("AUTH-01-login-page.png",
     "Welcome to OutreachAI — an AI-powered LinkedIn and email outreach platform. "
     "This is the login page. You can sign in with Google, Microsoft, Apple, or email. "
     "A demo workspace is available using the credentials shown on screen."),

    ("AUTH-02-login-success-dashboard.png",
     "After logging in, you land on the dashboard. "
     "It shows a personalised welcome message and a summary of your outreach activity."),

    ("DASH-01-dashboard-kpi.png",
     "The dashboard displays four key metrics: Total Leads, Active Campaigns, Emails Sent, and Replies. "
     "This account has 28 leads, 1 active campaign, 6 emails sent, and 2 replies."),

    ("DASH-02-sparklines-quickactions.png",
     "Two of the KPI cards — Emails Sent and Replies — now include seven-day sparkline charts "
     "so you can see activity trends at a glance. "
     "Below the cards are quick-action buttons to create a campaign, import leads, or open the inbox."),

    ("CAMP-01-campaigns-list.png",
     "The Campaigns page lists all outreach campaigns with status filters. "
     "Here we have three campaigns: one active, one draft, and one paused. "
     "Each card shows the campaign name, status badge, and creation date."),

    ("CAMP-02-campaign-detail.png",
     "Opening the active campaign reveals a visual sequence builder on the left "
     "and a configuration panel on the right. "
     "You can manage steps, leads, and campaign settings all from one page."),

    ("SEQ-01-sequences-list.png",
     "The Sequences page lists all reusable outreach sequences. "
     "Each sequence shows the number of steps and whether it's active or inactive."),

    ("SEQ-02-sequence-builder.png",
     "The sequence builder renders steps as visual cards in a flow. "
     "This sequence has six steps: Visit Profile, Connection Request, Wait Until Accepted, "
     "a timed Wait, and two follow-up Chat Messages."),

    ("SEQ-04-ab-variant-toggle.png",
     "Email steps now support A/B testing. "
     "Toggling the A/B switch reveals two variant tabs — Variant A and Variant B. "
     "The label confirms that 50 percent of leads will receive each variant."),

    ("SEQ-04b-ab-variant-b.png",
     "Here we're on Variant B, with a different subject line: 'A different angle.' "
     "Each variant has its own independent subject and body, "
     "letting you test which message resonates better with your audience."),

    ("INBOX-01-inbox-main.png",
     "The Inbox shows all conversations across LinkedIn and email in a unified view. "
     "At the top you'll find Open, Done, and All status tabs, "
     "plus channel filters for All, LinkedIn, and Email."),

    ("INBOX-06-conversation-done-button.png",
     "Opening a conversation shows the full message thread. "
     "At the top right is a green Done button — clicking it archives the conversation "
     "and removes it from the Open view."),

    ("INBOX-06b-after-mark-done.png",
     "After clicking Done, the conversation immediately disappears from the Open list. "
     "This keeps your inbox clean and focused on conversations that need attention."),

    ("INBOX-07-done-tab.png",
     "Switching to the Done tab confirms the conversation moved there. "
     "You can always find archived conversations here and restore them if needed."),

    ("INBOX-08-bulk-select.png",
     "The inbox also supports bulk actions. "
     "Selecting multiple conversations reveals a bulk action bar "
     "with options to Mark read, Mark done, or Clear the selection."),

    ("SIGNALS-01-signals-page.png",
     "The Signal Agents page is now fully functional — no longer a coming-soon stub. "
     "It has two tabs: Watchlists and Signal Feed. "
     "An empty state with a helpful message greets first-time users."),

    ("SIGNALS-02-create-watchlist-modal.png",
     "Clicking New Watchlist opens a modal with six signal types to choose from: "
     "Job change, LinkedIn engagement, Funding alert, Hiring signal, Website visit, and Custom API trigger. "
     "You can name your watchlist and add an optional description."),

    ("SIGNALS-02b-watchlist-created.png",
     "The Funding Round Prospects watchlist has been created. "
     "The card shows the signal type badge, signal count, "
     "and an active toggle to pause monitoring at any time."),

    ("CALLS-01-calls-page.png",
     "The Calls page is also now live. "
     "It shows a clean empty state with a Log a Call button, "
     "replacing the previous coming-soon placeholder."),

    ("CALLS-02-log-call-filled.png",
     "The Log a Call modal lets you record the phone number, direction — outbound or inbound — "
     "duration in minutes and seconds, outcome, and notes. "
     "Outcome options include: Interested, Not Interested, Callback, Left Voicemail, and Wrong Number."),

    ("CALLS-02b-call-logged.png",
     "After submitting, the call appears instantly in the log table. "
     "You can see the phone number, an outbound badge, duration of four minutes thirty seconds, "
     "a green Interested badge, and the notes truncated in the row."),

    ("DELIV-01-deliverability-page.png",
     "The Deliverability page shows your domain health score — currently 100 out of 100. "
     "The sending domains table displays S P F, D K I M, and D M A R C status per domain, "
     "along with daily sending limits."),

    ("DELIV-03-add-alert-rule.png",
     "A new Alert Rules section has been added. "
     "Clicking Add Alert Rule reveals an inline form where you pick a metric — "
     "Bounce Rate, Open Rate, Reply Rate, or Domain Score — "
     "set a condition, and enter a threshold."),

    ("DELIV-03b-alert-rule-saved.png",
     "The rule is saved instantly. "
     "Here, we've set an alert to fire when the bounce rate goes above 5 percent. "
     "Each rule has an active toggle and a delete button."),

    ("SETTINGS-07-billing-section.png",
     "The Settings page now includes a real Billing section. "
     "It shows your current plan — Free — and a Manage Billing button "
     "that opens the Stripe customer portal for subscription management."),

    ("LEADS-01-leads-page.png",
     "The People Database page shows all lead lists with counts. "
     "You can import leads via CSV, add them manually, or enrich existing leads with Apollo or Hunter."),

    ("CONTACTS-01-contacts-page.png",
     "The Contacts page shows your C R M contacts with status badges: "
     "Sent, Follow-up, and Replied. Full-text search filters the list in real time."),

    ("COMP-01-companies-page.png",
     "The Companies page shows firmographic data for all accounts: "
     "name, domain, industry, and contact and lead counts. "
     "You can click any company to see its full detail page with activities."),

    ("TASKS-01-tasks-page.png",
     "The Tasks page organises follow-ups into Today, Upcoming, and Completed tabs. "
     "Each task shows its type — call, email, LinkedIn, or custom — along with a due date."),

    ("HOT-LEADS-page.png",
     "Hot Leads surfaces the most engaged prospects based on email opens, clicks, and replies. "
     "Five hot leads are highlighted in this account."),

    ("OUTQ-01-outreach-queue.png",
     "The Outreach Queue shows AI-drafted messages waiting for your approval. "
     "You can review, edit, approve to send, or reject each draft individually."),

    ("INSIGHTS-01-insights-page.png",
     "The Insights page surfaces data-driven signals from your outreach activity — "
     "like reply rate changes, hot lead spikes, and sequence performance — "
     "without requiring any A I configuration."),

    ("DASH2-01-dashboards-page.png",
     "The Dashboards section lets you build composable analytics dashboards. "
     "You can add widgets, rearrange them, and share a public read-only link with your team."),

    ("ANALYTICS-page.png",
     "The Analytics page gives an overview of your outreach performance "
     "with charts for email delivery, open rates, and reply trends over time."),

    ("WARMUP-01-warmup-page.png",
     "Email Warmup automatically sends and replies to warmup emails "
     "to build sender reputation for new domains before you start cold outreach."),

    ("MKTG-01-marketing-page.png",
     "Finally, the Marketing Campaigns page handles bulk email sends with A/B testing, "
     "open and click tracking, and unsubscribe management — "
     "a feature that goes beyond what most outreach tools offer. "
     "That wraps up the OutreachAI feature walkthrough. "
     "Sign up free at outreachai dot in."),
]

print(f"Total slides: {len(SLIDES)}")

# Step 1 — generate per-slide audio via macOS `say`
print("\n=== Generating audio ===")
for i, (img, text) in enumerate(SLIDES):
    aiff_path = os.path.join(AUDIO_DIR, f"slide_{i:02d}.aiff")
    wav_path  = os.path.join(AUDIO_DIR, f"slide_{i:02d}.wav")
    if os.path.exists(wav_path):
        print(f"  [{i+1}/{len(SLIDES)}] skip (exists): {img}")
        continue
    print(f"  [{i+1}/{len(SLIDES)}] TTS: {img[:40]}…")
    subprocess.run(["say", "-v", VOICE, "-r", str(RATE), "-o", aiff_path, text], check=True)
    # convert aiff → wav (ffmpeg handles aiff for concat but wav is safer)
    subprocess.run(["ffmpeg", "-y", "-i", aiff_path, wav_path], capture_output=True, check=True)
    os.remove(aiff_path)

print("\n=== Getting audio durations ===")
durations = {}
for i, (img, _) in enumerate(SLIDES):
    wav_path = os.path.join(AUDIO_DIR, f"slide_{i:02d}.wav")
    r = subprocess.run(
        ["ffprobe", "-v", "quiet", "-print_format", "json", "-show_streams", wav_path],
        capture_output=True, text=True
    )
    info = json.loads(r.stdout)
    dur = float(info["streams"][0]["duration"])
    # add 0.5s pause at end of each slide
    durations[i] = dur + 0.5
    print(f"  slide_{i:02d}: {dur:.1f}s → {durations[i]:.1f}s with pause")

# Step 2 — generate per-slide video (image + audio)
print("\n=== Building slide videos ===")
slide_videos = []
for i, (img, _) in enumerate(SLIDES):
    img_path   = os.path.join(SCREENSHOTS_DIR, img)
    wav_path   = os.path.join(AUDIO_DIR,       f"slide_{i:02d}.wav")
    slide_path = os.path.join(SLIDES_DIR,      f"slide_{i:02d}.mp4")
    slide_videos.append(slide_path)

    if os.path.exists(slide_path):
        print(f"  [{i+1}/{len(SLIDES)}] skip (exists)")
        continue

    dur = durations[i]
    print(f"  [{i+1}/{len(SLIDES)}] {img[:40]} ({dur:.1f}s)")

    # scale image to 1920x1080 with black letterbox, then overlay audio
    subprocess.run([
        "ffmpeg", "-y",
        "-loop", "1", "-i", img_path,
        "-i", wav_path,
        "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-t", str(dur),
        "-pix_fmt", "yuv420p",
        "-shortest",
        slide_path
    ], capture_output=True, check=True)

# Step 3 — concatenate all slides
print("\n=== Concatenating slides ===")
concat_list = os.path.join(SLIDES_DIR, "concat.txt")
with open(concat_list, "w") as f:
    for v in slide_videos:
        f.write(f"file '{os.path.abspath(v)}'\n")

subprocess.run([
    "ffmpeg", "-y",
    "-f", "concat", "-safe", "0", "-i", concat_list,
    "-c:v", "libx264", "-preset", "fast", "-crf", "20",
    "-c:a", "aac", "-b:a", "128k",
    "-movflags", "+faststart",
    OUTPUT_VIDEO
], check=True)

total_dur = sum(durations.values())
print(f"\n✅ Done! Video saved to: {OUTPUT_VIDEO}")
print(f"   Slides: {len(SLIDES)}  |  Estimated duration: {total_dur/60:.1f} min")

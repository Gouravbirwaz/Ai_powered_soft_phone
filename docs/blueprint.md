# **App Name**: Twilio Talk

## Core Features:

- Two-Way Calling: Enable real-time two-way calling via Twilio WebRTC SDK with secure credential placeholders.
- Incoming Call Management: Display an incoming call popup with caller ID and Accept/Reject buttons. Manage busy/unavailable states gracefully.
- Automated Voicemail: Automatically leave a pre-recorded voicemail from a provided voice file if the agent is busy or unavailable. Update status when voicemail is left. If a link to a audio file is passed, this link has to be taken in consideration to automatically drop the voicemail.
- Call Status Tracking: Track and display real-time call states: ringing, connected, busy, failed, voicemail-dropped, ended. Update UI with call states.
- Post-Call Notes: Prompt the agent to add notes after each call, linking notes to the specific call session. Allow for later editing.
- Call Outcome Table: Display a sortable table of recent calls with details: direction, caller/receiver ID, duration, status, notes (inline view/edit), and timestamp. Includes filtering options by status or call type.
- Intelligent Summary Tool: Use a tool that, after each call, creates a concise summary from recording, call analysis and any available additional notes. This tool incorporates key data to deliver valuable and useful output

## Style Guidelines:

- Primary color: A professional navy blue (#2E4053) for trustworthiness and stability.
- Background color: A neutral light gray (#ECF0F1) to ensure readability and a clean interface.
- Accent color: A subtle teal (#2A9D8F) to highlight interactive elements without being overly distracting.
- Body and headline font: 'Roboto' (sans-serif) for a clean and readable interface. Code Font: 'Source Code Pro' (monospace) for displaying code snippets.
- Use minimalist, scalable vector icons for call controls (mute, hold, transfer, hang up) and status indicators.
- Implement a persistent docked Softphone Panel that can be minimized/maximized, ensuring key controls are always accessible.
- Use subtle animations for call state transitions (e.g., ringing, connecting) to provide clear user feedback.
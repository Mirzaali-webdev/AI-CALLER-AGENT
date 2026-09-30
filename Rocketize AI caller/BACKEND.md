# Rocketize Caller Desk backend

This project includes a single application source file, `server.js`. It embeds and serves the browser interface, provides operator sign-in, records server-side opt-outs and call attempts, and starts an outbound call through Vapi. It uses Node's built-in modules; no package dependencies are needed. Use Node.js 18 or newer for the built-in `fetch` support.

## Required configuration

Set the variables in `.env.example` as private environment variables in your hosting provider. Do not put real secrets in the HTML or commit them to source control.

- `APP_PASSWORD`: a unique operator password with at least 16 characters.
- `VAPI_PRIVATE_KEY`: private API key from your Vapi account.
- `VAPI_ASSISTANT_ID`: the Vapi assistant you configured and tested.
- `VAPI_PHONE_NUMBER_ID`: an approved Vapi phone number configured for outbound calls.
- `NODE_ENV=production` enables the secure session cookie; production hosting must use HTTPS.
- `PORT`: set this to the port supplied by your host.

Configure the Vapi assistant to clearly disclose that it is an AI, accurately describe Rocketize, avoid unsupported promises, honor requests to stop, and end the call promptly when asked. Confirm that your provider account and destination jurisdictions permit the calls you intend to make.

## Deployment notes

Deploy this as a long-running Node.js web service that can serve the project files, not as HTML-only static hosting. The host must route HTTPS traffic to `server.js` and provide durable persistent storage for the `data/` directory. The backend keeps opt-outs and call-attempt records there; without a persistent disk, this data may be lost on restart. Protect that data and set an appropriate retention policy.

The call endpoint requires an operator session and a checked consent box, validates international phone-number format, blocks numbers recorded on the backend opt-out list, and limits calls per session. The consent checkbox is an operator attestation, not independent proof of consent; verify and retain consent using your organization’s compliant process before calling. The app does not replace legal, carrier, or provider compliance requirements.

Lead form records remain in the visitor's browser. This backend does not provide shared lead management, user accounts, call transcription, or a full audit/compliance platform. Never use this for unsolicited calls.

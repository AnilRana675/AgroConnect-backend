# GitHub Models Setup Guide

This guide will help you set up GitHub Models API as a replacement for OpenRouter AI.

## What We Changed

1. **New Service**: Created `src/services/githubModelsAI.ts` to replace `src/services/openRouterAI.ts`
2. **Updated Routes**: Modified `src/routes/ai-assistant.ts` to use the new GitHub Models service
3. **Dependencies**: Removed the `openai` package dependency
4. **Environment Variables**: Added `GITHUB_TOKEN` to your `.env` file

## Getting Your GitHub Token

### Step 1: Create a GitHub Personal Access Token

1. Go to [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name like "AgroConnect AI"
4. Select the following scopes:
   - `read:packages` (for accessing GitHub Models)
   - `repo` (if you want to access private repositories)
5. Click "Generate token"
6. **Important**: Copy the token immediately - you won't be able to see it again!

### Step 2: Add Token to Your Environment

Open your `.env` file and add your GitHub token:

```
GITHUB_TOKEN='your_github_token_here'
```

Replace `your_github_token_here` with the token you just generated.

## Available Models

The GitHub Models API provides access to several models. We're currently using:

- **Llama-3.2-11B-Vision-Instruct**: A powerful model suitable for farming advice

You can also try other models available on GitHub Models:

- `Llama-3.2-3B-Instruct`
- `Phi-3.5-mini-instruct`
- `Phi-3.5-MoE-instruct`

To change the model, update the `model` field in `src/services/githubModelsAI.ts`.

## Installation & Testing

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Remove OpenAI package** (if you want to clean up):

   ```bash
   npm uninstall openai
   ```

3. **Test the setup**:

   ```bash
   npm run dev
   ```

4. **Test the AI endpoint**:

   ```bash
   curl -X GET http://localhost:5000/api/ai/status
   ```

   You should see a response indicating the GitHub Models service is configured.

## Benefits of GitHub Models

1. **Free**: No credit system - it's free for developers
2. **No Rate Limits**: Better rate limits compared to free tiers of other services
3. **GitHub Integration**: Seamless integration with your GitHub workflow
4. **Multiple Models**: Access to various state-of-the-art models
5. **Reliability**: Backed by Microsoft Azure infrastructure

## API Endpoints

All your existing AI endpoints will continue to work:

- `GET /api/ai/status` - Check AI service status
- `POST /api/ai/ask` - Get farming advice (authenticated/guest)
- `POST /api/ai/ask-anonymous` - Get farming advice (anonymous)
- `GET /api/ai/weekly-tips/:userId` - Get weekly farming tips
- `GET /api/ai/weekly-tips` - Get weekly farming tips (authenticated)
- `POST /api/ai/diagnose` - Diagnose crop diseases

## Troubleshooting

### Common Issues

1. **"AI service not configured"**
   - Check that your `GITHUB_TOKEN` is set in `.env`
   - Verify the token has the correct permissions
   - Ensure you're not using an expired token

2. **"API request failed: 401"**
   - Your GitHub token might be invalid or expired
   - Generate a new token with the correct permissions

3. **"API request failed: 403"**
   - You might not have access to GitHub Models
   - Check if your GitHub account has access to the GitHub Models marketplace

4. **"API request failed: 429"**
   - You've hit rate limits (rare with GitHub Models)
   - Wait a moment and try again

### Verification Steps

1. Check your token is valid:

   ```bash
   curl -H "Authorization: Bearer YOUR_TOKEN" https://api.github.com/user
   ```

2. Test the AI service status:

   ```bash
   curl http://localhost:5000/api/ai/status
   ```

3. Test a simple farming question:
   ```bash
   curl -X POST http://localhost:5000/api/ai/ask-anonymous \
     -H "Content-Type: application/json" \
     -d '{"question": "What are the best practices for rice farming in Nepal?"}'
   ```

## Next Steps

1. Set up your GitHub token as described above
2. Test the AI endpoints to ensure they're working
3. You can now remove the OpenRouter configuration if you want
4. Consider implementing additional features like image analysis using vision models

## Cost Comparison

| Service       | Cost             | Rate Limits     | Setup Complexity |
| ------------- | ---------------- | --------------- | ---------------- |
| OpenRouter    | Credits required | Varies by model | Medium           |
| GitHub Models | Free             | Generous        | Low              |

The GitHub Models approach is more cost-effective for your hackathon project and provides better long-term sustainability.

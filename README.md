# The Brand Story Bot

This app template is built on top of [Microsoft 365 Agents SDK](https://github.com/Microsoft/Agents).
It showcases an agent that responds to user questions like ChatGPT. This enables your users to talk with the agent using your custom engine.

## Get Started with the Template

> **Prerequisites**
>
> To run the template in your local dev machine, you will need:
>
> - [Node.js](https://nodejs.org/), supported versions: 18, 20, 22.
> - [Microsoft 365 Agents Toolkit Visual Studio Code Extension](https://aka.ms/teams-toolkit) latest version or [Microsoft 365 Agents Toolkit CLI](https://aka.ms/teamsfx-toolkit-cli).
> - Prepare your own [Azure OpenAI](https://aka.ms/oai/access) resource.

> For local debugging using Microsoft 365 Agents Toolkit CLI, you need to do some extra steps described in [Set up your Microsoft 365 Agents Toolkit CLI for local debugging](https://aka.ms/teamsfx-cli-debugging).

1. First, select the Microsoft 365 Agents Toolkit icon on the left in the VS Code toolbar.
1. In file *env/.env.playground.user*, fill in your Azure OpenAI key `SECRET_AZURE_OPENAI_API_KEY=<your-key>`, endpoint `AZURE_OPENAI_ENDPOINT=<your-endpoint>`, and deployment name `AZURE_OPENAI_DEPLOYMENT_NAME=<your-deployment>`.
1. Press F5 to start debugging which launches your agent in Microsoft 365 Agents Playground using a web browser. Select `Debug in Microsoft 365 Agents Playground`.
1. You can send any message to get a response from the agent.

**Congratulations**! You are running an agent that can now interact with users in Microsoft 365 Agents Playground:

![Basic AI Agent](https://github.com/user-attachments/assets/984af126-222b-4c98-9578-0744790b103a)

## Development Workflow

### Branch Strategy
Our project uses a two-branch strategy for safe development and deployment:

- **`main`** - Production-ready, stable code that's deployed to live environments
- **`dev`** - Development integration branch for ongoing work and testing
- **Feature branches** - Created from `dev` for individual features (e.g., `feature/chat-improvements`)

### Development Process
1. **Daily Development**: Work on feature branches created from `dev`
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/your-feature-name
   ```

2. **Integration**: Create Pull Request to merge feature branch into `dev`
   - Test thoroughly in development environment
   - Code review (even if self-reviewing for good practices)

3. **Production Release**: When `dev` is stable, merge to `main`
   ```bash
   git checkout main
   git merge dev
   git push origin main
   ```

### Environment Configuration

Our project uses multiple environment files for different deployment stages:

- **`.env.playground.user`** - Your local development credentials (never committed)
- **`.env.dev`** - Development environment template (committed to Git)
- **`.env.dev.local`** - Your actual dev environment values (never committed)

**Setting Up Your Environment:**
1. Copy `.env.dev` to `.env.dev.local`
2. Fill in your actual Azure credentials in `.env.dev.local`
3. Use `.env.playground.user` for local debugging

## Security Guidelines

**Critical Security Practices**

### Never Commit Secrets
- API keys, connection strings, and passwords should never be in Git
- Use template files (`.env.dev`) with placeholder values
- Keep actual credentials in local files (`.env.*.local`, `.env.*.user`)

### Environment Files Security
```
Safe to commit:
- .env.dev (template with empty values)
- .env.example (documentation)

Never commit:
- .env.dev.local (your actual dev credentials)
- .env.playground.user (your local credentials)
- Any file with real API keys
```

### What to Do If You Accidentally Commit Secrets
1. **Immediately** rotate/regenerate the exposed keys in Azure
2. Remove the secrets from Git history
3. Notify the team about the security incident

## Architecture Overview

### How the Agent Works
```
User Input → Microsoft 365 Agents → Your Custom Agent → Azure OpenAI → Response
```

### Key Components
- **Agent Server** (`src/index.ts`) - Main application entry point
- **Agent Adapter** (`src/adapter.ts`) - Handles Microsoft 365 integration
- **Business Logic** (`src/agent.ts`) - Core agent functionality and Azure OpenAI integration
- **Configuration** (`src/config.ts`) - Environment variable management

### Integration Points
- **Microsoft 365 Agents Playground** - Testing and development interface
- **Azure OpenAI** - AI model for generating responses
- **Microsoft Teams** - Future deployment target (with known limitations)

## What's Included in the Template

| Folder       | Contents                                            |
| - | - |
| `.vscode`    | VSCode files for debugging                          |
| `appPackage` | Templates for the application manifest        |
| `env`        | Environment files                                   |
| `infra`      | Templates for provisioning Azure resources          |
| `src`        | The source code for the application                 |

The following files can be customized and demonstrate an example implementation to get you started.

| File                                 | Contents                                           |
| - | - |
|`src/index.ts`| Sets up the agent server.|
|`src/adapter.ts`| Sets up the agent adapter.|
|`src/config.ts`| Defines the environment variables.|
|`src/agent.ts`| Handles business logics for the Basic Custom Engine Agent.|
|`src/blobClient.ts`| Provides blob storage utilities.|

The following are Microsoft 365 Agents Toolkit specific project files. You can [visit a complete guide on Github](https://github.com/OfficeDev/TeamsFx/wiki/Teams-Toolkit-Visual-Studio-Code-v5-Guide#overview) to understand how Microsoft 365 Agents Toolkit works.

| File                                 | Contents                                           |
| - | - |
|`m365agents.yml`|This is the main Microsoft 365 Agents Toolkit project file. The project file defines two primary things:  Properties and configuration Stage definitions. |
|`m365agents.local.yml`|This overrides `m365agents.yml` with actions that enable local execution and debugging.|
|`m365agents.playground.yml`| This overrides `m365agents.yml` with actions that enable local execution and debugging in Microsoft 365 Agents Playground.|

## Contributing

### For New Team Members
1. **Repository Access**: Ensure you have access to the GitHub organization
2. **Azure Access**: Get appropriate permissions for Azure OpenAI resources
3. **Environment Setup**: Follow the "Get started" section above
4. **Branch Setup**: 
   ```bash
   git clone <repository-url>
   cd <project-name>
   git checkout dev
   ```

### Code Contribution Process
1. **Create Feature Branch**:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/descriptive-name
   ```

2. **Development**:
   - Make your changes
   - Test locally using F5 debugging
   - Ensure no secrets are committed

3. **Pull Request**:
   - Push your feature branch
   - Create PR to merge into `dev`
   - Include description of changes and testing done

4. **Code Review**:
   - Self-review for code quality and security
   - Check that no credentials are exposed
   - Verify functionality works as expected

## Deployment Strategy

### Development Environment (`dev` branch)
- Automatically deploys when code is merged to `dev`
- Uses development Azure resources
- Safe for testing and integration

### Production Environment (`main` branch)
- Manually triggered deployment from stable `dev` code
- Uses production Azure resources
- Requires approval for deployment

### CI/CD Pipeline
Our GitHub Actions workflow handles:
- Automated testing on Pull Requests
- Environment-specific deployments
- Security scanning for exposed secrets
- Build validation

## Troubleshooting

### Common Setup Issues

**Azure OpenAI Connection Issues**
- Verify your API key is correct and not expired
- Check that your endpoint URL is properly formatted
- Ensure your Azure OpenAI deployment name matches configuration

**Microsoft 365 Agents Toolkit Issues**
- Ensure you have the latest version of the VS Code extension
- Try restarting VS Code if debugging isn't working
- Check that Node.js version is supported (18, 20, or 22)
- Verify that you are deploying from the correct branch
- Deployment is done using the Microsoft 365 Toolkit extension

**Environment Variable Problems**
- Verify `.env.playground.user` file exists and has correct format
- Check that environment variables don't have extra spaces
- Ensure file paths are correct in your configuration

**Git and Branch Issues**
```bash
# If you accidentally worked on main instead of dev
git stash
git checkout dev
git stash pop

# If you need to reset your local branch
git checkout dev
git fetch origin
git reset --hard origin/dev
```

### Getting Help
- Check the [Microsoft 365 Agents Toolkit Documentation](https://docs.microsoft.com/microsoftteams/platform/toolkit/teams-toolkit-fundamentals)
- Review [TeamsFx Samples](https://github.com/OfficeDev/TeamsFx-Samples) for examples
- Contact team lead for Azure access issues
- Create GitHub issue for bugs or feature requests

## Additional Information and References

- [Microsoft 365 Agents Toolkit Documentations](https://docs.microsoft.com/microsoftteams/platform/toolkit/teams-toolkit-fundamentals)
- [Microsoft 365 Agents Toolkit CLI](https://aka.ms/teamsfx-toolkit-cli)
- [Microsoft 365 Agents Toolkit Samples](https://github.com/OfficeDev/TeamsFx-Samples)

## Known Issues and Limitations

### Current Limitations
- **Teams Integration**: The agent currently doesn't work in Teams group chats or channels when stream response is enabled
- **Authentication**: May require additional setup for production Microsoft 365 integration
- **Rate Limiting**: Azure OpenAI rate limits may affect performance under heavy usage

---
import * as fs from 'fs';
import * as path from 'path';

export interface AgentHookContext {
  workspaceRoot: string;
  currentPhase: string;
  agentName: string;
  userPrompt?: string;
}

export interface ToolInvocationResult {
  toolName: string;
  args: Record<string, any>;
  result?: any;
  error?: Error;
}

export class SdlcAgentHooks {
  public workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
  }

  /**
   * Part 1 - Approach B: Context Injection (preTurn Hook)
   * Reads approvals.json, progress.md, and approvals.instructions.md directly
   * from disk and injects their fresh contents into the agent system context.
   */
  public async onPreTurn(context: AgentHookContext): Promise<{ systemInstructions: string }> {
    const root = context.workspaceRoot ? path.resolve(context.workspaceRoot) : this.workspaceRoot;
    const approvalsPath = path.join(root, 'approvals.json');
    const progressPath = path.join(root, 'progress.md');
    const instructionsPath = path.join(
      root,
      '.github',
      'instructions',
      'approvals.instructions.md'
    );

    const approvalsContent = this.safeReadFile(approvalsPath, '{}');
    const progressContent = this.safeReadFile(progressPath, 'No progress.md found.');
    const instructionsContent = this.safeReadFile(instructionsPath, 'No instructions found.');

    let parsedApprovals: any = {};
    try {
      parsedApprovals = JSON.parse(approvalsContent);
    } catch {
      // Keep empty object if JSON parsing fails
    }

    const phaseConfig = parsedApprovals.phases?.[context.currentPhase] || {};

    const injectedContext = `
<sdlc_runtime_context>
## [AUTOMATED HOOK] Authoritative SDLC State
This context was automatically injected at runtime. Do NOT call tools to read these files unless searching for historical details.

### Active Phase: ${context.currentPhase} (Agent: ${context.agentName})
- Status: ${phaseConfig.status ?? 'unknown'}
- Allowed Write Files: ${JSON.stringify(phaseConfig.canWriteFiles ?? [])}
- Command Permission: ${JSON.stringify(phaseConfig.canRunCommands ?? false)}
- Global allowGitPush: ${parsedApprovals.globalPolicies?.allowGitPush ?? false}
- Global allowFileDeletion: ${parsedApprovals.globalPolicies?.allowFileDeletion ?? false}

### Current approvals.json
\`\`\`json
${approvalsContent.trim()}
\`\`\`

### Current progress.md
\`\`\`markdown
${progressContent.trim()}
\`\`\`

### Governance Instructions (.github/instructions/approvals.instructions.md)
\`\`\`markdown
${instructionsContent.trim()}
\`\`\`
</sdlc_runtime_context>
`;

    return { systemInstructions: injectedContext.trim() };
  }

  /**
   * Part 2 - Approach B: Automated Progress Synchronization (postToolUse Hook)
   * Automatically intercepts successful file modifications and appends
   * structured audit entries directly to progress.md.
   */
  public async onPostToolUse(
    tool: ToolInvocationResult,
    context: AgentHookContext
  ): Promise<boolean> {
    const writeTools = ['edit', 'create', 'apply_patch'];
    if (!writeTools.includes(tool.toolName) || tool.error) {
      return false;
    }

    const rawTarget = tool.args?.path || tool.args?.filePath || '';
    if (!rawTarget) return false;

    const root = context.workspaceRoot ? path.resolve(context.workspaceRoot) : this.workspaceRoot;
    const resolvedTarget = path.isAbsolute(rawTarget)
      ? path.resolve(rawTarget)
      : path.resolve(root, rawTarget);
    const normalizedTarget = path.relative(root, resolvedTarget).replace(/\\/g, '/');

    // Prevent recursive loop if progress.md is edited directly
    if (normalizedTarget === 'progress.md') {
      return false;
    }

    return this.appendChangeToProgress(root, normalizedTarget, tool, context);
  }

  /**
   * Appends an automated change entry to progress.md
   */
  public appendChangeToProgress(
    root: string,
    filePath: string,
    tool: ToolInvocationResult,
    context: AgentHookContext
  ): boolean {
    const progressFilePath = path.join(root, 'progress.md');
    if (!fs.existsSync(progressFilePath)) {
      return false;
    }

    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
    const toolAction = tool.toolName === 'create' ? 'Created' : 'Modified';

    const entry = `- **[${timestamp}] [${context.agentName || context.currentPhase}]**: ${toolAction} \`${filePath}\`\n`;

    const content = fs.readFileSync(progressFilePath, 'utf8');
    const headerMarker = '## Automated Activity Log';

    let updatedContent: string;
    if (content.includes(headerMarker)) {
      // Insert new entry right under the header
      updatedContent = content.replace(
        headerMarker,
        `${headerMarker}\n${entry.trimEnd()}`
      );
    } else {
      // Append section at the bottom of progress.md
      updatedContent = `${content.trimEnd()}\n\n${headerMarker}\n${entry}`;
    }

    fs.writeFileSync(progressFilePath, updatedContent, 'utf8');
    return true;
  }

  public safeReadFile(filePath: string, fallback: string): string {
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
    } catch {
      // Fallback on read error
    }
    return fallback;
  }
}

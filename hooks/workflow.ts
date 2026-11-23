import { SdlcAgentHooks, AgentHookContext, ToolInvocationResult } from './sdlcAgentHooks.js';
import * as path from 'path';

export class SdlcCopilotWorkflow {
  public hooks: SdlcAgentHooks;
  public workspaceRoot: string;

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot);
    this.hooks = new SdlcAgentHooks(this.workspaceRoot);
  }

  /**
   * Part 1 - Approach B: Context Injection (preTurn Hook)
   * Injects authoritative SDLC state (approvals.json, progress.md, instructions)
   * into the system prompt prior to agent token generation.
   */
  public async prepareTurn(context: AgentHookContext): Promise<{
    systemInstructions: string;
    context: AgentHookContext;
  }> {
    const { systemInstructions } = await this.hooks.onPreTurn(context);
    return {
      systemInstructions,
      context,
    };
  }

  /**
   * Part 2 - Approach B: Automated Progress Synchronization (postToolUse Hook)
   * Intercepts tool execution results and automatically logs code modifications
   * to progress.md without requiring manual agent logging.
   */
  public async handleToolExecution(
    toolName: string,
    args: Record<string, any>,
    context: AgentHookContext,
    result?: any,
    error?: Error
  ): Promise<boolean> {
    const toolInvocation: ToolInvocationResult = {
      toolName,
      args,
      result,
      error,
    };
    return this.hooks.onPostToolUse(toolInvocation, context);
  }

  /**
   * Helper that executes any tool and guarantees postToolUse hook execution.
   */
  public async executeToolWithHook<T>(
    toolName: string,
    args: Record<string, any>,
    context: AgentHookContext,
    toolExecutor: () => Promise<T>
  ): Promise<T> {
    try {
      const result = await toolExecutor();
      await this.handleToolExecution(toolName, args, context, result);
      return result;
    } catch (err: any) {
      await this.handleToolExecution(toolName, args, context, undefined, err);
      throw err;
    }
  }
}

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SdlcAgentHooks } from '../../src/hooks/sdlcAgentHooks.js';

describe('SdlcAgentHooks (Part 1 - Approach B & Part 2 - Approach B)', () => {
  let tempDir: string;
  let hooks: SdlcAgentHooks;

  beforeEach(() => {
    // Resolve realpath to ensure consistent drive letter / casing on Windows
    tempDir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sdlc-hooks-test-')));
    hooks = new SdlcAgentHooks(tempDir);

    // Setup mock approvals.json
    fs.writeFileSync(
      path.join(tempDir, 'approvals.json'),
      JSON.stringify({
        project: 'Keep Notes (Web)',
        globalPolicies: { allowGitPush: false, allowFileDeletion: false },
        phases: {
          implementation: {
            status: 'approved',
            canWriteFiles: ['client/**', 'server/**', 'progress.md'],
            canRunCommands: true,
          },
        },
      }),
      'utf8'
    );

    // Setup mock progress.md
    fs.writeFileSync(
      path.join(tempDir, 'progress.md'),
      '# Project Progress: Keep Notes (Web)\n\n- Task 1: Complete\n',
      'utf8'
    );

    // Setup mock instructions
    fs.mkdirSync(path.join(tempDir, '.github', 'instructions'), { recursive: true });
    fs.writeFileSync(
      path.join(tempDir, '.github', 'instructions', 'approvals.instructions.md'),
      '# Permissions and Approval Gates\n\nRead registry first.',
      'utf8'
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Part 1 - Approach B: Context Injection (onPreTurn)', () => {
    it('injects approvals, progress, and instructions into system context', async () => {
      const result = await hooks.onPreTurn({
        workspaceRoot: tempDir,
        currentPhase: 'implementation',
        agentName: 'implementation-agent',
      });

      expect(result.systemInstructions).toContain('<sdlc_runtime_context>');
      expect(result.systemInstructions).toContain('Active Phase: implementation (Agent: implementation-agent)');
      expect(result.systemInstructions).toContain('Allowed Write Files: ["client/**","server/**","progress.md"]');
      expect(result.systemInstructions).toContain('Task 1: Complete');
      expect(result.systemInstructions).toContain('Read registry first.');
    });

    it('gracefully handles missing files without throwing', async () => {
      fs.unlinkSync(path.join(tempDir, 'approvals.json'));
      fs.unlinkSync(path.join(tempDir, 'progress.md'));

      const result = await hooks.onPreTurn({
        workspaceRoot: tempDir,
        currentPhase: 'verify',
        agentName: 'verify-agent',
      });

      expect(result.systemInstructions).toContain('Active Phase: verify');
      expect(result.systemInstructions).toContain('No progress.md found.');
    });
  });

  describe('Part 2 - Approach B: Automated Progress Synchronization (onPostToolUse)', () => {
    it('automatically appends file modification to progress.md', async () => {
      const changedFile = path.join(tempDir, 'client', 'src', 'App.tsx');
      const appended = await hooks.onPostToolUse(
        {
          toolName: 'edit',
          args: { path: changedFile },
        },
        {
          workspaceRoot: tempDir,
          currentPhase: 'implementation',
          agentName: 'implementation-agent',
        }
      );

      expect(appended).toBe(true);

      const progressContent = fs.readFileSync(path.join(tempDir, 'progress.md'), 'utf8');
      expect(progressContent).toContain('## Automated Activity Log');
      expect(progressContent).toContain('[implementation-agent]**: Modified `client/src/App.tsx`');
    });

    it('ignores edits directly made to progress.md to prevent recursion', async () => {
      const progressPath = path.join(tempDir, 'progress.md');
      const appended = await hooks.onPostToolUse(
        {
          toolName: 'edit',
          args: { path: progressPath },
        },
        {
          workspaceRoot: tempDir,
          currentPhase: 'implementation',
          agentName: 'implementation-agent',
        }
      );

      expect(appended).toBe(false);
      const progressContent = fs.readFileSync(progressPath, 'utf8');
      expect(progressContent).not.toContain('## Automated Activity Log');
    });

    it('ignores read-only or failed tool calls', async () => {
      const appended = await hooks.onPostToolUse(
        {
          toolName: 'view',
          args: { path: 'client/src/App.tsx' },
        },
        {
          workspaceRoot: tempDir,
          currentPhase: 'implementation',
          agentName: 'implementation-agent',
        }
      );

      expect(appended).toBe(false);

      const failedEdit = await hooks.onPostToolUse(
        {
          toolName: 'edit',
          args: { path: 'client/src/App.tsx' },
          error: new Error('Disk full'),
        },
        {
          workspaceRoot: tempDir,
          currentPhase: 'implementation',
          agentName: 'implementation-agent',
        }
      );

      expect(failedEdit).toBe(false);
    });
  });
});

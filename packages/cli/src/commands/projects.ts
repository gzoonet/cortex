import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import {
  addProject,
  removeProject,
  listProjects,
  getProject,
  loadConfig,
  createLogger,
} from '@cortex/core';
import { SQLiteStore } from '@cortex/graph';
import type { GlobalOptions } from '../index.js';

const logger = createLogger('cli:projects');

export function registerProjectsCommand(program: Command): void {
  const projects = program
    .command('projects')
    .description('Manage registered projects');

  // List projects
  projects
    .command('list')
    .alias('ls')
    .description('List all registered projects')
    .action(async () => {
      const globals = program.opts<GlobalOptions>();
      await runList(globals);
    });

  // Add project
  projects
    .command('add <name> [path]')
    .description('Register a project (path defaults to current directory)')
    .action(async (name: string, path?: string) => {
      const globals = program.opts<GlobalOptions>();
      await runAdd(name, path, globals);
    });

  // Remove project
  projects
    .command('remove <name>')
    .alias('rm')
    .description('Unregister a project')
    .action(async (name: string) => {
      const globals = program.opts<GlobalOptions>();
      await runRemove(name, globals);
    });

  // Show project details
  projects
    .command('show <name>')
    .description('Show details of a registered project')
    .action(async (name: string) => {
      const globals = program.opts<GlobalOptions>();
      await runShow(name, globals);
    });
}

async function runList(globals: GlobalOptions): Promise<void> {
  const projects = listProjects();

  if (globals.json) {
    console.log(JSON.stringify(projects, null, 2));
    return;
  }

  if (projects.length === 0) {
    console.log(chalk.yellow('No projects registered.'));
    console.log(chalk.dim('Register a project with: cortex projects add <name> [path]'));
    return;
  }

  console.log('');
  console.log(chalk.bold.cyan('REGISTERED PROJECTS'));
  console.log(chalk.dim('─'.repeat(60)));

  for (const project of projects) {
    const configExists = existsSync(join(project.path, 'cortex.config.json'));
    const statusIcon = configExists ? chalk.green('✓') : chalk.yellow('○');
    
    console.log(`${statusIcon} ${chalk.bold(project.name)}`);
    console.log(`   Path: ${chalk.dim(project.path)}`);
    if (project.lastWatched) {
      console.log(`   Last watched: ${chalk.dim(new Date(project.lastWatched).toLocaleString())}`);
    }
    console.log('');
  }

  console.log(chalk.dim(`Total: ${projects.length} project(s)`));
}

async function runAdd(name: string, path: string | undefined, globals: GlobalOptions): Promise<void> {
  const projectPath = resolve(path ?? process.cwd());

  // Check if path exists
  if (!existsSync(projectPath)) {
    console.error(chalk.red(`Error: Path does not exist: ${projectPath}`));
    process.exit(1);
  }

  // Check if already registered in file registry
  const existing = getProject(name);

  // Check for config file
  const configPath = join(projectPath, 'cortex.config.json');
  const hasConfig = existsSync(configPath);

  const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
  const store = new SQLiteStore({ dbPath: config.graph.dbPath, backupOnStartup: false });

  try {
    const dbProject = await store.getProjectByName(name);

    if (existing && dbProject) {
      console.error(chalk.red(`Error: Project "${name}" is already registered at ${existing.path}`));
      console.log(chalk.dim('Use a different name or remove the existing project first.'));
      process.exit(1);
    }

    // Add to file registry if not already there
    if (!existing) {
      addProject(name, projectPath, hasConfig ? configPath : undefined);
    }

    // Add to DB if not already there (handles re-sync)
    if (!dbProject) {
      await store.createProject({
        name,
        rootPath: projectPath,
        privacyLevel: 'standard',
        fileCount: 0,
        entityCount: 0,
      });
    }

    if (globals.json) {
      const entry = getProject(name);
      console.log(JSON.stringify(entry, null, 2));
      return;
    }

    if (existing && !dbProject) {
      console.log(chalk.green(`✓ Project "${name}" synced to database`));
    } else {
      console.log(chalk.green(`✓ Project "${name}" registered`));
    }
    console.log(`   Path: ${projectPath}`);

    if (!hasConfig) {
      console.log('');
      console.log(chalk.yellow('⚠ No cortex.config.json found in this directory.'));
      console.log(chalk.dim(`Run 'cd ${projectPath} && cortex init' to create one.`));
    } else {
      console.log('');
      console.log(chalk.dim(`Start watching with: cortex watch ${name}`));
    }
  } finally {
    store.close();
  }
}

async function runRemove(name: string, globals: GlobalOptions): Promise<void> {
  const existing = getProject(name);

  const config = loadConfig({ configDir: globals.config ? resolve(globals.config) : undefined });
  const store = new SQLiteStore({ dbPath: config.graph.dbPath, backupOnStartup: false });

  try {
    const dbProject = await store.getProjectByName(name);

    if (!existing && !dbProject) {
      console.error(chalk.red(`Error: Project "${name}" is not registered.`));
      process.exit(1);
    }

    // Remove from file registry
    if (existing) {
      removeProject(name);
    }

    // Remove from DB
    if (dbProject) {
      await store.deleteProject(dbProject.id);
    }

    if (globals.json) {
      console.log(JSON.stringify({ removed: name }));
      return;
    }

    console.log(chalk.green(`✓ Project "${name}" unregistered`));
    console.log(chalk.dim('Note: This only removes the registration. Project files are unchanged.'));
  } finally {
    store.close();
  }
}

async function runShow(name: string, globals: GlobalOptions): Promise<void> {
  const project = getProject(name);

  if (!project) {
    console.error(chalk.red(`Error: Project "${name}" is not registered.`));
    console.log(chalk.dim('List registered projects with: cortex projects list'));
    process.exit(1);
  }

  const configPath = join(project.path, 'cortex.config.json');
  const hasConfig = existsSync(configPath);

  if (globals.json) {
    console.log(JSON.stringify({ ...project, hasConfig }, null, 2));
    return;
  }

  console.log('');
  console.log(chalk.bold.cyan(`PROJECT: ${project.name}`));
  console.log(chalk.dim('─'.repeat(40)));
  console.log(`Path:         ${project.path}`);
  console.log(`Config:       ${hasConfig ? chalk.green('Found') : chalk.yellow('Not found')}`);
  console.log(`Registered:   ${new Date(project.addedAt).toLocaleString()}`);
  if (project.lastWatched) {
    console.log(`Last watched: ${new Date(project.lastWatched).toLocaleString()}`);
  }
  console.log('');
}

﻿import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

// Helper function to get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Configuration ---
// Files/directories to copy from the template
const TEMPLATE_DIR = path.resolve(__dirname, '..'); // Root of the template project
const FILES_TO_COPY = [
    '.eslintrc.json',
    '.gitignore',
    '.prettierrc.json',
    'README.md',
    'tsconfig.json',
    'docs', // Copy the whole docs folder
    'src', // Copy the whole src folder (excluding initialize.ts itself later)
    // package.json is handled separately
];
// Files/directories to explicitly exclude from the copy
const EXCLUDE_FROM_COPY = [
    'node_modules',
    'dist',
    '.git',
    'package-lock.json', // Target project should generate its own
    path.join('src', 'initialize.ts'), // Don't copy the init script itself
];

// --- Helper Functions ---

/**
 * Copies files and directories recursively, excluding specified items.
 * @param source Source path
 * @param destination Destination path
 * @param exclude Array of paths (relative to source) to exclude
 */
function copyRecursiveSync(source: string, destination: string, exclude: string[] = []) {
    const exists = fs.existsSync(source);
    const stats = exists ? fs.statSync(source) : undefined; // Get stats only if exists
    const isDirectory = stats?.isDirectory(); // Check isDirectory safely

    const relativeSourcePath = path.relative(TEMPLATE_DIR, source);
    if (!exists || exclude.some(ex => relativeSourcePath.startsWith(ex))) { // Also skip if source doesn't exist
        // console.log(chalk.yellow(`Skipping excluded: ${relativeSourcePath}`));
        return;
    }

    if (isDirectory) {
        if (!fs.existsSync(destination)) {
            fs.mkdirSync(destination, { recursive: true });
        }
        fs.readdirSync(source).forEach((childItemName) => {
            copyRecursiveSync(
                path.join(source, childItemName),
                path.join(destination, childItemName),
                exclude
            );
        });
    } else if (exists) {
        // Ensure parent directory exists in destination
        const destDir = path.dirname(destination);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }
        fs.copyFileSync(source, destination);
    } else {
        console.warn(chalk.yellow(`Source path not found, skipping: ${source}`));
    }
}

/**
 * Updates the package.json in the target directory.
 * @param targetDir The directory where the new project is created.
 * @param answers The answers from the inquirer prompts.
 */
function updatePackageJson(targetDir: string, answers: Record<string, any>) {
    const packageJsonPath = path.join(targetDir, 'package.json');
    try {
        // Read the template package.json
        const templatePackageJsonPath = path.join(TEMPLATE_DIR, 'package.json');
        const packageJson = JSON.parse(fs.readFileSync(templatePackageJsonPath, 'utf-8'));

        // Modify based on answers
        packageJson.name = answers.projectName || path.basename(targetDir);
        packageJson.version = '0.1.0'; // Start new projects at 0.1.0
        packageJson.description = answers.description || '';

        // DO NOT set the bin field in the generated project.
        // The generated project is a server, not a create-* command.
        delete packageJson.bin; // Explicitly remove bin if it exists in template

        // Clear other potentially sensitive or template-specific fields
        delete packageJson.author; // Can add prompt later
        delete packageJson.repository;
        delete packageJson.bugs;
        delete packageJson.homepage;

        // Fix the build script for the generated project - it should only run tsc
        if (packageJson.scripts && packageJson.scripts.build) {
            packageJson.scripts.build = 'tsc';
        }

        // Write the updated package.json
        fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
        console.log(chalk.green('Updated package.json successfully.'));

    } catch (error: any) {
        console.error(chalk.red(`Error updating package.json: ${error.message}`));
    }
}


// --- Main Execution ---

async function run() {
    console.log(chalk.cyan('Initializing new MCP Server project...'));

    // 1. Get Target Directory from command line argument
    const targetArg = process.argv[2];
    if (!targetArg) {
        console.error(chalk.red('Error: Project directory name is required.'));
        console.log(chalk.yellow('Usage: npx mcp-server-template <project-name>'));
        process.exit(1);
    }
    const targetDir = path.resolve(process.cwd(), targetArg);
    const projectName = path.basename(targetDir);

    // Check if target directory already exists
    if (fs.existsSync(targetDir)) {
        const { overwrite } = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'overwrite',
                message: `Directory "${projectName}" already exists. Overwrite?`,
                default: false,
            },
        ]);
        if (!overwrite) {
            console.log(chalk.yellow('Initialization cancelled.'));
            process.exit(0);
        }
        // Consider cleaning the directory here if overwrite is true, or handle merging
        console.log(chalk.yellow(`Overwriting directory: ${targetDir}`));
        // Be cautious with rmSync! Maybe prompt again for safety.
        // fs.rmSync(targetDir, { recursive: true, force: true });
        // fs.mkdirSync(targetDir);
    } else {
        fs.mkdirSync(targetDir, { recursive: true });
    }


    // 2. Ask Questions
    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'projectName',
            message: 'Project name:',
            default: projectName,
            validate: (input: string) => !!input || 'Project name cannot be empty.',
        },
        {
            type: 'input',
            name: 'description',
            message: 'Project description:',
            default: 'My new MCP Server',
        },
        // Add more questions here: author, license, required env vars, etc.
        // Example:
        // {
        //   type: 'input',
        //   name: 'author',
        //   message: 'Author:',
        // },
        // {
        //   type: 'list',
        //   name: 'license',
        //   message: 'License:',
        //   choices: ['MIT', 'ISC', 'Apache-2.0', 'UNLICENSED'],
        //   default: 'ISC',
        // }
    ]);

    console.log(chalk.blue('\nCreating project structure...'));

    // 3. Copy Template Files
    FILES_TO_COPY.forEach((fileOrDir) => {
        const sourcePath = path.join(TEMPLATE_DIR, fileOrDir);
        const destinationPath = path.join(targetDir, fileOrDir);
        console.log(`Copying ${fileOrDir}...`);
        copyRecursiveSync(sourcePath, destinationPath, EXCLUDE_FROM_COPY);
    });

    // 4. Update package.json
    updatePackageJson(targetDir, answers);


    // 5. Final Instructions
    console.log(chalk.green('\nProject initialized successfully!'));
    console.log(chalk.cyan('\nNext steps:'));
    console.log(`  cd ${targetArg}`);
    console.log('  npm install');
    console.log('  # Review configuration in src/config/ConfigurationManager.ts');
    console.log('  # Add your tools in src/tools/');
    console.log('  # Add your services in src/services/');
    console.log('  npm run dev  (to start the development server)');
    console.log('  npm run build (to build for production)');
}

run().catch((error) => {
    console.error(chalk.red('\nAn error occurred during initialization:'));
    console.error(error);
    process.exit(1);
});

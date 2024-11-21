#!/usr/bin/env node

/**
 * codeSummary.mjs
 *
 * This script generates a directory tree, collects selected code files,
 * sends the directory structure and code files to an LLM for analysis,
 * and compiles everything into a single Markdown file.
 * The final report includes a table of contents, directory structure,
 * LLM analysis, and code files. It also allows selective analysis based on
 * selected files or directories and includes a timestamp of when the report was generated.
 * Additionally, it manages the output directory and ensures it's excluded from git tracking.
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { checkbox } from '@inquirer/prompts';
import minimatch from 'minimatch';

// Load environment variables
dotenv.config();

// Configuration
const CONFIG = {
  outputDir: 'codeSummaryLogs',
  excludedDirs: [
    '.git',
    'node_modules',
    'dist',
    'build',
    'coverage',
    'logs',
    'tmp',
    '.vscode',
    '.svelte-kit',
    'outlines',
    'codeSummaryLogs' // Ensure the output directory is excluded
  ],
  excludedFiles: [
    '.DS_Store',
    'Thumbs.db',
    'package-lock.json',
    'yarn.lock',
    'pnpm-lock.yaml',
    '.env',
    '.gitignore',
    '*.config.js',
    '*codesummary*'
  ],
  api: {
    url: 'https://openrouter.ai/api/v1/chat/completions',
    key: process.env.OPENROUTER_API_KEY,
    siteUrl: process.env.YOUR_SITE_URL || '',
    siteName: process.env.YOUR_SITE_NAME || ''
  }
};

// Validate API Key
if (!CONFIG.api.key) {
  console.error('Error: OPENROUTER_API_KEY is not set in the .env file.');
  process.exit(1);
}

// Utility functions

/**
 * Get current directory for ES modules
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Format current date and time
 */
const getFormattedDate = () => {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
};

/**
 * Ensure the output directory exists
 */
const ensureOutputDirectory = async () => {
  const dirPath = path.resolve(process.cwd(), CONFIG.outputDir);
  try {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`Output directory ready: ${CONFIG.outputDir}`);
  } catch (err) {
    console.error('Failed to create output directory:', err);
    process.exit(1);
  }
};

/**
 * Display usage instructions
 */
const displayHelp = () => {
  const helpText = `
Usage: node codeSummary.mjs [options]

Options:
  --target, -t <path>       Specify files or directories to analyze. You can provide multiple targets by repeating the flag or separating them with commas.
  --interactive, -i        Launch interactive mode to select files/directories.
  --help, -h                Display this help message.

Examples:
  Analyze the entire project (default):
    node codeSummary.mjs

  Analyze specific directories:
    node codeSummary.mjs --target src/components --target src/utils

  Analyze specific files and directories:
    node codeSummary.mjs -t src/components,src/utils/helpers.ts,README.md

  Launch interactive selection:
    node codeSummary.mjs --interactive
`;
  console.log(helpText);
};

/**
 * Traverse the directory and collect files with depth information
 *
 * @param {string} dir - Directory path
 * @param {number} depth - Current depth level
 * @returns {Array} - List of file and directory objects with name, path, isDirectory, and depth
 */
const traverseDirectory = async (dir, depth = 0) => {
  let results = [];
  let items;

  try {
    items = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
    return results;
  }

  for (const item of items) {
    if (isExcluded(item.name, item.isDirectory())) {
      continue;
    }

    const fullPath = path.join(dir, item.name);
    const relativePath = path.relative(process.cwd(), fullPath).split(path.sep).join('/');

    results.push({
      name: item.name,
      path: relativePath,
      isDirectory: item.isDirectory(),
      depth: depth
    });

    if (item.isDirectory()) {
      const nested = await traverseDirectory(fullPath, depth + 1);
      results = results.concat(nested);
    }
  }

  return results;
};

/**
 * Check if a file or directory should be excluded
 *
 * @param {string} name - The file or directory name
 * @param {boolean} isDir - Is the item a directory
 * @returns {boolean} - True if excluded, false otherwise
 */
const isExcluded = (name, isDir) => {
  if (isDir) {
    return CONFIG.excludedDirs.includes(name) || name.toLowerCase().includes('codesummary');
  } else {
    for (const pattern of CONFIG.excludedFiles) {
      if (minimatch(name, pattern, { nocase: true })) {
        return true;
      }
    }
    return false;
  }
};

/**
 * Format choices with indentation based on depth
 *
 * @param {Array} items - List of file and directory objects
 * @returns {Array} - List of formatted choices for inquirer
 */
const formatChoices = (items) => {
  return items.map(item => ({
    name: `${'  '.repeat(item.depth)}${item.isDirectory ? '📁' : '📄'} ${item.name}`,
    value: item.path,
    checked: false
  }));
};

/**
 * Launch interactive selection using inquirer
 *
 * @param {Array} allItems - Complete list of all file and directory objects
 * @returns {Array} - List of selected file/directory paths
 */
const launchInteractiveSelection = async (allItems) => {
  console.log('Launching interactive selection mode...');

  const choices = formatChoices(allItems);

  try {
    const selected = await checkbox({
      message: 'Select files and directories to include in the analysis:',
      choices,
      validate: (answer) => answer.length > 0 || 'You must select at least one item.'
    });

    return selected;
  } catch (err) {
    console.error('Selection error:', err.message);
    process.exit(1);
  }
};

/**
 * Process selected targets and include all nested files if a directory is selected
 *
 * @param {Array} selected - List of selected file and directory paths
 * @param {Array} allItems - Complete list of all file and directory objects
 * @returns {Array} - Final list of file paths to process
 */
const processSelections = (selected, allItems) => {
  let filesToProcess = [];

  // Create a map for quick lookup
  const itemsMap = new Map();
  allItems.forEach(item => {
    itemsMap.set(item.path, item);
  });

  selected.forEach(selectedPath => {
    const item = itemsMap.get(selectedPath);
    if (item) {
      if (item.isDirectory) {
        // Include all files within the directory
        const nestedFiles = allItems.filter(child => child.path.startsWith(`${selectedPath}/`) && !child.isDirectory);
        filesToProcess = filesToProcess.concat(nestedFiles.map(file => file.path));
      } else {
        filesToProcess.push(selectedPath);
      }
    }
  });

  // Remove duplicates
  filesToProcess = [...new Set(filesToProcess)];

  return filesToProcess;
};

/**
 * Read file content with size limitation
 *
 * @param {string} filePath - The path of the file to read
 * @param {number} maxSize - Maximum allowed file size in bytes
 * @returns {string|null} - The file content or null if exceeds size limit
 */
const readFileContent = async (filePath, maxSize = 1_000_000) => {
  try {
    const stats = await fs.stat(filePath);
    if (stats.size > maxSize) {
      console.warn(`Skipping ${filePath} (exceeds size limit of ${maxSize} bytes).`);
      return null;
    }
    const content = await fs.readFile(filePath, 'utf8');
    return content;
  } catch (err) {
    console.error(`Error reading file ${filePath}:`, err.message);
    return null;
  }
};

/**
 * Collect files from selected targets
 *
 * @param {Array} targets - List of file/directory paths
 * @returns {Array} - List of file paths
 */
const collectFiles = async (targets) => {
  let filesList = [];

  for (const target of targets) {
    const resolvedPath = path.resolve(process.cwd(), target);
    try {
      const stats = await fs.stat(resolvedPath);
      if (stats.isDirectory()) {
        const nestedFiles = await getAllFiles(resolvedPath);
        filesList = filesList.concat(nestedFiles);
      } else if (stats.isFile()) {
        filesList.push(target);
      }
    } catch (err) {
      console.warn(`Warning: Target path "${target}" does not exist or is inaccessible. Skipping.`);
      continue;
    }
  }

  return filesList;
};

/**
 * Recursively get all files in a directory
 *
 * @param {string} dir - Directory path
 * @returns {Array} - List of file paths
 */
const getAllFiles = async (dir) => {
  let filesList = [];
  let items;

  try {
    items = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
    return filesList;
  }

  for (const item of items) {
    if (isExcluded(item.name, item.isDirectory())) {
      continue;
    }

    const fullPath = path.join(dir, item.name);
    const relativePath = path.relative(process.cwd(), fullPath).split(path.sep).join('/');

    if (item.isDirectory()) {
      const nestedFiles = await getAllFiles(fullPath);
      filesList = filesList.concat(nestedFiles);
    } else {
      filesList.push(relativePath);
    }
  }

  return filesList;
};

/**
 * Send data to OpenRouter API
 *
 * @param {string} prompt - The prompt to send to the LLM
 * @returns {string} - The LLM's response
 */
const sendToOpenRouter = async (prompt) => {
  try {
    const response = await axios.post(
      CONFIG.api.url,
      {
        model: 'anthropic/claude-3.5-sonnet:beta',
        messages: [{ role: 'user', content: prompt }]
      },
      {
        headers: {
          Authorization: `Bearer ${CONFIG.api.key}`,
          'HTTP-Referer': CONFIG.api.siteUrl,
          'X-Title': CONFIG.api.siteName,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.choices?.[0]?.message?.content) {
      return response.data.choices[0].message.content.trim();
    } else {
      console.warn('No response content from OpenRouter API.');
      return '';
    }
  } catch (error) {
    console.error('Error communicating with OpenRouter API:', error.message);
    return '';
  }
};

/**
 * Analyze the codebase using LLM
 *
 * @param {string} directoryTree - The directory tree as a string
 * @param {Object} fileData - An object containing file paths and their content
 * @returns {string} - The analysis content
 */
const analyzeCodebase = async (directoryTree, fileData) => {
  console.log('Analyzing codebase with LLM...');

  if (Object.keys(fileData).length === 0) {
    console.error('No files available for analysis.');
    return '';
  }

  // Prepare prompt for LLM with an example
  const prompt = `
I have a codebase with the following directory structure:

\`\`\`
${directoryTree.trim()}
\`\`\`

Below are the files and their contents:

${Object.entries(fileData)
    .map(([file, data]) => {
      const language = path.extname(file).substring(1) || 'plaintext';
      const contentSection = `### ${file}
\`\`\`${language}
${data.content}
\`\`\``;
      return contentSection;
    })
    .join('\n\n')}

**Your Task:**

For each file provided:

1. **Explain in detail** what the code file does.
2. **Describe** how it interacts with other files that it is importing.
3. **Output a mermaid diagram** representing the interactions for each file. Use appropriate mermaid syntax (e.g., \`graph TD\`).

Please format your response for each file as follows:

### [File Path]

**Explanation:**

[Your detailed explanation here.]

**Interactions:**

[Description of how this file interacts with other files.]

**Mermaid Diagram:**

\`\`\`mermaid
[Your mermaid diagram code here.]
\`\`\`

Avoid including unnecessary code snippets in your explanations. Be clear and concise.
`;

  // Send prompt to OpenRouter
  const analysis = await sendToOpenRouter(prompt);

  if (analysis) {
    return analysis;
  } else {
    console.error('Error: No analysis was received from OpenRouter.');
    return '';
  }
};

/**
 * Generate a table of contents based on the sections
 *
 * @param {Array} sections - List of section names
 * @returns {string} - The table of contents in Markdown format
 */
const generateTableOfContents = (sections) => {
  let toc = '# Table of Contents\n\n';
  sections.forEach(section => {
    const anchor = section.toLowerCase().replace(/\s+/g, '-');
    toc += `- [${section}](#${anchor})\n`;
  });
  toc += '\n';
  return toc;
};

/**
 * Add a folder to .gitignore
 *
 * @param {string} folderName - The folder to add to .gitignore
 */
const addFolderToGitignore = async (folderName) => {
  const gitignorePath = path.resolve(process.cwd(), '.gitignore');
  const folderEntry = `${folderName}/`;

  try {
    let gitignoreContent = '';
    if (await fileExists(gitignorePath)) {
      gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
    }

    const lines = gitignoreContent.split(/\r?\n/);
    if (!lines.includes(folderEntry)) {
      await fs.appendFile(gitignorePath, `\n${folderEntry}\n`);
      console.log(`Added "${folderEntry}" to .gitignore.`);
    } else {
      console.log(`"${folderEntry}" is already present in .gitignore.`);
    }
  } catch (err) {
    console.error(`Error updating .gitignore: ${err.message}`);
  }
};

/**
 * Check if a file exists
 *
 * @param {string} filePath - Path to the file
 * @returns {boolean} - True if exists, false otherwise
 */
const fileExists = async (filePath) => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

// Main execution
const main = async () => {
  try {
    // Parse command-line arguments for targets
    const args = process.argv.slice(2);
    let targets = [];
    let interactive = false;

    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--target' || args[i] === '-t') {
        const target = args[i + 1];
        if (target) {
          targets.push(...target.split(',').map(t => t.trim()));
          i++; // Skip next argument as it's part of this flag
        }
      } else if (args[i].startsWith('--target=')) {
        const target = args[i].split('=')[1];
        if (target) {
          targets.push(...target.split(',').map(t => t.trim()));
        }
      } else if (args[i] === '--interactive' || args[i] === '-i') {
        interactive = true;
      } else if (args[i] === '--help' || args[i] === '-h') {
        displayHelp();
        process.exit(0);
      }
    }

    if (interactive) {
      console.log('Launching interactive selection mode...');
    } else if (targets.length === 0) {
      console.log('No targets specified. Launching interactive selection mode...');
      interactive = true;
    }

    // Traverse the directory and collect all selectable items
    console.log('Scanning directories...');
    const allItems = await traverseDirectory(process.cwd());

    let selectedTargets = [];

    if (interactive) {
      selectedTargets = await launchInteractiveSelection(allItems);
    } else {
      selectedTargets = targets;
    }

    // Ensure the output directory exists
    await ensureOutputDirectory();

    // Add the output directory to .gitignore
    await addFolderToGitignore(CONFIG.outputDir);

    // Determine files to process
    let filesToProcess = [];
    if (selectedTargets.length > 0) {
      console.log('Selected targets for analysis:', selectedTargets);
      filesToProcess = processSelections(selectedTargets, allItems);
      if (filesToProcess.length === 0) {
        console.error('No valid files found for the specified targets. Exiting.');
        process.exit(1);
      }
    } else {
      console.log('Analyzing the entire project.');
      filesToProcess = await collectFiles(['.']);
    }

    // Initialize the output file
    const timestamp = getFormattedDate();
    const outputFile = path.join(CONFIG.outputDir, `CodeAnalysis_${timestamp}.md`);
    await fs.writeFile(outputFile, '', 'utf8');
    console.log(`Initialized ${outputFile}`);

    const sections = {};

    // Generate directory tree based on selected targets
    console.log('Generating directory tree...');
    let directoryTree = '';

    if (selectedTargets.length === 1 && await isDirectory(selectedTargets[0])) {
      directoryTree = await generateDirectoryTree(path.resolve(process.cwd(), selectedTargets[0]));
    } else {
      // Multiple roots or single file
      for (const target of selectedTargets) {
        const resolvedPath = path.resolve(process.cwd(), target);
        if (await isDirectory(resolvedPath)) {
          directoryTree += await generateDirectoryTree(resolvedPath);
        } else {
          const fileName = path.basename(resolvedPath);
          directoryTree += `${fileName}\n`;
        }
      }
    }

    sections['Directory'] = '```\n' + directoryTree + '\n```';
    console.log('Generated directory tree.');

    // Collect files and their contents
    console.log('Collecting files and their contents...');
    const fileData = {};

    for (const filePath of filesToProcess) {
      const relativePath = path.relative(process.cwd(), path.resolve(process.cwd(), filePath)).split(path.sep).join('/');
      const content = await readFileContent(filePath);
      if (content !== null) {
        fileData[relativePath] = { content };
      }
    }

    // Analyze codebase using LLM
    console.log('Analyzing codebase...');
    const analysis = await analyzeCodebase(directoryTree, fileData);
    sections['Analysis'] = analysis || 'No analysis was generated.';
    console.log('Completed analysis.');

    // Prepare Code Files section
    console.log('Preparing Code Files section...');
    let codeFilesContent = '';
    for (const [relativePath, data] of Object.entries(fileData)) {
      codeFilesContent += `## ${relativePath}\n\n`;
      const fileExtension = path.extname(relativePath).substring(1) || 'plaintext';
      codeFilesContent += '```' + fileExtension + '\n' + data.content + '\n```\n\n';
    }
    sections['Code Files'] = codeFilesContent;
    console.log('Prepared Code Files section.');

    // Add timestamp to the report
    const generationTime = new Date();
    const formattedGenerationTime = generationTime.toLocaleString();
    sections['Report Generated On'] = `*Generated on ${formattedGenerationTime}*\n`;
    console.log('Added timestamp to the report.');

    // Generate table of contents
    console.log('Generating table of contents...');
    const toc = generateTableOfContents(Object.keys(sections));
    console.log('Generated table of contents.');

    // Write all content to the output file
    console.log('Writing content to the output file...');
    let finalContent = toc;
    for (const sectionName of ['Report Generated On', 'Directory', 'Analysis', 'Code Files']) {
      finalContent += `# ${sectionName}\n\n`;
      finalContent += sections[sectionName];
      finalContent += '\n\n';
    }
    await fs.writeFile(outputFile, finalContent, 'utf8');

    console.log(`File '${outputFile}' has been successfully created.`);
  } catch (err) {
    console.error(`An error occurred: ${err.message}`);
  }
};

/**
 * Check if a path is a directory
 *
 * @param {string} target - Path to check
 * @returns {boolean} - True if directory, false otherwise
 */
const isDirectory = async (target) => {
  try {
    const stats = await fs.stat(target);
    return stats.isDirectory();
  } catch {
    return false;
  }
};

/**
 * Generate directory tree using improved ASCII characters
 *
 * @param {string} dir - The directory path to start from
 * @param {string} prefix - The prefix for the current level
 * @returns {string} - The formatted directory tree as a string
 */
const generateDirectoryTree = async (dir, prefix = '') => {
  let tree = '';
  let items;

  try {
    items = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err.message);
    return tree;
  }

  // Filter and sort items
  items = items.filter(item => !isExcluded(item.name, item.isDirectory()));
  items.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const isLast = i === items.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    tree += `${prefix}${connector}${item.name}\n`;

    if (item.isDirectory()) {
      const newPrefix = prefix + (isLast ? '    ' : '│   ');
      tree += await generateDirectoryTree(path.join(dir, item.name), newPrefix);
    }
  }

  return tree;
};

// Execute the main function
main().catch(err => {
  console.error(`An unexpected error occurred: ${err.message}`);
  process.exit(1);
});
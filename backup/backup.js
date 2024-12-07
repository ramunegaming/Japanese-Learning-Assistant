const fs = require('fs-extra');
const path = require('path');

const backupDir = path.join(__dirname, 'backup');
const sourceDir = __dirname;

// Files and directories to exclude from backup
const excludeList = [
    'node_modules',
    'backup',
    'backup.js',
    '.git'
];

async function createBackup() {
    try {
        // Remove existing backup if it exists
        await fs.remove(backupDir);
        
        // Create backup directory
        await fs.ensureDir(backupDir);

        // Copy all files except those in excludeList
        const files = await fs.readdir(sourceDir);
        for (const file of files) {
            if (!excludeList.includes(file)) {
                const sourcePath = path.join(sourceDir, file);
                const destPath = path.join(backupDir, file);
                await fs.copy(sourcePath, destPath);
            }
        }
        console.log('Backup created successfully!');
    } catch (err) {
        console.error('Error creating backup:', err);
    }
}

// Run backup if script is called directly
if (require.main === module) {
    createBackup();
}

module.exports = createBackup;

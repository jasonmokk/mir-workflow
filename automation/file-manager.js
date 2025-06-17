import fs from 'fs-extra';
import path from 'path';
import chalk from 'chalk';
import crypto from 'crypto';

class FileManager {
    constructor(config = {}) {
        this.config = {
            supportedFormats: ['.mp3', '.wav', '.flac', '.ogg', '.m4a', '.aac'],
            recursive: true,
            excludePatterns: [
                '.*',
                'node_modules',
                'temp',
                'tmp',
                '__pycache__'
            ],
            minFileSize: 1024, // 1KB minimum
            maxFileSize: 104857600, // 100MB maximum
            batchSize: 30,
            enableProgressTracking: true,
            resumeFromFailure: true,
            ...config
        };
        
        this.discoveredFiles = [];
        this.batches = [];
        this.processedFiles = new Set();
        this.failedFiles = new Set();
        this.processingState = {
            totalFiles: 0,
            processedCount: 0,
            failedCount: 0,
            currentBatch: 0,
            startTime: null,
            lastSaveTime: null
        };
        
        this.stateFile = './file-processing-state.json';
    }
    
    async discoverFiles(directoryPath, options = {}) {
        try {
            console.log(chalk.blue(`🔍 Discovering audio files in: ${directoryPath}`));
            
            if (!(await fs.pathExists(directoryPath))) {
                throw new Error(`Directory does not exist: ${directoryPath}`);
            }
            
            const stats = await fs.stat(directoryPath);
            if (!stats.isDirectory()) {
                throw new Error(`Path is not a directory: ${directoryPath}`);
            }
            
            this.discoveredFiles = [];
            await this._scanDirectory(directoryPath, options.recursive ?? this.config.recursive);
            
            // Validate discovered files
            const validatedFiles = await this._validateFiles(this.discoveredFiles);
            this.discoveredFiles = validatedFiles;
            
            console.log(chalk.green(`✓ Discovered ${this.discoveredFiles.length} valid audio files`));
            
            return {
                totalFiles: this.discoveredFiles.length,
                files: this.discoveredFiles,
                byFormat: this._groupFilesByFormat(),
                statistics: this._getDiscoveryStatistics()
            };
            
        } catch (error) {
            console.error(chalk.red('File discovery failed:'), error.message);
            throw error;
        }
    }
    
    async _scanDirectory(dirPath, recursive = true) {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                
                if (entry.isDirectory()) {
                    // Skip excluded directories
                    if (this._isExcluded(entry.name)) {
                        continue;
                    }
                    
                    if (recursive) {
                        await this._scanDirectory(fullPath, recursive);
                    }
                } else if (entry.isFile()) {
                    // Check if file has supported audio format
                    if (this._isSupportedAudioFile(entry.name)) {
                        this.discoveredFiles.push(fullPath);
                    }
                }
            }
        } catch (error) {
            console.warn(chalk.yellow(`Failed to scan directory ${dirPath}: ${error.message}`));
        }
    }
    
    _isSupportedAudioFile(filename) {
        const ext = path.extname(filename).toLowerCase();
        return this.config.supportedFormats.includes(ext);
    }
    
    _isExcluded(name) {
        return this.config.excludePatterns.some(pattern => {
            if (pattern.startsWith('.')) {
                return name.startsWith('.');
            }
            return name.includes(pattern);
        });
    }
    
    async _validateFiles(filePaths) {
        console.log(chalk.blue(`🔍 Validating ${filePaths.length} files...`));
        
        const validFiles = [];
        const errors = [];
        
        for (const filePath of filePaths) {
            try {
                const stats = await fs.stat(filePath);
                
                // Check file size
                if (stats.size < this.config.minFileSize) {
                    errors.push(`${filePath}: File too small (${stats.size} bytes)`);
                    continue;
                }
                
                if (stats.size > this.config.maxFileSize) {
                    errors.push(`${filePath}: File too large (${stats.size} bytes)`);
                    continue;
                }
                
                // Check file accessibility
                await fs.access(filePath, fs.constants.R_OK);
                
                validFiles.push(filePath);
                
            } catch (error) {
                errors.push(`${filePath}: ${error.message}`);
            }
        }
        
        if (errors.length > 0) {
            console.warn(chalk.yellow(`⚠️ Validation warnings (${errors.length} files excluded):`));
            errors.slice(0, 10).forEach(error => console.warn(chalk.gray(`  ${error}`)));
            if (errors.length > 10) {
                console.warn(chalk.gray(`  ... and ${errors.length - 10} more`));
            }
        }
        
        console.log(chalk.green(`✓ Validated ${validFiles.length} files`));
        
        return validFiles;
    }
    
    createBatches(files = null, batchSize = null) {
        try {
            const filesToBatch = files || this.discoveredFiles;
            const size = batchSize || this.config.batchSize;
            
            console.log(chalk.blue(`📦 Creating batches of ${size} files each...`));
            
            this.batches = [];
            
            for (let i = 0; i < filesToBatch.length; i += size) {
                const batch = {
                    id: this.batches.length + 1,
                    files: filesToBatch.slice(i, i + size),
                    status: 'pending',
                    attempts: 0,
                    maxAttempts: 3,
                    startTime: null,
                    endTime: null,
                    error: null
                };
                
                this.batches.push(batch);
            }
            
            console.log(chalk.green(`✓ Created ${this.batches.length} batches`));
            
            // Update processing state
            this.processingState.totalFiles = filesToBatch.length;
            this.processingState.currentBatch = 0;
            
            return {
                totalBatches: this.batches.length,
                totalFiles: filesToBatch.length,
                batchSize: size,
                batches: this.batches.map(b => ({
                    id: b.id,
                    fileCount: b.files.length,
                    status: b.status
                }))
            };
            
        } catch (error) {
            console.error(chalk.red('Batch creation failed:'), error.message);
            throw error;
        }
    }
    
    getNextBatch() {
        // Find the first pending batch
        const nextBatch = this.batches.find(batch => batch.status === 'pending');
        
        if (nextBatch) {
            this.processingState.currentBatch = nextBatch.id;
            return nextBatch;
        }
        
        // Check for failed batches that can be retried
        const retryableBatch = this.batches.find(batch => 
            batch.status === 'failed' && batch.attempts < batch.maxAttempts
        );
        
        if (retryableBatch) {
            this.processingState.currentBatch = retryableBatch.id;
            return retryableBatch;
        }
        
        return null;
    }
    
    markBatchStarted(batchId) {
        const batch = this.batches.find(b => b.id === batchId);
        if (batch) {
            batch.status = 'processing';
            batch.startTime = new Date();
            batch.attempts += 1;
            
            if (!this.processingState.startTime) {
                this.processingState.startTime = new Date();
            }
            
            this._saveState();
        }
    }
    
    markBatchCompleted(batchId, processedFiles = []) {
        const batch = this.batches.find(b => b.id === batchId);
        if (batch) {
            batch.status = 'completed';
            batch.endTime = new Date();
            
            // Add processed files to the set
            processedFiles.forEach(file => this.processedFiles.add(file));
            
            this.processingState.processedCount += processedFiles.length;
            
            this._saveState();
            
            console.log(chalk.green(`✓ Batch ${batchId} completed (${processedFiles.length} files)`));
        }
    }
    
    markBatchFailed(batchId, error, failedFiles = []) {
        const batch = this.batches.find(b => b.id === batchId);
        if (batch) {
            batch.status = 'failed';
            batch.endTime = new Date();
            batch.error = error.message || error;
            
            // Add failed files to the set
            failedFiles.forEach(file => this.failedFiles.add(file));
            
            this.processingState.failedCount += failedFiles.length;
            
            this._saveState();
            
            console.error(chalk.red(`✗ Batch ${batchId} failed: ${batch.error}`));
        }
    }
    
    getProcessingProgress() {
        const totalBatches = this.batches.length;
        const completedBatches = this.batches.filter(b => b.status === 'completed').length;
        const failedBatches = this.batches.filter(b => b.status === 'failed').length;
        const pendingBatches = this.batches.filter(b => b.status === 'pending').length;
        const processingBatches = this.batches.filter(b => b.status === 'processing').length;
        
        const progress = {
            totalFiles: this.processingState.totalFiles,
            processedCount: this.processingState.processedCount,
            failedCount: this.processingState.failedCount,
            remainingCount: this.processingState.totalFiles - this.processingState.processedCount - this.processingState.failedCount,
            progressPercentage: this.processingState.totalFiles > 0 
                ? ((this.processingState.processedCount / this.processingState.totalFiles) * 100).toFixed(1)
                : 0,
            
            totalBatches,
            completedBatches,
            failedBatches,
            pendingBatches,
            processingBatches,
            currentBatch: this.processingState.currentBatch,
            
            startTime: this.processingState.startTime,
            elapsedTime: this.processingState.startTime 
                ? Date.now() - this.processingState.startTime.getTime()
                : 0
        };
        
        if (progress.elapsedTime > 0 && progress.processedCount > 0) {
            progress.averageTimePerFile = progress.elapsedTime / progress.processedCount;
            progress.estimatedRemainingTime = progress.averageTimePerFile * progress.remainingCount;
        }
        
        return progress;
    }
    
    _groupFilesByFormat() {
        const grouped = {};
        
        this.discoveredFiles.forEach(filePath => {
            const ext = path.extname(filePath).toLowerCase();
            if (!grouped[ext]) {
                grouped[ext] = [];
            }
            grouped[ext].push(filePath);
        });
        
        return grouped;
    }
    
    _getDiscoveryStatistics() {
        const totalSize = this.discoveredFiles.reduce((sum, filePath) => {
            try {
                const stats = fs.statSync(filePath);
                return sum + stats.size;
            } catch {
                return sum;
            }
        }, 0);
        
        const byFormat = this._groupFilesByFormat();
        
        return {
            totalFiles: this.discoveredFiles.length,
            totalSize: totalSize,
            totalSizeFormatted: this._formatBytes(totalSize),
            formatBreakdown: Object.keys(byFormat).map(format => ({
                format,
                count: byFormat[format].length,
                percentage: ((byFormat[format].length / this.discoveredFiles.length) * 100).toFixed(1)
            }))
        };
    }
    
    _formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    async _saveState() {
        if (!this.config.enableProgressTracking) {
            return;
        }
        
        try {
            const state = {
                processingState: this.processingState,
                batches: this.batches,
                processedFiles: Array.from(this.processedFiles),
                failedFiles: Array.from(this.failedFiles),
                config: this.config,
                lastSaved: new Date()
            };
            
            await fs.writeJson(this.stateFile, state, { spaces: 2 });
            this.processingState.lastSaveTime = new Date();
            
        } catch (error) {
            console.warn(chalk.yellow(`Failed to save processing state: ${error.message}`));
        }
    }
    
    async loadState() {
        if (!this.config.resumeFromFailure) {
            return false;
        }
        
        try {
            if (!(await fs.pathExists(this.stateFile))) {
                return false;
            }
            
            const state = await fs.readJson(this.stateFile);
            
            this.processingState = state.processingState;
            this.batches = state.batches;
            this.processedFiles = new Set(state.processedFiles || []);
            this.failedFiles = new Set(state.failedFiles || []);
            
            // Convert date strings back to Date objects
            if (this.processingState.startTime) {
                this.processingState.startTime = new Date(this.processingState.startTime);
            }
            
            this.batches.forEach(batch => {
                if (batch.startTime) batch.startTime = new Date(batch.startTime);
                if (batch.endTime) batch.endTime = new Date(batch.endTime);
            });
            
            console.log(chalk.blue(`📄 Loaded previous processing state`));
            console.log(chalk.gray(`  Total files: ${this.processingState.totalFiles}`));
            console.log(chalk.gray(`  Processed: ${this.processingState.processedCount}`));
            console.log(chalk.gray(`  Failed: ${this.processingState.failedCount}`));
            
            return true;
            
        } catch (error) {
            console.warn(chalk.yellow(`Failed to load processing state: ${error.message}`));
            return false;
        }
    }
    
    async clearState() {
        try {
            if (await fs.pathExists(this.stateFile)) {
                await fs.remove(this.stateFile);
                console.log(chalk.blue('📄 Cleared processing state'));
            }
            
            // Reset internal state
            this.discoveredFiles = [];
            this.batches = [];
            this.processedFiles = new Set();
            this.failedFiles = new Set();
            this.processingState = {
                totalFiles: 0,
                processedCount: 0,
                failedCount: 0,
                currentBatch: 0,
                startTime: null,
                lastSaveTime: null
            };
            
        } catch (error) {
            console.warn(chalk.yellow(`Failed to clear processing state: ${error.message}`));
        }
    }
    
    generateReport() {
        const progress = this.getProcessingProgress();
        const completedBatches = this.batches.filter(b => b.status === 'completed');
        const failedBatches = this.batches.filter(b => b.status === 'failed');
        
        return {
            summary: {
                totalFiles: progress.totalFiles,
                processedFiles: progress.processedCount,
                failedFiles: progress.failedCount,
                successRate: progress.totalFiles > 0 
                    ? ((progress.processedCount / progress.totalFiles) * 100).toFixed(1) + '%'
                    : '0%',
                totalBatches: progress.totalBatches,
                completedBatches: progress.completedBatches,
                failedBatches: progress.failedBatches
            },
            timing: {
                startTime: progress.startTime,
                elapsedTime: this._formatDuration(progress.elapsedTime),
                averageTimePerFile: progress.averageTimePerFile 
                    ? this._formatDuration(progress.averageTimePerFile)
                    : 'N/A',
                estimatedRemainingTime: progress.estimatedRemainingTime
                    ? this._formatDuration(progress.estimatedRemainingTime)
                    : 'N/A'
            },
            batches: {
                completed: completedBatches.map(b => ({
                    id: b.id,
                    fileCount: b.files.length,
                    duration: b.endTime && b.startTime 
                        ? this._formatDuration(b.endTime.getTime() - b.startTime.getTime())
                        : 'N/A'
                })),
                failed: failedBatches.map(b => ({
                    id: b.id,
                    fileCount: b.files.length,
                    attempts: b.attempts,
                    error: b.error
                }))
            }
        };
    }
    
    _formatDuration(milliseconds) {
        if (!milliseconds || milliseconds < 0) return '0s';
        
        const seconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
    
    getFailedFiles() {
        return Array.from(this.failedFiles);
    }
    
    getProcessedFiles() {
        return Array.from(this.processedFiles);
    }
}

export default FileManager; 
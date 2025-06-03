# MIR Automation Framework

A comprehensive Node.js automation framework for batch processing audio files through the Music Information Retrieval (MIR) web application. This framework integrates a local web server with browser automation capabilities to process large audio collections (400-500+ songs) efficiently.

## Features

✅ **Express.js Web Server** - Serves the existing MIR web application with all functionality preserved  
✅ **Playwright Browser Automation** - Cross-browser support with intelligent waiting and error handling  
✅ **Batch File Processing** - Handles large audio collections in manageable chunks  
✅ **Progress Tracking** - Comprehensive progress tracking with resume capability  
✅ **CSV Export Integration** - Automatic download and management of analysis results  
✅ **Robust Error Handling** - Retry mechanisms and graceful failure recovery  
✅ **Configuration Management** - Flexible configuration system for all parameters  

## Requirements

- **Node.js** 16.0.0 or higher
- **NPM** or **Yarn** package manager
- **Audio files** in supported formats: `.mp3`, `.wav`, `.flac`, `.ogg`, `.m4a`, `.aac`

## Installation

1. **Navigate to the automation directory:**
   ```bash
   cd automation
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Install Playwright browsers:**
   ```bash
   npx playwright install
   ```

4. **Verify installation:**
   ```bash
   npm run test
   ```

## Quick Start

### Process a Directory of Audio Files

```bash
# Basic processing
node batch-processor.js process /path/to/audio/files

# With custom batch size
node batch-processor.js process /path/to/audio/files --batch-size 50

# Resume from previous session
node batch-processor.js process /path/to/audio/files --resume

# Clear previous state and start fresh
node batch-processor.js process /path/to/audio/files --clear-state
```

### Discover Files (Preview Mode)

```bash
# Analyze a directory without processing
node batch-processor.js discover /path/to/audio/files
```

### Start Server Only

```bash
# Start the MIR web server for manual use
node batch-processor.js server
```

### Check Processing Status

```bash
# View current processing progress
node batch-processor.js status
```

## Command Reference

### Main Commands

| Command | Description | Options |
|---------|-------------|---------|
| `process <directory>` | Process all audio files in a directory | `--batch-size`, `--strict`, `--resume`, `--clear-state` |
| `discover <directory>` | Discover and analyze files without processing | None |
| `server` | Start the MIR web server only | `--port` |
| `status` | Show current processing status | None |
| `clear` | Clear processing state and temporary files | None |

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `--batch-size <size>` | Number of files per batch | 100 |
| `--strict` | Stop processing on first batch failure | false |
| `--resume` | Resume from previous processing state | false |
| `--clear-state` | Clear previous state before starting | false |
| `--port <port>` | Server port (server command only) | 3000 |

## Configuration

The framework uses `config.json` for configuration. Key settings:

### Server Configuration
```json
{
  "server": {
    "port": 3000,
    "fallbackPorts": [3001, 3002, 3003],
    "host": "localhost",
    "enableCORS": true
  }
}
```

### Browser Automation
```json
{
  "browser": {
    "headless": true,
    "timeout": 30000,
    "screenshotsEnabled": true,
    "screenshotsPath": "./screenshots"
  }
}
```

### Batch Processing
```json
{
  "batchProcessing": {
    "batchSize": 100,
    "maxRetries": 3,
    "retryDelay": 2000,
    "delayBetweenBatches": 3000,
    "analysisTimeout": 300000
  }
}
```

### File Discovery
```json
{
  "fileDiscovery": {
    "supportedFormats": [".mp3", ".wav", ".flac", ".ogg", ".m4a", ".aac"],
    "recursive": true,
    "minFileSize": 1024,
    "maxFileSize": 104857600
  }
}
```

## Usage Examples

### Example 1: Basic Processing
```bash
# Process all audio files in the music directory
node batch-processor.js process ~/Music
```

### Example 2: Large Collection with Custom Settings
```bash
# Process with smaller batches for better memory management
node batch-processor.js process /media/music-collection --batch-size 50
```

### Example 3: Resume Interrupted Processing
```bash
# Resume processing from where it left off
node batch-processor.js process ~/Music --resume
```

### Example 4: Development/Testing
```bash
# Discover files first to see what would be processed
node batch-processor.js discover ~/Music

# Start server for manual testing
node batch-processor.js server --port 3001
```

## Architecture

The framework consists of four main components:

### 1. MIR Server (`server.js`)
- Express.js server serving the MIR web application
- Static file handling with proper MIME types
- CORS support for local development
- Port management with fallback options

### 2. Browser Automation (`browser-automation.js`)
- Playwright-based browser control
- Cross-browser support (Chromium, Firefox, WebKit)
- Intelligent waiting and error handling
- File upload and CSV download automation

### 3. File Manager (`file-manager.js`)
- Audio file discovery and validation
- Batch creation and management
- Progress tracking and state persistence
- Processing statistics and reporting

### 4. Batch Processor (`batch-processor.js`)
- Main orchestration and CLI interface
- Workflow coordination between components
- Error handling and recovery
- Progress reporting and logging

## Processing Workflow

1. **Server Startup** - Start Express server serving MIR application
2. **File Discovery** - Scan directory for valid audio files
3. **Batch Creation** - Organize files into processing batches
4. **Browser Launch** - Start Playwright automation
5. **Batch Processing** - Process each batch sequentially:
   - Upload files to web application
   - Wait for analysis completion
   - Download CSV results
   - Track progress and handle errors
6. **Report Generation** - Create final processing report

## Error Handling

The framework includes comprehensive error handling:

### Automatic Retries
- Failed batches are automatically retried up to 3 times
- Configurable retry delays between attempts
- Individual file failures don't stop batch processing

### State Persistence
- Processing state is saved automatically
- Resume capability for interrupted sessions
- Failed file tracking and reporting

### Graceful Degradation
- Browser connection failures trigger retries
- Server startup failures try fallback ports
- File access errors are logged but don't stop processing

## Troubleshooting

### Common Issues

#### Issue: "No audio files found"
**Solution:** Check that:
- Directory path is correct
- Files have supported extensions (`.mp3`, `.wav`, `.flac`, `.ogg`, `.m4a`, `.aac`)
- Files are readable (check permissions)

#### Issue: "Server startup failed"
**Solution:** Check that:
- Port 3000 (or configured port) is available
- No other instances are running
- System firewall allows local connections

#### Issue: "Browser launch failed"
**Solution:** 
- Run `npx playwright install` to ensure browsers are installed
- Check system dependencies for headless browsers
- Try running with `"headless": false` in config for debugging

#### Issue: "Analysis timeout"
**Solution:**
- Increase `analysisTimeout` in config
- Reduce batch size for better memory management
- Check system resources (CPU/Memory)

#### Issue: "CSV download failed"
**Solution:**
- Ensure output directory exists and is writable
- Check browser download permissions
- Verify CSV button is enabled after analysis

### Debugging

#### Enable Screenshots
Set `"screenshotsEnabled": true` in config to capture screenshots during processing.

#### View Browser Actions
Set `"headless": false` in config to see browser actions visually.

#### Check Logs
- Processing logs are saved to `./logs/` directory
- State files saved as `file-processing-state.json`
- Reports saved with timestamps for each run

#### Monitor Progress
```bash
# Check current status during processing
node batch-processor.js status
```

### Performance Optimization

#### Memory Management
- Reduce batch size for large files or limited memory
- Increase delays between batches if needed
- Monitor system resources during processing

#### Speed Optimization
- Increase batch size for faster processing (if memory allows)
- Reduce delays between batches
- Use SSD storage for better file I/O performance

#### Network Considerations
- Ensure stable local network for browser automation
- Consider firewall settings for local server access

## Integration with MIR Application

The framework is designed to work seamlessly with the existing MIR web application:

### Preserved Functionality
- All existing web app features remain unchanged
- TensorFlow.js WASM backend support maintained
- Essentia.js dependencies handled correctly
- CSV export functionality from Task 1.2 integrated

### Enhanced Capabilities
- Batch processing of 100+ files at once
- Automatic retry on failures
- Progress tracking across sessions
- Comprehensive reporting

## File Structure

```
automation/
├── package.json              # Dependencies and scripts
├── config.json              # Configuration settings
├── batch-processor.js       # Main CLI interface
├── server.js               # Express web server
├── browser-automation.js   # Playwright automation
├── file-manager.js         # File discovery and management
├── README.md              # This documentation
├── logs/                  # Processing logs and reports
├── screenshots/           # Debug screenshots (if enabled)
├── csv_exports/           # Downloaded CSV files
└── downloads/             # Temporary download directory
```

## Development

### Adding New Features

1. **File Discovery:** Modify `file-manager.js` to add new file types or validation rules
2. **Browser Automation:** Extend `browser-automation.js` for new web app interactions
3. **Server Configuration:** Update `server.js` for additional static file handling
4. **CLI Commands:** Add new commands to `batch-processor.js`

### Testing

```bash
# Test server startup
npm run server

# Test file discovery
node batch-processor.js discover ./test-files

# Test browser automation
node batch-processor.js process ./test-files --batch-size 5
```

## Support

For issues and questions:

1. Check this README and troubleshooting section
2. Review the configuration options
3. Enable debug features (screenshots, visible browser)
4. Check log files for detailed error information

## License

This automation framework is part of the MIR workflow project and follows the same licensing terms as the main project. 
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';
import mime from 'mime';
import chalk from 'chalk';
import { createServer } from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class MIRServer {
    constructor(config = {}) {
        this.config = {
            port: 3000,
            fallbackPorts: [3001, 3002, 3003, 3004, 3005, 3006, 3007, 3008, 3009, 3010],
            host: 'localhost',
            enableCORS: true,
            staticFiles: {
                root: '../',
                indexRoute: '/',
                srcRoute: '/src',
                modelsRoute: '/models',
                dataRoute: '/data',
                imagesRoute: '/images'
            },
            ...config
        };
        
        this.app = express();
        this.server = null;
        this.actualPort = null;
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }
    
    setupMiddleware() {
        // Enable CORS for local development
        if (this.config.enableCORS) {
            this.app.use((req, res, next) => {
                res.header('Access-Control-Allow-Origin', '*');
                res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
                res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
                
                if (req.method === 'OPTIONS') {
                    res.sendStatus(200);
                } else {
                    next();
                }
            });
        }
        
        // Request logging - only log important requests, not every asset
        this.app.use((req, res, next) => {
            // Only log non-asset requests or errors
            const isAssetRequest = req.url.includes('.js') || req.url.includes('.wasm') || 
                                 req.url.includes('.css') || req.url.includes('.json') ||
                                 req.url.includes('.bin') || req.url.includes('/models/');
            
            if (!isAssetRequest || req.url === '/' || req.url.includes('/api/')) {
                const timestamp = new Date().toISOString();
                console.log(chalk.gray(`[${timestamp}] ${req.method} ${req.url}`));
            }
            next();
        });
        
        // Custom static file handler for WASM files and proper MIME types
        this.app.use((req, res, next) => {
            if (req.url.endsWith('.wasm')) {
                res.set('Content-Type', 'application/wasm');
            } else if (req.url.endsWith('.js') && req.url.includes('wasm')) {
                res.set('Content-Type', 'application/javascript');
            }
            next();
        });
    }
    
    setupRoutes() {
        const rootPath = path.resolve(__dirname, this.config.staticFiles.root);
        
        // Serve index.html at root
        this.app.get('/', (req, res) => {
            const indexPath = path.join(rootPath, 'index.html');
            this.serveFile(req, res, indexPath);
        });
        
        // Serve static directories
        const staticDirs = [
            { route: this.config.staticFiles.srcRoute, dir: 'src' },
            { route: this.config.staticFiles.modelsRoute, dir: 'models' },
            { route: this.config.staticFiles.dataRoute, dir: 'data' },
            { route: this.config.staticFiles.imagesRoute, dir: 'images' }
        ];
        
        staticDirs.forEach(({ route, dir }) => {
            const dirPath = path.join(rootPath, dir);
            this.app.use(route, express.static(dirPath, {
                setHeaders: (res, filePath) => {
                    const mimeType = mime.getType(filePath);
                    if (mimeType) {
                        res.set('Content-Type', mimeType);
                    }
                    
                    // Special handling for WASM files
                    if (filePath.endsWith('.wasm')) {
                        res.set('Content-Type', 'application/wasm');
                    }
                }
            }));
        });
        
        // Serve CSS and other root files
        this.app.use(express.static(rootPath, {
            setHeaders: (res, filePath) => {
                const mimeType = mime.getType(filePath);
                if (mimeType) {
                    res.set('Content-Type', mimeType);
                }
            }
        }));
        
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                port: this.actualPort,
                uptime: process.uptime()
            });
        });
        
        // API endpoint to check if server is ready
        this.app.get('/api/status', (req, res) => {
            res.json({
                server: 'MIR Automation Server',
                version: '1.0.0',
                status: 'running',
                port: this.actualPort
            });
        });
    }
    
    serveFile(req, res, filePath) {
        fs.readFile(filePath, 'utf8', (err, content) => {
            if (err) {
                console.error(chalk.red(`Error serving ${filePath}:`, err.message));
                res.status(404).send('File not found');
                return;
            }
            
            const mimeType = mime.getType(filePath) || 'text/html';
            res.set('Content-Type', mimeType);
            res.send(content);
        });
    }
    
    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            console.log(chalk.yellow(`404 - Not found: ${req.url}`));
            res.status(404).json({
                error: 'Not Found',
                message: `The requested resource ${req.url} was not found`,
                timestamp: new Date().toISOString()
            });
        });
        
        // General error handler
        this.app.use((err, req, res, next) => {
            console.error(chalk.red('Server error:'), err.message);
            res.status(500).json({
                error: 'Internal Server Error',
                message: 'An unexpected error occurred',
                timestamp: new Date().toISOString()
            });
        });
    }
    
    async findAvailablePort(startPort = this.config.port) {
        const testPort = (port) => {
            return new Promise((resolve) => {
                const server = createServer();
                server.listen(port, (err) => {
                    if (err) {
                        resolve(false);
                    } else {
                        server.once('close', () => resolve(true));
                        server.close();
                    }
                });
                server.on('error', () => resolve(false));
            });
        };
        
        // Test the default port first
        if (await testPort(startPort)) {
            return startPort;
        }
        
        // Test fallback ports
        for (const port of this.config.fallbackPorts) {
            if (await testPort(port)) {
                return port;
            }
        }
        
        throw new Error(`No available ports found. Tried: ${startPort}, ${this.config.fallbackPorts.join(', ')}`);
    }
    
    async start() {
        try {
            this.actualPort = await this.findAvailablePort();
            
            return new Promise((resolve, reject) => {
                this.server = this.app.listen(this.actualPort, this.config.host, () => {
                    const url = `http://${this.config.host}:${this.actualPort}`;
                    console.log(chalk.green(`✓ MIR Automation Server started`));
                    console.log(chalk.blue(`  → Local: ${url}`));
                    console.log(chalk.gray(`  → Health check: ${url}/health`));
                    console.log(chalk.gray(`  → API status: ${url}/api/status`));
                    resolve({
                        url,
                        port: this.actualPort,
                        host: this.config.host
                    });
                });
                
                this.server.on('error', (err) => {
                    console.error(chalk.red('Server startup error:'), err.message);
                    reject(err);
                });
            });
        } catch (error) {
            console.error(chalk.red('Failed to start server:'), error.message);
            throw error;
        }
    }
    
    async stop() {
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    console.log(chalk.yellow('MIR Automation Server stopped'));
                    resolve();
                });
            });
        }
    }
    
    getUrl() {
        if (this.actualPort) {
            return `http://${this.config.host}:${this.actualPort}`;
        }
        return null;
    }
}

// Allow running server standalone
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new MIRServer();
    
    // Graceful shutdown handling
    const gracefulShutdown = async () => {
        console.log('\nReceived shutdown signal, stopping server...');
        await server.stop();
        process.exit(0);
    };
    
    process.on('SIGINT', gracefulShutdown);
    process.on('SIGTERM', gracefulShutdown);
    
    // Start server
    server.start().catch((error) => {
        console.error(chalk.red('Failed to start server:'), error.message);
        process.exit(1);
    });
}

export default MIRServer; 